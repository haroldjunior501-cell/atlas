import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  ZTC_DEVOID_API,
  ZTC_DESKS,
  ZTC_SUPPORT_DEPARTMENT,
  deskMayUseDevoidTool,
  isZtcSupportAgent,
  ztcDeskForService,
  ztcDevoidToolsOf,
  ztcPickSupportAssignee,
  ztcSpecialistDeskOf,
  ztcSupportDepartmentAgents,
} from '@atlas/domain'
import { serverEnv } from './server-env'

/**
 * Pont DEVOID ↔ département Support.
 * Flux : client → DEVOID → attribue à un agent Support (Nova…) →
 * spécialiste métier (Lyra/Vega…) en collab → reply → DEVOID → client.
 */

export type SupportTicketStatus = 'open' | 'working' | 'answered' | 'closed'

export type SupportTicket = {
  id: string
  sessionId: string
  clientName?: string
  clientEmail?: string
  page?: string
  service?: string
  question: string
  status: SupportTicketStatus
  /** Agent Support assigné (département Support). */
  desk: string
  /** Département propriétaire — toujours Support. */
  department: string
  /** Agent Support destinataire (même que desk en général). */
  assignedTo: string
  /** Spécialiste métier collab (Lyra, Vega…) — hors Support OK. */
  specialistDesk?: string
  /** Accueil Support. */
  intakeDesk: string
  createdAt: string
  updatedAt: string
  answer?: string
  answeredAt?: string
  answeredBy?: string
  pushedToDevoid?: boolean
  notes?: string[]
}

function storePath() {
  const override = process.env.ZTC_SUPPORT_TICKETS_PATH?.trim()
  if (override) return override
  const candidates = [
    join(process.cwd(), 'data', 'ztc-support-tickets.json'),
    join(process.cwd(), '..', '..', 'data', 'ztc-support-tickets.json'),
  ]
  return candidates.find((item) => existsSync(dirname(item))) ?? candidates[0]!
}

