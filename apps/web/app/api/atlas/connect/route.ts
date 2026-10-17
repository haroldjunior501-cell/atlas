import { randomUUID } from 'node:crypto'
import { CONNECTOR_CATALOG, connectorOf } from '@atlas/domain'
import { findLink, linksFor, migrateLinks, publicLink, removeLink, saveLink, saveOauthState } from '@/lib/atlas-mcp-store'
import { allowedMcpUrl, isUnsafeMachine, isWriteTool, mcpInitialize, mcpTools } from '@/lib/atlas-mcp'
import { connectHintOf, connectModeOf, tokenFieldsFor } from '@/lib/atlas-connect-modes'
import { capabilityTools, hubUrlFor, isOauthProvider, oauthAuthorizeUrl, oauthCredentials } from '@/lib/atlas-oauth'
import { serverEnv } from '@/lib/server-env'
import { readOauthApps, writeOauthApps } from '@/lib/oauth-apps-store'
import {
  gatewayInvoke,
  gatewayToolsForOrg,
  previewSensitiveAction,
} from '@/lib/atlas-mcp-gateway'
import { oauthCallbackUrl, publicOrigin } from '@/lib/public-origin'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const organizationId = url.searchParams.get('organizationId')?.trim() ?? ''
  if (!organizationId) return Response.json({ error: 'organisation' }, { status: 400 })
  const links = linksFor(organizationId)
  const tools = gatewayToolsForOrg(organizationId)
  return Response.json({
    links,
    /** MCP-style tool list for the vocal LLM — names/descriptions only, never tokens. */
    tools,
    gateway: {
      role: 'mcp-gateway',
      layers: ['oauth-ui', 'atlas-logic', 'external-tool'],
      hub: Boolean(process.env.ATLAS_MCP_HUB_URL),
    },
    catalog: CONNECTOR_CATALOG.map((item) => ({
      ...item,
      linked: links.find((link) => link.provider === item.provider && link.status === 'connected') ?? null,
    })),
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    intent?: string
    organizationId?: string
    provider?: string
    from?: string
    url?: string
    token?: string
    tool?: string
    input?: Record<string, unknown> | string
    confirm?: boolean
    secrets?: Record<string, string>
  } | null
  const intent = body?.intent ?? 'authorize'
  const organizationId = body?.organizationId?.trim() ?? ''
  const provider = body?.provider?.trim() ?? ''

  if (intent === 'tools') {
    if (!organizationId) return Response.json({ error: 'organisation' }, { status: 400 })
    return Response.json({
      ok: true,
      tools: gatewayToolsForOrg(organizationId),
      links: linksFor(organizationId),
    })
  }

  if (intent === 'migrate') {
    const from = String(body?.from || '').trim()
    if (!organizationId || !from) return Response.json({ error: 'migration : from + organizationId requis' }, { status: 400 })
    return Response.json({ ok: true, links: migrateLinks(from, organizationId) })
  }

  if (!organizationId || !provider) return Response.json({ error: 'organisation ou outil manquant' }, { status: 400 })

  if (intent === 'unlink') {
    removeLink(organizationId, provider)
    return Response.json({ ok: true, links: linksFor(organizationId) })
  }

  if (intent === 'invoke') {
    const link = findLink(organizationId, provider)
    if (!link || link.status !== 'connected') {
      const tool = connectorOf(provider)
      return Response.json({
        ok: false,
        error: `${tool?.label ?? 'Cet outil'} n’est pas encore relié. Cliquez sur Relier.`,
      }, { status: 409 })
    }
    const toolName = (body?.tool ?? link.tools[0]?.name ?? '').trim()
    if (!toolName) return Response.json({ error: 'aucun outil disponible' }, { status: 400 })
    const rawInput = body?.input
    const blob = `${toolName} ${typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput ?? {})}`
    if ((provider === 'machine' || provider === 'filesystem') && isUnsafeMachine(blob)) {
      return Response.json({ error: 'Cette commande machine est refusée (sandbox).' }, { status: 403 })
    }
    if (isWriteTool(toolName, blob) && !body?.confirm) {
      return Response.json({
        ok: false,
        requiresApproval: true,
        preview: previewSensitiveAction(provider, toolName, rawInput),
        tool: toolName,
        ask: 'Confirmez vocalement ou dans Approbations avant d’exécuter.',
      })
    }
    const executed = await gatewayInvoke(organizationId, provider, toolName, rawInput)
    if (!executed.ok) {
      return Response.json({ ok: false, error: executed.error, tool: executed.tool }, { status: 502 })
    }
    return Response.json({ ok: true, result: executed.result, tool: executed.tool })
  }

  if (intent === 'link') {
    const url = body?.url?.trim() ?? ''
    if (!allowedMcpUrl(url)) return Response.json({ error: 'Adresse de serveur invalide.' }, { status: 400 })
    return connectHub(organizationId, provider, url, body?.token)
  }

  if (intent === 'token') {
    const secrets = body?.secrets ?? {}
    const fields = tokenFieldsFor(provider)
    const patch: Record<string, string> = {}
    for (const field of fields) {
      const value = String(secrets[field.key] ?? '').trim()
      if (!value) {
        return Response.json({ error: `Champ requis : ${field.label}` }, { status: 400 })
      }
      patch[field.key] = value
      process.env[field.key] = value
    }
    writeOauthApps(patch)
    const saved = saveLink({
      organizationId,
      provider,
      kind: 'oauth',
      url: `token://${provider}`,
      token: JSON.stringify({ grant: 'api_key', keys: Object.keys(patch) }),
      tools: capabilityTools(provider),
      status: 'connected',
    })
    return Response.json({ ok: true, method: 'connected', link: publicLink(saved), links: linksFor(organizationId) })
  }

  // URL MCP spécifique au provider uniquement (pas le hub global — sinon ça court-circuite OAuth / tokens).
  const specificHub = serverEnv(`ATLAS_MCP_${provider.toUpperCase()}_URL`)
  if (specificHub && allowedMcpUrl(specificHub)) {
    return connectHub(organizationId, provider, specificHub, body?.token)
  }

  const mode = connectModeOf(provider)

  if (mode === 'desktop' || (mode === 'oauth' && isOauthProvider(provider))) {
    const nonce = randomUUID()
    saveOauthState({ nonce, organizationId, provider })
    if (mode === 'oauth' && isOauthProvider(provider)) {
      const { id } = oauthCredentials(provider)
      if (!id) {
        return Response.json({
          ok: false,
          method: 'setup',
          setup: 'oauth',
          provider,
          hint: connectHintOf(provider, 'oauth'),
          envKeys: [oauthCredentials(provider).app.idEnv, oauthCredentials(provider).app.secretEnv],
          links: linksFor(organizationId),
        }, { status: 409 })
      }
      return Response.json({
        ok: true,
        method: 'oauth',
        startUrl: oauthAuthorizeUrl(provider, id, oauthCallbackUrl(request), nonce),
      })
    }
    return Response.json({
      ok: true,
      method: 'oauth',
      startUrl: `${publicOrigin(request)}/api/atlas/oauth/start?state=${encodeURIComponent(nonce)}`,
    })
  }

  if (mode === 'token') {
    const fields = tokenFieldsFor(provider)
    const stored = readOauthApps()
    const missing = fields.filter((field) => !String(serverEnv(field.key) || stored[field.key] || '').trim())
    if (!missing.length) {
      const saved = saveLink({
        organizationId,
        provider,
        kind: 'oauth',
        url: `token://${provider}`,
        token: JSON.stringify({ grant: 'api_key', keys: fields.map((f) => f.key) }),
        tools: capabilityTools(provider),
        status: 'connected',
      })
      return Response.json({ ok: true, method: 'connected', link: publicLink(saved), links: linksFor(organizationId) })
    }
    return Response.json({
      ok: false,
      method: 'setup',
      setup: 'token',
      provider,
      hint: connectHintOf(provider, 'token'),
      fields,
      links: linksFor(organizationId),
    }, { status: 409 })
  }

  // MCP — hub global uniquement pour les providers sans OAuth/token natif
  const hub = hubUrlFor(provider)
  if (hub && allowedMcpUrl(hub)) {
    return connectHub(organizationId, provider, hub, body?.token)
  }

  return Response.json({
    ok: false,
    method: 'setup',
    setup: 'mcp',
    provider,
    hint: connectHintOf(provider, 'mcp'),
    fields: [
      { key: 'url', label: 'URL MCP', placeholder: 'https://…/mcp' },
      { key: 'token', label: 'Token Bearer (optionnel)', placeholder: 'optionnel', secret: true },
    ],
    links: linksFor(organizationId),
  }, { status: 409 })
}

async function connectHub(organizationId: string, provider: string, url: string, token?: string) {
  try {
    await mcpInitialize(url, token)
    const tools = await mcpTools(url, token)
    const saved = saveLink({
      organizationId,
      provider,
      kind: provider === 'n8n' || /n8n/i.test(url) ? 'n8n' : 'mcp',
      url,
      token: token?.trim() ?? '',
      tools: tools.length ? tools : capabilityTools(provider),
      status: 'connected',
    })
    return Response.json({ ok: true, method: 'connected', link: publicLink(saved), links: linksFor(organizationId) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'connexion impossible'
    const saved = saveLink({
      organizationId,
      provider,
      kind: 'mcp',
      url,
      token: token?.trim() ?? '',
      tools: [],
      status: 'error',
      error: message,
    })
    return Response.json({ ok: false, error: 'La connexion n’a pas abouti. Réessayez.', link: publicLink(saved), links: linksFor(organizationId) }, { status: 502 })
  }
}
