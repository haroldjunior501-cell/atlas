import { resolveAgentFace, ztcDeskOf, ztcSkillsOf, ztcWorkflowOf, ZTC_DEPARTMENTS } from '@atlas/domain'
import { ztcAssignSupportAgent, ztcListSupportTickets, ztcRouteTicket, ztcSupportReply } from '@/lib/ztc-devoid-bridge'
import { ztcVisitorReport, ztcVisitorSnapshot } from '@/lib/ztc-visitor-flow'
import { deskSnapshot, formatDeskPrompt, ztcInventory } from '@/lib/ztc-live'

export const runtime = 'nodejs'

function gatewayBase() {
  return (process.env.ATLAS_GATEWAY_URL || process.env.NEXT_PUBLIC_ATLAS_GATEWAY_URL || 'http://127.0.0.1:4000').replace(/\/$/, '')
}

type GwAgent = {
  id: string
  firstName: string
  lastName: string
  role: string
  mission?: string
  presence?: string
  departmentId?: string
  skills?: string[]
  avatar?: { face?: string }
}

async function gw<T>(path: string, init?: RequestInit, userId = 'harold'): Promise<T> {
  const response = await fetch(`${gatewayBase()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-atlas-user': userId,
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`gateway ${response.status}`)
  return response.json() as Promise<T>
}

/** Mobile : équipe ZTC, briefing, délégation de missions live. */
export async function GET(request: Request) {
  const userId = request.headers.get('x-atlas-user') || 'harold'
  try {
    const chart = await gw<{
      organization: { id: string; name: string; objective?: string | null }
      agents: GwAgent[]
      departments: Array<{ id: string; name: string }>
    }>('/v1/organizations', undefined, userId)
    const pulse = await gw<{ openTasks: number; activeAgents: number; pendingDecisions: number }>(
      `/v1/organizations/${chart.organization.id}/observability`,
      undefined,
      userId,
    ).catch(() => ({ openTasks: 0, activeAgents: 0, pendingDecisions: 0 }))
    const inventory = await ztcInventory().catch(() => null)
    const agents = (chart.agents ?? []).map((agent) => {
      const skills = agent.skills?.length ? agent.skills : ztcSkillsOf(agent.firstName)
      const dept = chart.departments.find((item) => item.id === agent.departmentId)?.name
        || ZTC_DEPARTMENTS[agent.firstName as keyof typeof ZTC_DEPARTMENTS]
        || ''
      return {
        id: agent.id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        role: agent.role,
        department: dept,
        presence: agent.presence || 'online',
        skills,
        workflow: ztcWorkflowOf(agent.firstName),
        ring: ztcDeskOf(agent.firstName)?.ring ?? null,
        face: resolveAgentFace(agent.firstName, agent.lastName, agent.avatar?.face),
      }
    })
    return Response.json({
      organization: chart.organization,
      departments: chart.departments,
      agents,
      pulse,
      product: inventory
        ? {
            sku: inventory.live.products.length,
            devoid: inventory.live.devoid.ok,
            model: inventory.live.devoid.model,
            drift: inventory.live.drift.slice(0, 3),
            speed: inventory.ops.speed.slice(0, 5),
          }
        : null,
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'org' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const userId = request.headers.get('x-atlas-user') || 'harold'
  const body = await request.json().catch(() => ({})) as {
    op?: string
    agentId?: string
    text?: string
    desk?: string
  }
  const op = body.op || 'brief'
  const extended = body as {
    op?: string
    agentId?: string
    text?: string
    desk?: string
    ticketId?: string
    sessionId?: string
    period?: string
  }

  if (op === 'tickets') {
    return Response.json(ztcListSupportTickets('all'))
  }
  if (op === 'support-reply') {
    try {
      const result = await ztcSupportReply({
        ticketId: extended.ticketId,
        sessionId: extended.sessionId,
        text: (extended.text || '').trim(),
        answeredBy: extended.desk || 'Nova',
      })
      return Response.json({ ok: true, reply: result.note, ...result })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'reply' }, { status: 400 })
    }
  }
  if (op === 'support-route' || op === 'route-ticket') {
    try {
      const result = ztcRouteTicket({
        ticketId: extended.ticketId,
        sessionId: extended.sessionId,
        desk: (extended.desk || '').trim(),
        note: (extended.text || '').trim() || undefined,
        routedBy: 'Nova',
      })
      return Response.json({
        ok: true,
        reply: `Ticket routé vers ${result.routedTo}.`,
        ...result,
      })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'route' }, { status: 400 })
    }
  }
  if (op === 'support-assign' || op === 'assign-ticket') {
    try {
      const supportAgents = (await gw<{
        agents: GwAgent[]
        departments: Array<{ id: string; name: string }>
      }>('/v1/organizations', undefined, userId).catch(() => null))
      const supportDeptIds = new Set(
        (supportAgents?.departments || [])
          .filter((dept) => /support/i.test(dept.name))
          .map((dept) => dept.id),
      )
      const available = (supportAgents?.agents || [])
        .filter((agent) => agent.departmentId && supportDeptIds.has(agent.departmentId))
        .map((agent) => ({ firstName: agent.firstName, department: 'Support' }))
      const result = ztcAssignSupportAgent({
        ticketId: extended.ticketId,
        sessionId: extended.sessionId,
        desk: (extended.desk || '').trim(),
        note: (extended.text || '').trim() || undefined,
        assignedBy: 'Nova',
        availableSupportAgents: available,
      })
      return Response.json({
        ok: true,
        reply: `Ticket attribué à ${result.assignedTo} (Support).`,
        ...result,
      })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'assign' }, { status: 400 })
    }
  }
  if (op === 'visitor-report' || op === 'funnel-report') {
    const period = (extended.period as 'day' | 'week' | 'month' | 'all') || 'week'
    const report = ztcVisitorReport(period)
    return Response.json({ ok: true, reply: report.summary, ...report })
  }
  if (op === 'visitor-snapshot') {
    const snap = ztcVisitorSnapshot()
    return Response.json({ ok: true, reply: snap.summary, ...snap })
  }

  if (op === 'brief') {
    try {
      const chart = await gw<{
        organization: { id: string; name: string }
        agents: GwAgent[]
      }>('/v1/organizations', undefined, userId)
      const pulse = await gw<{ openTasks: number; activeAgents: number; pendingDecisions: number }>(
        `/v1/organizations/${chart.organization.id}/observability`,
        undefined,
        userId,
      ).catch(() => ({ openTasks: 0, activeAgents: 0, pendingDecisions: 0 }))
      const inventory = await ztcInventory().catch(() => null)
      const working = chart.agents.filter((agent) => /working/i.test(agent.presence || '')).slice(0, 5)
      const stars = chart.agents.slice(0, 8).map((agent) => `${agent.firstName} (${agent.role})`)
      const lines = [
        `Voici ton organisation ${chart.organization.name} (ZtcHosting) : hébergement web, domaines, facturation et équipe IA.`,
        `${chart.agents.length} employés IA · ${pulse.activeAgents} actifs · ${pulse.openTasks} tâches · ${pulse.pendingDecisions} décisions en attente.`,
        stars.length ? `Équipe clé : ${stars.join(', ')}.` : 'L’équipe n’est pas encore montée dans le Studio.',
        working.length
          ? `En mission maintenant : ${working.map((agent) => `${agent.firstName} (${agent.role})`).join(', ')}.`
          : 'Aucune mission ouverte pour l’instant.',
        inventory?.live.devoid.ok
          ? `Produit live : DEVOID en ligne, ${inventory.live.products.filter((item) => !item.comingSoon).length} SKU catalogue.`
          : 'Catalogue / DEVOID : je lirai le flux live dès qu’il est joignable.',
        'Pont DEVOID ↔ Support : les requêtes chat montent à ATLAS, routées au bon agent (Lyra DNS, Vega hébergement, Echo mail, Ledger facture…). Nova peut réaffecter ; la réponse revient à DEVOID pour le client.',
        'Funnel (Flux visiteurs) : compte les visiteurs ztchosting.com, les transforme en prospects et produit des rapports.',
        'Sur mobile : ouvre Organisation pour parler aux agents. Sur le Studio : Bureau 3D, factures, missions. Tu peux aussi dire « ouvre le site » pour ztchosting.com.',
      ]
      return Response.json({ reply: lines.join(' '), organizationId: chart.organization.id })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'brief' }, { status: 502 })
    }
  }

  if (op === 'delegate' || op === 'ask' || op === 'chat' || op === 'report') {
    const text = (body.text || '').trim()
    if (text.length < 2) return Response.json({ error: 'Message trop court.' }, { status: 400 })
    try {
      const chart = await gw<{
        organization: { id: string; name: string }
        agents: GwAgent[]
      }>('/v1/organizations', undefined, userId)
      let agent = chart.agents.find((item) => item.id === body.agentId)
      if (!agent && body.desk) {
        agent = chart.agents.find((item) => item.firstName.toLowerCase() === body.desk!.toLowerCase())
      }
      if (!agent) {
        const desk = ztcDeskOf(text)
        agent = chart.agents.find((item) => item.firstName === desk?.firstName) ?? chart.agents[0]
      }
      if (!agent) return Response.json({ error: 'Aucun agent.' }, { status: 404 })

      const skills = agent.skills?.length ? agent.skills : ztcSkillsOf(agent.firstName)
      const wantsReport = op === 'report' || /rapport|status|statut|bilan|compte[- ]rendu/i.test(text)
      const execute = op === 'delegate' || op === 'report' || wantsReport
        || /mission|confie|fais|mesure|scanne|g[eé]n[eè]re|publie|facture|analyse/i.test(text)

      await gw(`/v1/agents/${agent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ presence: execute ? 'working' : 'online' }),
      }, userId).catch(() => null)

      if (execute) {
        await gw('/v1/commands', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: chart.organization.id,
            agentId: agent.id,
            text: wantsReport ? `Rapport demandé : ${text}` : text,
            action: 'read_analytics',
            kind: 'analyze',
            amount: null,
          }),
        }, userId).catch(() => null)
      }

      // Fil de messages gateway (comme le bureau web)
      const threadPath = `/v1/organizations/${chart.organization.id}/agents/${agent.id}/messages`
      await gw(threadPath, {
        method: 'POST',
        body: JSON.stringify({ authorId: userId, body: text }),
      }, userId).catch(() => null)
      const history = await gw<{ messages?: Array<{ authorId?: string; body?: string }> }>(threadPath, undefined, userId)
        .catch(() => ({ messages: [] as Array<{ authorId?: string; body?: string }> }))
      const lines = (history.messages ?? []).slice(-12).map((row) => ({
        role: row.authorId === agent!.id ? 'agent' : 'user',
        text: String(row.body || '').slice(0, 500),
      }))

      const snap = await deskSnapshot(agent.firstName).catch(() => null)
      const live = snap ? formatDeskPrompt(snap) : ''
      const origin = new URL(request.url).origin
      const question = wantsReport
        ? `[Rapport] ${text}\nDonne un compte-rendu factuel de ton poste, missions en cours et résultats observables.`
        : text
      const think = await fetch(`${origin}/api/atlas/agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          execute,
          organization: chart.organization.name,
          colleagues: chart.agents.filter((item) => item.id !== agent!.id).slice(0, 8).map((item) => `${item.firstName} (${item.role})`),
          agent: {
            firstName: agent.firstName,
            lastName: agent.lastName,
            role: agent.role,
            mission: agent.mission || ztcWorkflowOf(agent.firstName),
            skills,
          },
          question,
          history: lines,
        }),
        signal: AbortSignal.timeout(50000),
      })
      const result = await think.json() as { reply?: string }
      const reply = result.reply
        || `${agent.firstName} (${agent.role}) a pris en charge « ${text} ».`
      await gw(threadPath, {
        method: 'POST',
        body: JSON.stringify({ authorId: agent.id, body: reply }),
      }, userId).catch(() => null)
      return Response.json({
        ok: true,
        agent: {
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role,
          skills,
          face: resolveAgentFace(agent.firstName, agent.lastName, agent.avatar?.face),
        },
        reply,
        live: live.slice(0, 400),
      })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'delegate' }, { status: 502 })
    }
  }

  if (op === 'thread') {
    const agentId = body.agentId?.trim()
    if (!agentId) return Response.json({ error: 'agentId requis' }, { status: 400 })
    try {
      const chart = await gw<{ organization: { id: string } }>('/v1/organizations', undefined, userId)
      const history = await gw<{ messages?: Array<{ id?: string; authorId?: string; body?: string; createdAt?: string }> }>(
        `/v1/organizations/${chart.organization.id}/agents/${agentId}/messages`,
        undefined,
        userId,
      ).catch(() => ({ messages: [] as Array<{ id?: string; authorId?: string; body?: string; createdAt?: string }> }))
      return Response.json({
        messages: (history.messages ?? []).map((row) => ({
          id: row.id || `${row.createdAt}-${row.authorId}`,
          role: row.authorId === agentId ? 'agent' : 'user',
          text: String(row.body || ''),
          at: row.createdAt || new Date().toISOString(),
        })),
      })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'thread' }, { status: 502 })
    }
  }

  return Response.json({ error: 'op=brief|delegate|ask|chat|report|thread' }, { status: 400 })
}
