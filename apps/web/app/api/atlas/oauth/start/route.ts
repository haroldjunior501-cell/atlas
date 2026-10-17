import { connectorOf } from '@atlas/domain'
import { peekOauthState, saveLink, takeOauthState } from '@/lib/atlas-mcp-store'
import { isOauthProvider, oauthAuthorizeUrl, oauthCredentials, organizationGrant } from '@/lib/atlas-oauth'
import { oauthCallbackUrl } from '@/lib/public-origin'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

function page(title: string, body: string, provider = '', ok = false) {
  const payload = JSON.stringify({ type: 'atlas-oauth', ok, provider })
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090f;color:#f4f4f5;font-family:system-ui,sans-serif}
  main{width:min(420px,92vw);padding:28px;border:1px solid #2a2150;border-radius:20px;background:#12101f;text-align:center}
  h1{margin:0 0 8px;font-size:22px} p{color:#a7b0c9;line-height:1.45}
  button{margin-top:16px;padding:10px 16px;border:0;border-radius:10px;background:#6d5efc;color:#fff;font:inherit;cursor:pointer}
  button.ghost{margin-left:8px;background:transparent;color:#d4d4d8;border:1px solid #3f3f46}
</style></head><body><main>${body}</main>
<script>
  const payload = ${payload};
  function done() {
    try { window.opener && window.opener.postMessage(payload, '*'); } catch (err) {}
    window.close();
  }
  if (payload.ok) done();
</script></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function consentPage(provider: string, nonce: string) {
  const item = connectorOf(provider)
  const label = escapeHtml(item?.label ?? provider)
  const caps = escapeHtml((item?.capabilities ?? ['Lire']).join(', '))
  const state = escapeHtml(nonce)
  const desktop = provider === 'machine' || provider === 'filesystem' || provider === 'browser'
  const blurb = desktop
    ? `Autorisez ATLAS à travailler sur <b>cet ordinateur</b> : ouvrir des applications, créer des documents et accéder au Bureau / Documents (sandbox).`
    : `Autorisez ATLAS à utiliser ${label} pour cette organisation : ${caps}.`
  return page('Autoriser', `<h1>Autoriser ${label}</h1>
<p>${blurb}</p>
<p>Vous pourrez détacher l’outil à tout moment.</p>
<form method="post" action="/api/atlas/oauth/start">
  <input type="hidden" name="state" value="${state}">
  <button type="submit">${desktop ? 'Autoriser cet ordinateur' : 'Autoriser'}</button>
  <button class="ghost" type="button" onclick="done()">Fermer</button>
</form>`, provider)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const nonce = url.searchParams.get('state')?.trim() ?? ''
  const saved = nonce ? peekOauthState(nonce) : null
  if (!saved) return page('Connexion', '<h1>Lien expiré</h1><p>Revenez sur ATLAS et cliquez de nouveau sur Relier.</p><button type="button" onclick="done()">Fermer</button>')
  const provider = saved.provider
  if (!connectorOf(provider)) {
    return page('Connexion', '<h1>Outil non disponible</h1><p>Cet outil n’a pas encore de connexion grand public.</p><button type="button" onclick="done()">Fermer</button>', provider)
  }
  if (isOauthProvider(provider)) {
    const { id } = oauthCredentials(provider)
    if (id) {
      const redirect = oauthCallbackUrl(request)
      return Response.redirect(oauthAuthorizeUrl(provider, id, redirect, saved.nonce))
    }
  }
  return consentPage(provider, saved.nonce)
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const nonce = String(form?.get('state') ?? '').trim()
  const saved = nonce ? takeOauthState(nonce) : null
  if (!saved) return page('Connexion', '<h1>Lien expiré</h1><p>Revenez sur ATLAS et cliquez de nouveau sur Relier.</p><button type="button" onclick="done()">Fermer</button>')
  const desktop = saved.provider === 'machine' || saved.provider === 'filesystem' || saved.provider === 'browser'
  if (!desktop) {
    return page(
      'Configuration requise',
      `<h1>Connexion réelle requise</h1><p>Cet outil ne peut plus être « autorisé » sans OAuth / clé API / URL MCP. Fermez et utilisez le formulaire Relier dans ATLAS.</p><button type="button" onclick="done()">Fermer</button>`,
      saved.provider,
    )
  }
  const grant = organizationGrant(saved.provider)
  if (!grant) return page('Connexion', '<h1>Outil non disponible</h1><p>Cet outil n’a pas encore de connexion grand public.</p><button type="button" onclick="done()">Fermer</button>', saved.provider)
  saveLink({ ...grant, organizationId: saved.organizationId })
  const label = escapeHtml(connectorOf(saved.provider)?.label ?? saved.provider)
  return page('Connecté', `<h1>Connecté</h1><p>${label} est relié. Vous pouvez fermer cette fenêtre.</p>`, saved.provider, true)
}
