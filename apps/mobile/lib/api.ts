import { gatewayUrl, webOrigin } from './config'
import { currentUserId } from './session'

export { gatewayUrl, webOrigin }

/** Portraits locaux (web /public) → URL absolue pour React Native. */
export function faceUrl(face?: string | null) {
  const raw = String(face || '').trim()
  if (!raw || /dicebear|lorelei/i.test(raw)) return undefined
  if (/^https?:\/\//i.test(raw)) return raw
  return `${webOrigin}${raw.startsWith('/') ? raw : `/${raw}`}`
}

export type Decision = {
  id: string
  title: string
  summary: string
  status: string
  risk?: string
  amount?: number | null
  requestedByAgentId?: string
}

export type Agent = {
  id: string
  firstName: string
  lastName: string
  role: string
  mission?: string
  presence?: string
  departmentId?: string
  avatar?: { face?: string; voiceId?: string }
}

export type Chart = {
  organization: { id: string; name: string; objective?: string | null } | null
  agents?: Agent[]
  departments?: Array<{ id: string; name: string }>
  decisions?: Decision[]
  meetings?: Array<{ id: string; title: string; startsAt: string }>
}

export type Pulse = {
  agents: number
  activeAgents: number
  openTasks: number
  pendingDecisions: number
}

export async function gateway<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = (await currentUserId()) || 'harold'
  const response = await fetch(`${gatewayUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-atlas-user': userId,
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `Gateway ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function fetchLatestChart(): Promise<Chart> {
  return gateway<Chart>('/v1/organizations')
}

export async function fetchApprovals(organizationId: string): Promise<Decision[]> {
  const body = await gateway<{ decisions: Decision[] }>(`/v1/organizations/${organizationId}/approvals`)
  return body.decisions ?? []
}

export async function fetchPulse(organizationId: string): Promise<Pulse> {
  return gateway<Pulse>(`/v1/organizations/${organizationId}/observability`)
}

export async function resolveDecision(id: string, status: 'approved' | 'rejected') {
  return gateway<Decision>(`/v1/approvals/${id}`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export async function fetchBriefing(organizationId: string): Promise<string> {
  const body = await gateway<{ text?: string; reply?: string }>(`/v1/organizations/${organizationId}/voice/briefing`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return body.text || body.reply || 'Briefing indisponible.'
}

export function pendingOnly(decisions: Decision[]) {
  return decisions.filter((item) => item.status === 'pending')
}

export function greetingForNow(name = 'CEO') {
  const hour = new Date().getHours()
  if (hour < 12) return `Bonjour, ${name}.`
  if (hour < 18) return `Bon après-midi, ${name}.`
  return `Bonsoir, ${name}.`
}

export type OrgAgent = {
  id: string
  firstName: string
  lastName: string
  role: string
  department: string
  presence: string
  skills: string[]
  workflow: string
  ring: string | null
  face?: string
}

export type OrgChatTurn = {
  id: string
  role: 'user' | 'agent'
  text: string
  at: string
}

export type OrgBoard = {
  organization: { id: string; name: string; objective?: string | null }
  agents: OrgAgent[]
  departments: Array<{ id: string; name: string }>
  pulse: { openTasks: number; activeAgents: number; pendingDecisions: number }
  product: {
    sku: number
    devoid?: boolean
    model?: string
    drift?: string[]
    speed?: Array<{ path: string; ttfbMs: number; ok: boolean }>
  } | null
}

export async function fetchOrgBoard(): Promise<OrgBoard> {
  const userId = (await currentUserId()) || 'harold'
  const response = await fetch(`${webOrigin}/api/atlas/mobile-org`, {
    headers: { 'x-atlas-user': userId },
  })
  const body = await response.json() as OrgBoard & { error?: string }
  if (!response.ok) throw new Error(body.error || 'Organisation indisponible')
  return body
}

export async function delegateMission(text: string, agentId?: string, desk?: string, op: 'delegate' | 'ask' | 'chat' | 'report' = 'delegate') {
  const userId = (await currentUserId()) || 'harold'
  const response = await fetch(`${webOrigin}/api/atlas/mobile-org`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-atlas-user': userId },
    body: JSON.stringify({ op, text, agentId, desk }),
  })
  const body = await response.json() as { ok?: boolean; reply?: string; error?: string; agent?: OrgAgent }
  if (!response.ok || !body.reply) throw new Error(body.error || 'Délégation impossible')
  return body as { ok: boolean; reply: string; agent?: OrgAgent }
}

export async function chatWithAgent(text: string, agentId: string) {
  return delegateMission(text, agentId, undefined, 'chat')
}

export async function askAgentReport(agentId: string, focus = 'Donne-moi ton rapport de poste') {
  return delegateMission(focus, agentId, undefined, 'report')
}

export async function fetchAgentThread(agentId: string): Promise<OrgChatTurn[]> {
  const userId = (await currentUserId()) || 'harold'
  const response = await fetch(`${webOrigin}/api/atlas/mobile-org`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-atlas-user': userId },
    body: JSON.stringify({ op: 'thread', agentId }),
  })
  const body = await response.json() as { messages?: OrgChatTurn[]; error?: string }
  if (!response.ok) throw new Error(body.error || 'Fil indisponible')
  return body.messages ?? []
}

export async function fetchOrgBrief() {
  const userId = (await currentUserId()) || 'harold'
  const response = await fetch(`${webOrigin}/api/atlas/mobile-org`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-atlas-user': userId },
    body: JSON.stringify({ op: 'brief' }),
    signal: AbortSignal.timeout(10000),
  })
  const body = await response.json() as { reply?: string; error?: string }
  if (!response.ok || !body.reply) throw new Error(body.error || 'Brief indisponible')
  return body.reply
}
