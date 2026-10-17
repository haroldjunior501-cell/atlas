import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface StoredLink {
  id: string
  organizationId: string
  provider: string
  kind: 'mcp' | 'n8n' | 'oauth'
  url: string
  token: string
  tools: Array<{ name: string; description: string }>
  status: 'connected' | 'error'
  error?: string
  updatedAt: string
}

export interface PublicLink {
  id: string
  organizationId: string
  provider: string
  kind: 'mcp' | 'n8n' | 'oauth'
  url: string
  tools: Array<{ name: string; description: string }>
  status: 'connected' | 'error'
  error?: string
  updatedAt: string
}

function filePath() {
  const candidates = [
    join(process.cwd(), 'data', 'atlas-connect.json'),
    join(process.cwd(), '..', '..', 'data', 'atlas-connect.json'),
  ]
  return candidates.find((item) => existsSync(dirname(item))) ?? candidates[0]
}

function readAll(): StoredLink[] {
  const path = filePath()
  if (!existsSync(path)) return []
  try {
    const body = JSON.parse(readFileSync(path, 'utf8')) as { connections?: StoredLink[] }
    return body.connections ?? []
  } catch {
    return []
  }
}

function writeAll(connections: StoredLink[]) {
  const path = filePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ connections }, null, 2))
}

export function publicLink(link: StoredLink): PublicLink {
  return {
    id: link.id,
    organizationId: link.organizationId,
    provider: link.provider,
    kind: link.kind,
    url: '',
    tools: link.tools,
    status: link.status,
    error: link.error,
    updatedAt: link.updatedAt,
  }
}

export function linksFor(organizationId: string): PublicLink[] {
  return readAll().filter((item) => item.organizationId === organizationId).map(publicLink)
}

export function findLink(organizationId: string, provider: string): StoredLink | null {
  return readAll().find((item) => item.organizationId === organizationId && item.provider === provider) ?? null
}

export function saveLink(link: Omit<StoredLink, 'id' | 'updatedAt'> & { id?: string }): StoredLink {
  const connections = readAll()
  const current = connections.find((item) => item.organizationId === link.organizationId && item.provider === link.provider)
  const next: StoredLink = {
    ...link,
    id: current?.id ?? link.id ?? randomUUID(),
    updatedAt: new Date().toISOString(),
  }
  writeAll([...connections.filter((item) => item.id !== next.id && !(item.organizationId === next.organizationId && item.provider === next.provider)), next])
  return next
}

export function removeLink(organizationId: string, provider: string) {
  writeAll(readAll().filter((item) => !(item.organizationId === organizationId && item.provider === provider)))
}

/** Copie les outils reliés d’un espace perso vers une organisation créée plus tard. */
export function migrateLinks(fromOrganizationId: string, toOrganizationId: string): PublicLink[] {
  if (!fromOrganizationId || !toOrganizationId || fromOrganizationId === toOrganizationId) {
    return linksFor(toOrganizationId)
  }
  const all = readAll()
  const source = all.filter((item) => item.organizationId === fromOrganizationId)
  let next = [...all]
  for (const link of source) {
    const existing = next.find((item) => item.organizationId === toOrganizationId && item.provider === link.provider)
    if (existing?.status === 'connected') continue
    const migrated: StoredLink = {
      ...link,
      id: existing?.id ?? randomUUID(),
      organizationId: toOrganizationId,
      updatedAt: new Date().toISOString(),
    }
    next = next.filter((item) => !(item.organizationId === toOrganizationId && item.provider === link.provider))
    next.push(migrated)
  }
  writeAll(next)
  return linksFor(toOrganizationId)
}

interface OauthState {
  nonce: string
  organizationId: string
  provider: string
  at: number
}

function oauthPath() {
  const candidates = [
    join(process.cwd(), 'data', 'atlas-oauth.json'),
    join(process.cwd(), '..', '..', 'data', 'atlas-oauth.json'),
  ]
  return candidates.find((item) => existsSync(dirname(item))) ?? candidates[0]
}

function readOauth(): OauthState[] {
  const path = oauthPath()
  if (!existsSync(path)) return []
  try {
    return (JSON.parse(readFileSync(path, 'utf8')) as { states?: OauthState[] }).states ?? []
  } catch {
    return []
  }
}

function writeOauth(states: OauthState[]) {
  const path = oauthPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ states }, null, 2))
}

export function saveOauthState(state: Omit<OauthState, 'at'>) {
  const next = { ...state, at: Date.now() }
  writeOauth([...readOauth().filter((item) => item.nonce !== next.nonce && Date.now() - item.at < 900000), next])
  return next.nonce
}

export function peekOauthState(nonce: string): OauthState | null {
  return readOauth().find((item) => item.nonce === nonce) ?? null
}

export function takeOauthState(nonce: string): OauthState | null {
  const states = readOauth()
  const found = states.find((item) => item.nonce === nonce) ?? null
  writeOauth(states.filter((item) => item.nonce !== nonce && Date.now() - item.at < 900000))
  return found
}