function readTickets(): SupportTicket[] {
  const path = storePath()
  if (!existsSync(path)) return []
  try {
    const rows = JSON.parse(readFileSync(path, 'utf8')) as SupportTicket[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function writeTickets(rows: SupportTicket[]) {
  const path = storePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(rows.slice(-200), null, 2))
}

function newId() {
  return `tkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function devoidBase() {
  return (serverEnv('ZTC_DEVOID_URL') || ZTC_DEVOID_API).replace(/\/$/, '')
}

function devoidHeaders() {
  const token = (serverEnv('ZTC_DEVOID_TOKEN') || '').trim()
  return {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }
}

function knownDesk(name?: string | null) {
  const n = (name || '').trim()
  if (!n) return undefined
  return ZTC_DESKS.find((d) => d.firstName.toLowerCase() === n.toLowerCase())?.firstName
}

/** Spécialiste métier (DNS/hébergement…) — collab, pas forcément Support. */
export function resolveSpecialistDesk(input: {
  text: string
  specialistDesk?: string
  service?: string
}) {
  const specialist = knownDesk(input.specialistDesk)
  if (specialist && specialist !== 'Devoid') return specialist
  const fromService = ztcDeskForService(input.service)?.firstName
  if (fromService) return fromService
  return ztcSpecialistDeskOf(input.text)?.firstName || 'Nova'
}

/** Agent du département Support à qui DEVOID attribue le ticket. */
export function resolveSupportAssignee(input: {
  text?: string
  desk?: string
  availableSupportAgents?: Array<{ firstName: string; department?: string | null }>
}) {
  const explicit = knownDesk(input.desk)
  if (explicit && isZtcSupportAgent(explicit) && explicit !== 'Devoid') return explicit
  return ztcPickSupportAssignee(input.text || '', input.availableSupportAgents)
}

/** @deprecated alias — préfère resolveSpecialistDesk / resolveSupportAssignee */
export function resolveSupportDesk(input: {
  text: string
  desk?: string
  specialistDesk?: string
  service?: string
}) {
  return resolveSpecialistDesk(input)
}

/** Pousse la réponse Support vers DEVOID pour qu’il la dise au client. */
export async function pushReplyToDevoid(ticket: SupportTicket) {
  const payload = {
    type: 'support_reply',
    ticketId: ticket.id,
    sessionId: ticket.sessionId,
    question: ticket.question,
    answer: ticket.answer,
    answeredBy: ticket.answeredBy || ticket.desk || 'Nova',
    answeredAt: ticket.answeredAt,
  }
  const paths = ['/v1/support/reply', '/operator/reply', '/chat/support-reply', '/support/reply']
  const base = devoidBase()
  for (const path of paths) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: devoidHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) return { ok: true as const, endpoint: path }
    } catch { /* essai suivant */ }
  }
  return { ok: false as const, endpoint: null, note: 'Réponse stockée pour pull DEVOID (endpoint reply indisponible).' }
}

export type EscalateInput = {
  text: string
  sessionId?: string
  clientName?: string
  clientEmail?: string
  page?: string
  desk?: string
  specialistDesk?: string
  service?: string
  serviceLabel?: string
  availableSupportAgents?: Array<{ firstName: string; department?: string | null }>
}

/** DEVOID attribue la demande à un agent du département Support. */
export function ztcEscalate(input: EscalateInput) {
  const question = String(input.text || '').replace(/\s+/g, ' ').trim()
  if (question.length < 3) throw new Error('Question trop courte pour escalader.')
  const sessionId = String(input.sessionId || `sess_${Date.now().toString(36)}`).slice(0, 80)
  const assignedTo = resolveSupportAssignee({
    text: question,
    desk: input.desk,
    availableSupportAgents: input.availableSupportAgents,
  })
  const specialistDesk = resolveSpecialistDesk({
    text: question,
    specialistDesk: input.specialistDesk,
    service: input.service || input.page,
  })
  const now = new Date().toISOString()
  const serviceNote = input.serviceLabel || input.service || input.page
  const ticket: SupportTicket = {
    id: newId(),
    sessionId,
    clientName: input.clientName?.trim().slice(0, 80) || undefined,
    clientEmail: input.clientEmail?.trim().slice(0, 120) || undefined,
    page: input.page?.trim().slice(0, 200) || undefined,
    service: (input.service || input.page || undefined)?.slice(0, 80),
    question: question.slice(0, 2000),
    status: 'open',
    desk: assignedTo,
    department: ZTC_SUPPORT_DEPARTMENT,
    assignedTo,
    specialistDesk: specialistDesk !== assignedTo ? specialistDesk : undefined,
    intakeDesk: 'Nova',
    createdAt: now,
    updatedAt: now,
    notes: [
      'Escaladé depuis DEVOID',
      `Attribué à ${assignedTo} (département ${ZTC_SUPPORT_DEPARTMENT})`,
      specialistDesk && specialistDesk !== assignedTo
        ? `Collab spécialiste : ${specialistDesk}${serviceNote ? ` (${serviceNote})` : ''}`
        : 'Support général',
    ],
  }
  const rows = readTickets()
  rows.push(ticket)
  writeTickets(rows)
  return {
    ok: true,
    ticket,
    department: ZTC_SUPPORT_DEPARTMENT,
    assignedTo,
    routedTo: assignedTo,
    specialistDesk: ticket.specialistDesk,
    intakeDesk: 'Nova',
    supportAgents: ztcSupportDepartmentAgents(),
    clientMessage:
      `Votre demande a été transmise au département Support (${assignedTo}).`
      + (ticket.specialistDesk ? ` Collab : ${ticket.specialistDesk}.` : '')
      + ' DEVOID vous répondra dès qu’une réponse sera prête.',
    atlasHint: `Support/${assignedTo}${ticket.specialistDesk ? ` + ${ticket.specialistDesk}` : ''} : ticket ${ticket.id} — « ${ticket.question.slice(0, 100)} »`,
  }
}

/**
 * Réattribue un ticket à un autre agent du département Support.
 * Pour un spécialiste hors Support (Lyra/Vega…), utilise specialistDesk.
 */
export function ztcAssignSupportAgent(input: {
  ticketId?: string
  sessionId?: string
  desk: string
  note?: string
  assignedBy?: string
  availableSupportAgents?: Array<{ firstName: string; department?: string | null }>
}) {
  const target = knownDesk(input.desk) || input.desk.trim()
  const allowedLive = (input.availableSupportAgents || [])
    .filter((agent) => /support/i.test(agent.department || ''))
    .map((agent) => agent.firstName.toLowerCase())
  const okSupport = isZtcSupportAgent(target)
    || allowedLive.includes(target.toLowerCase())
  if (!okSupport || /^devoid$/i.test(target)) {
    throw new Error(
      `L’agent « ${input.desk} » n’est pas dans le département Support. `
      + `Agents Support : ${ztcSupportDepartmentAgents().filter((n) => n !== 'Devoid').join(', ')}. `
      + 'Pour un spécialiste (Lyra, Vega…), utilisez op=route avec specialistDesk.',
    )
  }
  const rows = readTickets()
  const index = rows.findIndex((row) =>
    (input.ticketId && row.id === input.ticketId)
    || (input.sessionId && row.sessionId === input.sessionId && row.status !== 'closed' && row.status !== 'answered'),
  )
  if (index < 0) throw new Error('Ticket introuvable. Indiquez ticketId ou sessionId.')
  const now = new Date().toISOString()
  const prev = rows[index]!
  const by = (input.assignedBy || 'Nova').slice(0, 40)
  const canonical = knownDesk(target) || target
  const ticket: SupportTicket = {
    ...prev,
    desk: canonical,
    assignedTo: canonical,
    department: ZTC_SUPPORT_DEPARTMENT,
    intakeDesk: prev.intakeDesk || 'Nova',
    status: prev.status === 'answered' ? prev.status : 'working',
    updatedAt: now,
    notes: [
      ...(prev.notes || []),
      `${by} a attribué à ${canonical} (Support)${input.note ? ` — ${input.note.slice(0, 200)}` : ''} (${now})`,
    ],
  }
  rows[index] = ticket
  writeTickets(rows)
  return {
    ok: true,
    ticket,
    assignedTo: canonical,
    department: ZTC_SUPPORT_DEPARTMENT,
    atlasHint: `Ticket ${ticket.id} → Support/${canonical}`,
  }
}

/** Nova / Support pose un spécialiste collab (Lyra, Vega…) ou réassigne dans Support. */
export function ztcRouteTicket(input: {
  ticketId?: string
  sessionId?: string
  desk: string
  note?: string
  routedBy?: string
  availableSupportAgents?: Array<{ firstName: string; department?: string | null }>
}) {
  const target = knownDesk(input.desk)
  if (!target) throw new Error(`Bureau inconnu : ${input.desk}. Ex. Nova, Lyra, Vega, Echo, Ledger.`)

  // Si cible = Support → vraie réattribution
  if (isZtcSupportAgent(target) && target !== 'Devoid') {
    return ztcAssignSupportAgent({
      ticketId: input.ticketId,
      sessionId: input.sessionId,
      desk: target,
      note: input.note,
      assignedBy: input.routedBy,
      availableSupportAgents: input.availableSupportAgents,
    })
  }

  const rows = readTickets()
  const index = rows.findIndex((row) =>
    (input.ticketId && row.id === input.ticketId)
    || (input.sessionId && row.sessionId === input.sessionId && row.status !== 'closed' && row.status !== 'answered'),
  )
  if (index < 0) throw new Error('Ticket introuvable. Indiquez ticketId ou sessionId.')
  const now = new Date().toISOString()
  const prev = rows[index]!
  const by = (input.routedBy || prev.assignedTo || 'Nova').slice(0, 40)
  const ticket: SupportTicket = {
    ...prev,
    department: prev.department || ZTC_SUPPORT_DEPARTMENT,
    assignedTo: prev.assignedTo || prev.desk || 'Nova',
    desk: prev.assignedTo || prev.desk || 'Nova',
    specialistDesk: target,
    intakeDesk: prev.intakeDesk || 'Nova',
    status: prev.status === 'answered' ? prev.status : 'working',
    updatedAt: now,
    notes: [
      ...(prev.notes || []),
      `${by} a demandé collab ${target}${input.note ? ` — ${input.note.slice(0, 200)}` : ''} (${now})`,
    ],
  }
  rows[index] = ticket
  writeTickets(rows)
  return {
    ok: true,
    ticket,
    routedTo: ticket.assignedTo,
    specialistDesk: target,
    department: ZTC_SUPPORT_DEPARTMENT,
    atlasHint: `Ticket ${ticket.id} Support/${ticket.assignedTo} + collab ${target}`,
  }
}

export type ReplyInput = {
  ticketId?: string
  sessionId?: string
  text: string
  answeredBy?: string
}

/** Spécialiste / Nova répond → ATLAS pousse vers DEVOID. */
export async function ztcSupportReply(input: ReplyInput) {
  const answer = String(input.text || '').replace(/\s+/g, ' ').trim()
  if (answer.length < 2) throw new Error('Réponse trop courte.')
  const rows = readTickets()
  const index = rows.findIndex((row) =>
    (input.ticketId && row.id === input.ticketId)
    || (input.sessionId && row.sessionId === input.sessionId && row.status !== 'closed'),
  )
  if (index < 0) throw new Error('Ticket introuvable. Indiquez ticketId ou sessionId.')
  const now = new Date().toISOString()
  const owner = rows[index]!.desk || 'Nova'
  const ticket: SupportTicket = {
    ...rows[index]!,
    answer: answer.slice(0, 4000),
    answeredAt: now,
    answeredBy: (input.answeredBy || owner).slice(0, 40),
    status: 'answered',
    updatedAt: now,
    notes: [...(rows[index]!.notes || []), `Réponse ${input.answeredBy || owner} ${now}`],
  }
  const pushed = await pushReplyToDevoid(ticket)
  ticket.pushedToDevoid = pushed.ok
  rows[index] = ticket
  writeTickets(rows)
  return {
    ok: true,
    ticket,
    pushedToDevoid: pushed.ok,
    devoidEndpoint: pushed.endpoint,
    note: pushed.ok
      ? 'Réponse poussée à DEVOID — le chat client peut la restituer.'
      : ('note' in pushed ? pushed.note : 'Réponse prête pour pull DEVOID.'),
    clientFacing: ticket.answer,
  }
}

/** DEVOID tire les réponses Support en attente pour une session. */
export function ztcPullSupportReplies(sessionId?: string, ticketId?: string) {
  const rows = readTickets()
  const pending = rows.filter((row) => {
    if (row.status !== 'answered' || !row.answer) return false
    if (ticketId) return row.id === ticketId
    if (sessionId) return row.sessionId === sessionId
    return !row.pushedToDevoid
  })
  return {
    ok: true,
    replies: pending.map((row) => ({
      ticketId: row.id,
      sessionId: row.sessionId,
      question: row.question,
      answer: row.answer,
      answeredBy: row.answeredBy,
      answeredAt: row.answeredAt,
      desk: row.desk,
    })),
  }
}

export function ztcListSupportTickets(status?: SupportTicketStatus | 'all') {
  const rows = readTickets().slice().reverse()
  const filtered = !status || status === 'all'
    ? rows
    : rows.filter((row) => row.status === status)
  return {
    ok: true,
    count: filtered.length,
    open: rows.filter((row) => row.status === 'open' || row.status === 'working').length,
    tickets: filtered.slice(0, 50),
  }
}

export function ztcMarkTicketWorking(ticketId: string) {
  const rows = readTickets()
  const index = rows.findIndex((row) => row.id === ticketId)
  if (index < 0) throw new Error('Ticket introuvable.')
  rows[index] = {
    ...rows[index]!,
    status: 'working',
    updatedAt: new Date().toISOString(),
  }
  writeTickets(rows)
  return { ok: true, ticket: rows[index] }
}

/** Exécute un outil DEVOID au nom d’un bureau ATLAS (mêmes outils que /health). */
export async function ztcInvokeDevoidTool(input: {
  desk: string
  tool: string
  customerId?: string
  args?: Record<string, unknown>
}) {
  const desk = (input.desk || 'Nova').trim()
  const tool = (input.tool || '').trim()
  if (!tool) throw new Error('tool requis (ex. list_dns_records, prepare_purchase_hosting).')
  if (!deskMayUseDevoidTool(desk, tool)) {
    throw new Error(
      `${desk} n’a pas l’outil ${tool}. Autorisés : ${ztcDevoidToolsOf(desk).slice(0, 12).join(', ')}…`,
    )
  }
  const customerId = String(input.customerId || '').trim()
  const args = { ...(input.args || {}) }
  if (customerId && !args.customer_id) args.customer_id = customerId

  const base = devoidBase()
  const payload = {
    desk,
    tool,
    customerId: customerId || undefined,
    args,
  }
  const paths = ['/v1/atlas/tool', '/atlas/tool', '/v1/tools/run']
  for (const path of paths) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: devoidHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        return { ok: true as const, desk, tool, endpoint: path, result: data }
      }
      if (response.status !== 404) {
        return {
          ok: false as const,
          desk,
          tool,
          endpoint: path,
          error: typeof data === 'object' && data && 'detail' in data
            ? String((data as { detail: unknown }).detail)
            : `HTTP ${response.status}`,
          result: data,
        }
      }
    } catch { /* try next */ }
  }

  // Fallback : demander à /operator d’exécuter l’outil nommé
  if (!customerId) {
    throw new Error('customerId requis pour exécuter un outil DEVOID (ou déployer /v1/atlas/tool).')
  }
  try {
    const response = await fetch(`${base}/operator`, {
      method: 'POST',
      headers: devoidHeaders(),
      body: JSON.stringify({
        customer_id: customerId,
        message: [
          `ATLAS desk=${desk} exécute l’outil DEVOID « ${tool} ».`,
          `Arguments JSON: ${JSON.stringify(args)}`,
          'Utilise uniquement cet outil, puis résume le résultat factuel.',
        ].join(' '),
      }),
      signal: AbortSignal.timeout(60000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : `HTTP ${response.status}`)
    }
    return { ok: true as const, desk, tool, endpoint: '/operator', result: data }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invocation DEVOID impossible')
  }
}
