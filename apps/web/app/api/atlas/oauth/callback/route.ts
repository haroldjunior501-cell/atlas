import { takeOauthState } from '@/lib/atlas-mcp-store'
import { oauthCallbackUrl } from '@/lib/public-origin'

function closePage(ok: boolean, provider: string, message: string) {
  const safe = JSON.stringify({ type: 'atlas-oauth', ok, provider })
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ATLAS</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090f;color:#f4f4f5;font-family:system-ui,sans-serif}
  main{width:min(420px,92vw);padding:28px;border:1px solid #2a2150;border-radius:20px;background:#12101f;text-align:center}
  h1{margin:0 0 8px;font-size:22px} p{color:#a7b0c9;line-height:1.45}
</style></head><body><main><h1>${ok ? 'Connecté' : 'Connexion interrompue'}</h1><p>${message}</p></main>
<script>
  const payload = ${safe};
  try { window.opener && window.opener.postMessage(payload, '*'); } catch (err) {}
  window.close();
  setTimeout(() => { location.href = ${JSON.stringify('/bureau?connected=')} + encodeURIComponent(payload.provider || ''); }, 600);
</script></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')?.trim() ?? ''
  const nonce = url.searchParams.get('state')?.trim() ?? ''
  const saved = nonce ? takeOauthState(nonce) : null
  if (!saved) return closePage(false, '', 'Le lien de connexion a expiré. Revenez sur ATLAS.')
  if (!code) return closePage(false, saved.provider, 'Autorisation refusée.')
  const { isOauthProvider, oauthCredentials, capabilityTools } = await import('@/lib/atlas-oauth')
  const { saveLink } = await import('@/lib/atlas-mcp-store')
  if (!isOauthProvider(saved.provider)) return closePage(false, saved.provider, 'Outil indisponible.')
  const { id, secret, app } = oauthCredentials(saved.provider)
  if (!id || !secret) return closePage(false, saved.provider, 'ATLAS n’a pas encore les accès fournisseur.')
  const redirect = oauthCallbackUrl(request)
  try {
    const body = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    })
    const response = await fetch(app.token, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(12000),
    })
    const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; error?: string }
    if (!response.ok || !payload.access_token) throw new Error(payload.error || 'token')
    saveLink({
      organizationId: saved.organizationId,
      provider: saved.provider,
      kind: 'oauth',
      url: app.token,
      token: JSON.stringify({ access: payload.access_token, refresh: payload.refresh_token ?? '' }),
      tools: capabilityTools(saved.provider),
      status: 'connected',
    })
    return closePage(true, saved.provider, 'Vous pouvez fermer cette fenêtre. ATLAS a reçu l’autorisation.')
  } catch {
    return closePage(false, saved.provider, 'La connexion n’a pas abouti. Réessayez depuis ATLAS.')
  }
}
