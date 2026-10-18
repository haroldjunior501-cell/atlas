import {
  bridgeAuthorized,
  ztcConnectStatus,
  ztcIngest,
  ztcLink,
  ztcThink,
} from '@/lib/ztc-connect'
import {
  ztcAssignSupportAgent,
  ztcEscalate,
  ztcInvokeDevoidTool,
  ztcListSupportTickets,
  ztcMarkTicketWorking,
  ztcPullSupportReplies,
  ztcRouteTicket,
  ztcSupportReply,
} from '@/lib/ztc-devoid-bridge'
import { ztcDevoidToolsOf, ZTC_SUPPORT_DEPARTMENT } from '@atlas/domain'

function gatewayBase() {
  return (process.env.ATLAS_GATEWAY_URL || process.env.NEXT_PUBLIC_ATLAS_GATEWAY_URL || 'http://127.0.0.1:4000').replace(/\/$/, '')
}

/** Agents live du département Support (Studio), pour attribution DEVOID. */
async function liveSupportAgents() {
  try {
    const userId = process.env.ATLAS_BRIDGE_USER || 'harold'
    const response = await fetch(`${gatewayBase()}/v1/organizations`, {
      headers: { 'content-type': 'application/json', 'x-atlas-user': userId },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return undefined
    const chart = await response.json() as {
      agents?: Array<{ firstName: string; departmentId?: string }>
      departments?: Array<{ id: string; name: string }>
    }
    const supportDeptIds = new Set(
      (chart.departments || [])
        .filter((dept) => /support/i.test(dept.name))
        .map((dept) => dept.id),
    )
    return (chart.agents || [])
      .filter((agent) => agent.departmentId && supportDeptIds.has(agent.departmentId))
      .map((agent) => ({ firstName: agent.firstName, department: ZTC_SUPPORT_DEPARTMENT }))
  } catch {
    return undefined
  }
}
import {
  ztcQualifyProspect,
  ztcRecordVisit,
  ztcVisitorReport,
  ztcVisitorSnapshot,
} from '@/lib/ztc-visitor-flow'

export async function GET(request: Request) {
  const auth = bridgeAuthorized(request)
  if (!auth.ok) return Response.json({ error: 'Jeton ZTC_BRIDGE_TOKEN requis.' }, { status: 401 })
  return Response.json(await ztcConnectStatus())
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const op = String(body.op || 'think')
  const auth = bridgeAuthorized(request)
  if (op !== 'link' && !auth.ok) {
    return Response.json({ error: 'Jeton ZTC_BRIDGE_TOKEN requis (Authorization: Bearer).' }, { status: 401 })
  }
  try {
    if (op === 'status') return Response.json(await ztcConnectStatus())
    if (op === 'think' || op === 'reason' || op === 'analyze') {
      return Response.json(await ztcThink(
        String(body.desk || body.specialistDesk || ''),
        String(body.text || body.prompt || body.question || ''),
        {
          mode: body.mode
            ? String(body.mode)
            : (op === 'reason' || op === 'analyze' ? 'devoid' : undefined),
          channel: body.channel ? String(body.channel) : undefined,
          customerId: body.customerId || body.customer_id
            ? String(body.customerId || body.customer_id)
            : undefined,
          fast: body.fast === true || body.fast === 1 || body.fast === '1'
            || String(body.mode || '') === 'devoid'
            || String(body.channel || '') === 'devoid',
        },
      ))
    }
    if (op === 'ingest') {
      return Response.json(ztcIngest(
        String(body.desk || ''),
        String(body.source || 'ztc'),
        (body.facts as Array<{ label?: string; value?: string; source?: string; certainty?: string; desk?: string }>) ?? [],
      ))
    }
    if (op === 'link') return Response.json(ztcLink(body as Record<string, string | undefined>))

    // —— Pont DEVOID ↔ département Support ——
    if (op === 'escalate') {
      const supportAgents = await liveSupportAgents()
      return Response.json(ztcEscalate({
        text: String(body.text || body.question || ''),
        sessionId: body.sessionId ? String(body.sessionId) : undefined,
        clientName: body.clientName ? String(body.clientName) : undefined,
        clientEmail: body.clientEmail ? String(body.clientEmail) : undefined,
        page: body.page ? String(body.page) : undefined,
        // desk = agent Support demandé ; sinon Nova est choisie dans Support
        desk: body.desk ? String(body.desk) : undefined,
        specialistDesk: body.specialistDesk || body.specialist_desk
          ? String(body.specialistDesk || body.specialist_desk)
          : undefined,
        service: body.service ? String(body.service) : undefined,
        serviceLabel: body.serviceLabel || body.service_label
          ? String(body.serviceLabel || body.service_label)
          : undefined,
        availableSupportAgents: supportAgents,
      }))
    }
    if (op === 'assign' || op === 'support-assign') {
      const supportAgents = await liveSupportAgents()
      return Response.json(ztcAssignSupportAgent({
        ticketId: body.ticketId ? String(body.ticketId) : undefined,
        sessionId: body.sessionId ? String(body.sessionId) : undefined,
        desk: String(body.desk || body.to || ''),
        note: body.note ? String(body.note) : undefined,
        assignedBy: (body.assignedBy || body.routedBy || body.answeredBy)
          ? String(body.assignedBy || body.routedBy || body.answeredBy)
          : 'Devoid',
        availableSupportAgents: supportAgents,
      }))
    }
    if (op === 'route' || op === 'ticket-route') {
      const supportAgents = await liveSupportAgents()
      return Response.json(ztcRouteTicket({
        ticketId: body.ticketId ? String(body.ticketId) : undefined,
        sessionId: body.sessionId ? String(body.sessionId) : undefined,
        desk: String(body.desk || body.to || body.specialistDesk || ''),
        note: body.note ? String(body.note) : undefined,
        routedBy: (body.routedBy || body.answeredBy)
          ? String(body.routedBy || body.answeredBy)
          : 'Nova',
        availableSupportAgents: supportAgents,
      }))
    }
    if (op === 'reply') {
      return Response.json(await ztcSupportReply({
        ticketId: body.ticketId ? String(body.ticketId) : undefined,
        sessionId: body.sessionId ? String(body.sessionId) : undefined,
        text: String(body.text || body.answer || ''),
        answeredBy: body.answeredBy
          ? String(body.answeredBy)
          : (body.desk ? String(body.desk) : 'Nova'),
      }))
    }
    if (op === 'pull' || op === 'pull-replies') {
      return Response.json(ztcPullSupportReplies(
        body.sessionId ? String(body.sessionId) : undefined,
        body.ticketId ? String(body.ticketId) : undefined,
      ))
    }
    if (op === 'tickets') {
      return Response.json(ztcListSupportTickets(
        body.status ? String(body.status) as 'open' | 'working' | 'answered' | 'closed' | 'all' : 'all',
      ))
    }
    if (op === 'tool' || op === 'devoid-tool' || op === 'run-tool') {
      return Response.json(await ztcInvokeDevoidTool({
        desk: String(body.desk || 'Nova'),
        tool: String(body.tool || body.name || ''),
        customerId: body.customerId || body.customer_id
          ? String(body.customerId || body.customer_id)
          : undefined,
        args: (body.args && typeof body.args === 'object'
          ? body.args as Record<string, unknown>
          : undefined),
      }))
    }
    if (op === 'tools' || op === 'desk-tools') {
      const desk = String(body.desk || 'Nova')
      return Response.json({ ok: true, desk, tools: ztcDevoidToolsOf(desk) })
    }
    if (op === 'ticket-working') {
      return Response.json(ztcMarkTicketWorking(String(body.ticketId || '')))
    }

    // —— Flux visiteurs (Funnel) ——
    if (op === 'visit') {
      return Response.json(ztcRecordVisit({
        path: body.path ? String(body.path) : undefined,
        sessionId: body.sessionId ? String(body.sessionId) : undefined,
        referrer: body.referrer ? String(body.referrer) : undefined,
        utmSource: body.utmSource ? String(body.utmSource) : undefined,
        utmMedium: body.utmMedium ? String(body.utmMedium) : undefined,
        utmCampaign: body.utmCampaign ? String(body.utmCampaign) : undefined,
        country: body.country ? String(body.country) : undefined,
        userAgent: body.userAgent ? String(body.userAgent) : undefined,
      }))
    }
    if (op === 'prospect') {
      return Response.json(ztcQualifyProspect({
        sessionId: body.sessionId ? String(body.sessionId) : undefined,
        email: body.email ? String(body.email) : undefined,
        name: body.name ? String(body.name) : undefined,
        interest: body.interest ? String(body.interest) : undefined,
        status: body.status as 'new' | 'warm' | 'contacted' | 'qualified' | 'won' | 'lost' | undefined,
      }))
    }
    if (op === 'visitor-report' || op === 'funnel-report') {
      const period = (body.period as 'day' | 'week' | 'month' | 'all') || 'week'
      return Response.json(ztcVisitorReport(period))
    }
    if (op === 'visitor-snapshot') {
      return Response.json(ztcVisitorSnapshot())
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'connexion impossible'
    return Response.json({ error: message }, { status: 400 })
  }
  return Response.json({
    error: 'op: think | ingest | link | status | escalate | assign | route | reply | pull | tickets | tool | tools | visit | prospect | visitor-report',
  }, { status: 400 })
}
