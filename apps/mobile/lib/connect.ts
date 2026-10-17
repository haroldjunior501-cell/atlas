import { webOrigin } from './config'
import { currentUserId } from './session'

export type ConnectLink = {
  id: string
  organizationId: string
  provider: string
  kind: string
  status: 'connected' | 'error'
  error?: string
}

export type ConnectField = {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
}

export type AuthorizeResult = {
  ok: boolean
  method?: 'oauth' | 'connected' | 'setup'
  startUrl?: string
  setup?: 'oauth' | 'token' | 'mcp'
  hint?: string
  fields?: ConnectField[]
  envKeys?: string[]
  error?: string
  links?: ConnectLink[]
}

async function headers() {
  const userId = (await currentUserId()) || 'harold'
  return {
    'content-type': 'application/json',
    'x-atlas-user': userId,
  }
}

export async function fetchConnectLinks(organizationId: string) {
  const response = await fetch(
    `${webOrigin}/api/atlas/connect?organizationId=${encodeURIComponent(organizationId)}`,
    { headers: await headers(), signal: AbortSignal.timeout(12000) },
  )
  const body = (await response.json().catch(() => ({}))) as {
    links?: ConnectLink[]
    error?: string
  }
  if (!response.ok) throw new Error(body.error || 'Impossible de lire les connexions.')
  return body.links || []
}

export async function authorizeConnect(organizationId: string, provider: string) {
  const response = await fetch(`${webOrigin}/api/atlas/connect`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ intent: 'authorize', organizationId, provider }),
    signal: AbortSignal.timeout(20000),
  })
  const body = (await response.json().catch(() => ({}))) as AuthorizeResult
  return { ...body, ok: Boolean(body.ok) || body.method === 'setup' || Boolean(body.startUrl) }
}

export async function saveConnectToken(
  organizationId: string,
  provider: string,
  secrets: Record<string, string>,
) {
  const response = await fetch(`${webOrigin}/api/atlas/connect`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ intent: 'token', organizationId, provider, secrets }),
    signal: AbortSignal.timeout(20000),
  })
  const body = (await response.json().catch(() => ({}))) as AuthorizeResult & { error?: string }
  if (!response.ok || !body.ok) throw new Error(body.error || 'Token refusé.')
  return body
}

export async function saveConnectMcp(
  organizationId: string,
  provider: string,
  url: string,
  token?: string,
) {
  const response = await fetch(`${webOrigin}/api/atlas/connect`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ intent: 'link', organizationId, provider, url, token }),
    signal: AbortSignal.timeout(20000),
  })
  const body = (await response.json().catch(() => ({}))) as AuthorizeResult & { error?: string }
  if (!response.ok || !body.ok) throw new Error(body.error || 'URL MCP refusée.')
  return body
}

export async function unlinkConnect(organizationId: string, provider: string) {
  const response = await fetch(`${webOrigin}/api/atlas/connect`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ intent: 'unlink', organizationId, provider }),
    signal: AbortSignal.timeout(12000),
  })
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; links?: ConnectLink[]; error?: string }
  if (!response.ok) throw new Error(body.error || 'Déconnexion impossible.')
  return body.links || []
}

export function linkedProvidersOf(links: ConnectLink[]) {
  return new Set(links.filter((link) => link.status === 'connected').map((link) => link.provider))
}
