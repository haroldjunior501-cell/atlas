import { createServer } from 'node:http'
import type { ActionKind } from '@atlas/domain'
import type {
  CreateAgentRequest,
  CreateMeetingRequest,
  CreateOrganizationRequest,
  ImportKnowledgeRequest,
  PostMessageRequest,
  ResolveDecisionRequest,
  SubmitCommandRequest,
  UpdateAgentRequest,
  UpdatePermissionsRequest,
} from '@atlas/contracts'
import { connectorCatalog } from '@atlas/connect'
import { AtlasOrchestrator, askNim, forecastLoad, localReply, nvidiaRuntime, runJarvis } from '@atlas/orchestrator'
import { mootionFromEnv } from '@atlas/voice'
import { loadEnv } from './env'
import { actorId, matchPath, readJson, send } from './http'
import { createCloudState } from './state-store'

loadEnv()

const port = Number(process.env.PORT ?? 4000)

async function main() {
  const cloud = createCloudState()
  const orchestrator = new AtlasOrchestrator(undefined, undefined, undefined, await cloud.load())

  const server = createServer(async (req, res) => {
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', 'http://localhost')
  const writes = method === 'POST' || method === 'PATCH' || method === 'DELETE'
  const readOnlyWrite = url.pathname.endsWith('/voice/briefing') || url.pathname.endsWith('/swarm')

  if (method === 'OPTIONS') {
    send(res, 204, {})
    return
  }

  try {
    if (method === 'GET' && url.pathname === '/health') {
      send(res, 200, {
        service: 'atlas-gateway',
        status: 'ok',
        runtime: cloud.runtime,
        durable: true,
        organizations: orchestrator.db.organizations.size,
        users: orchestrator.db.users.size,
        nvidia: nvidiaRuntime(),
      })
      return
    }

    if (method === 'GET' && url.pathname === '/v1/runtime') {
      send(res, 200, nvidiaRuntime())
      return
    }

    if (method === 'POST' && url.pathname === '/v1/auth/register') {
      const body = await readJson<{ name?: string; email?: string; password?: string; organization?: string }>(req)
      const name = body.name?.trim() ?? ''
      const email = body.email?.trim().toLowerCase() ?? ''
      const password = body.password ?? ''
      const organization = body.organization?.trim() ?? ''
      if (name.length < 2 || !email.includes('@') || password.length < 8 || organization.length < 2) {
        send(res, 400, { error: 'Nom, email, organisation et mot de passe (8 caractères) sont requis.' })
        return
      }
      if (!cloud.rememberAccount || !cloud.accountFor) {
        send(res, 503, { error: 'La base de données n’est pas encore reliée.' })
        return
      }
      const taken = [...orchestrator.db.users.values()].some((user) => user.email.toLowerCase() === email)
      if (taken) {
        send(res, 409, { error: 'Un compte existe déjà avec cet email.' })
        return
      }
      const id = crypto.randomUUID()
      const { hashPassword } = await import('./passwords')
      orchestrator.db.users.set(id, { id, name, email })
      cloud.rememberAccount?.(id, await hashPassword(password), organization)
      send(res, 201, { id, name, email, organization })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/auth/login') {
      const body = await readJson<{ email?: string; password?: string }>(req)
      const email = body.email?.trim().toLowerCase() ?? ''
      const password = body.password ?? ''
      const user = [...orchestrator.db.users.values()].find((item) => item.email.toLowerCase() === email)
      const account = user ? cloud.accountFor?.(email, orchestrator.db.users.values()) : undefined
      const { verifyPassword } = await import('./passwords')
      if (!user || !account || !(await verifyPassword(password, account.passwordHash))) {
        send(res, 401, { error: 'Email ou mot de passe incorrect.' })
        return
      }
      send(res, 200, { id: user.id, name: user.name, email: user.email, organization: account.organizationName })
      return
    }

    const actor = actorId(req)
    if (!actor) {
      send(res, 401, { error: 'Utilisateur manquant. Envoyez x-atlas-user.' })
      return
    }

    if (method === 'GET' && url.pathname === '/v1/organizations') {
      const owned = [...orchestrator.db.organizations.values()].filter((item) => item.ownerId === actor)
      const latest = owned.at(-1)
      send(res, 200, latest ? orchestrator.chart(latest.id) : { organization: null })
      return
    }

    const chart = matchPath('/v1/organizations/:id', url.pathname)
    if (method === 'GET' && chart?.id) {
      const found = orchestrator.chart(chart.id)
      send(res, found ? 200 : 404, found ?? { error: 'Organisation introuvable.' })
      return
    }

    if (method === 'PATCH' && chart?.id) {
      const body = await readJson<{ name?: string; objective?: string | null }>(req)
      const organization = orchestrator.renameOrganization(actor, chart.id, body.name ?? '', body.objective)
      send(res, organization ? 200 : 404, organization ?? { error: 'Organisation introuvable.' })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/studio/organizations') {
      const body = await readJson<CreateOrganizationRequest>(req)
      send(res, 201, await orchestrator.createOrganization(actor, body.intention ?? ''))
      return
    }

    if (method === 'POST' && url.pathname === '/v1/assistant') {
      const body = await readJson<{ message?: string }>(req)
      const message = body.message?.trim() ?? ''
      if (message.length < 3) {
        send(res, 400, { error: 'Décrivez ce que l’organisation doit faire.' })
        return
      }
      const created = await orchestrator.createOrganization(actor, message)
      const roster = created.agents.map((agent) => ({ firstName: agent.firstName, role: agent.role }))
      const forecast = await forecastLoad(roster.map((agent) => ({
        role: agent.role,
        openTasks: 0,
        costEur: 0,
        latencyMs: 0,
      })))
      const nim = await askNim(message, roster.map((agent) => `${agent.firstName} ${agent.role}`).join(', '))
      send(res, 201, {
        reply: nim ?? localReply(roster, forecast.items),
        organization: { id: created.organization.id, name: created.organization.name },
        agents: roster,
        runtime: nvidiaRuntime(),
        forecast: forecast.items,
      })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/jarvis') {
      const body = await readJson<{ text?: string; organizationId?: string }>(req)
      const result = await runJarvis(orchestrator, actor, body.text ?? '', body.organizationId)
      send(res, 200, result)
      return
    }

    if (method === 'POST' && url.pathname === '/v1/memory/ask') {
      const body = await readJson<{ organizationId?: string; question?: string }>(req)
      const question = body.question?.trim() ?? ''
      if (question.length < 3) {
        send(res, 400, { error: 'Posez une question à l’organisation.' })
        return
      }
      const result = await orchestrator.askMemory(actor, body.organizationId ?? '', question)
      send(res, result ? 200 : 404, result ?? { error: 'Organisation introuvable.' })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/agents') {
      const body = await readJson<CreateAgentRequest>(req)
      send(res, 201, orchestrator.createAgent(actor, body))
      return
    }

    const agentProfile = matchPath('/v1/agents/:id', url.pathname)
    if (method === 'PATCH' && agentProfile?.id) {
      const body = await readJson<UpdateAgentRequest>(req)
      const agent = orchestrator.updateAgent(actor, agentProfile.id, body)
      send(res, agent ? 200 : 404, agent ?? { error: 'Agent introuvable.' })
      return
    }
    if (method === 'DELETE' && agentProfile?.id) {
      const removed = orchestrator.removeAgent(actor, agentProfile.id)
      send(res, removed ? 200 : 404, removed ?? { error: 'Agent introuvable.' })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/departments') {
      const body = await readJson<{ organizationId?: string; name?: string }>(req)
      const department = orchestrator.createDepartment(actor, body.organizationId ?? '', body.name ?? '')
      send(res, 201, department)
      return
    }
    const departmentPath = matchPath('/v1/departments/:id', url.pathname)
    if (method === 'DELETE' && departmentPath?.id) {
      const removed = orchestrator.removeDepartment(actor, departmentPath.id)
      send(res, removed ? 200 : 404, removed ?? { error: 'Département introuvable.' })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/relations') {
      const body = await readJson<{ organizationId?: string; fromAgentId?: string; toAgentId?: string }>(req)
      const relation = orchestrator.collaborate(
        actor,
        body.organizationId ?? '',
        body.fromAgentId ?? '',
        body.toAgentId ?? '',
      )
      send(res, relation ? 201 : 404, relation ?? { error: 'Employés introuvables.' })
      return
    }
    const relationPath = matchPath('/v1/relations/:id', url.pathname)
    if (method === 'DELETE' && relationPath?.id) {
      const removed = orchestrator.removeRelation(actor, relationPath.id)
      send(res, removed ? 200 : 404, removed ?? { error: 'Relation introuvable.' })
      return
    }

    const permissions = matchPath('/v1/agents/:id/permissions', url.pathname)
    if (method === 'PATCH' && permissions?.id) {
      const body = await readJson<UpdatePermissionsRequest>(req)
      const agent = orchestrator.updatePermissions(actor, permissions.id, body.delegation, body.permissions)
      send(res, agent ? 200 : 404, agent ?? { error: 'Agent introuvable.' })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/commands') {
      const body = await readJson<SubmitCommandRequest & { kind?: ActionKind }>(req)
      const result = orchestrator.submitCommand(actor, {
        organizationId: body.organizationId,
        agentId: body.agentId,
        text: body.text,
        action: { type: body.action, kind: body.kind ?? 'act', amount: body.amount },
      })
      send(res, result ? 200 : 404, result ?? { error: 'Agent introuvable.' })
      return
    }

    const approvals = matchPath('/v1/organizations/:id/approvals', url.pathname)
    if (method === 'GET' && approvals?.id) {
      const state = orchestrator.memory.recall(approvals.id)
      send(res, state ? 200 : 404, state ? { decisions: state.decisions } : { error: 'Organisation introuvable.' })
      return
    }

    const approval = matchPath('/v1/approvals/:id', url.pathname)
    if (method === 'POST' && approval?.id) {
      const body = await readJson<ResolveDecisionRequest>(req)
      const decision = orchestrator.resolveDecision(actor, approval.id, body.status)
      send(res, decision ? 200 : 404, decision ?? { error: 'Décision introuvable.' })
      return
    }

    if (method === 'POST' && url.pathname === '/v1/knowledge') {
      const body = await readJson<ImportKnowledgeRequest>(req)
      send(res, 201, orchestrator.importKnowledge(actor, body))
      return
    }

    const knowledge = matchPath('/v1/organizations/:id/knowledge', url.pathname)
    if (method === 'GET' && knowledge?.id) {
      const state = orchestrator.memory.recall(knowledge.id)
      send(res, state ? 200 : 404, state ? { documents: state.documents } : { error: 'Organisation introuvable.' })
      return
    }

    const observability = matchPath('/v1/organizations/:id/observability', url.pathname)
    if (method === 'GET' && observability?.id) {
      const state = orchestrator.memory.recall(observability.id)
      if (!state) {
        send(res, 404, { error: 'Organisation introuvable.' })
        return
      }
      send(res, 200, {
        agents: state.agents.length,
        activeAgents: state.agents.filter((agent) => agent.presence === 'working' || agent.presence === 'online').length,
        openTasks: state.tasks.filter((task) => task.status !== 'done').length,
        pendingDecisions: state.decisions.filter((decision) => decision.status === 'pending').length,
        recentAudit: state.audit.slice(-20),
      })
      return
    }

    const taskList = matchPath('/v1/organizations/:id/tasks', url.pathname)
    if (method === 'GET' && taskList?.id) {
      const state = orchestrator.memory.recall(taskList.id)
      send(res, state ? 200 : 404, state ? { tasks: state.tasks } : { error: 'Organisation introuvable.' })
      return
    }

    const taskPath = matchPath('/v1/tasks/:id', url.pathname)
    if (method === 'PATCH' && taskPath?.id) {
      const body = await readJson<{ status?: string }>(req)
      const status = body.status === 'todo' || body.status === 'doing' || body.status === 'done' ? body.status : null
      if (!status) {
        send(res, 400, { error: 'Statut attendu : todo, doing ou done.' })
        return
      }
      const task = orchestrator.updateTask(actor, taskPath.id, status)
      send(res, task ? 200 : 404, task ?? { error: 'Tâche introuvable.' })
      return
    }

    const events = matchPath('/v1/organizations/:id/events', url.pathname)
    if (method === 'GET' && events?.id) {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'access-control-allow-origin': '*',
      })
      const unsubscribe = orchestrator.hub.subscribe(events.id, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      })
      req.on('close', unsubscribe)
      return
    }

    const meetings = matchPath('/v1/organizations/:id/meetings', url.pathname)
    if (meetings?.id && method === 'GET') {
      const state = orchestrator.memory.recall(meetings.id)
      send(res, state ? 200 : 404, state ? { meetings: state.meetings } : { error: 'Organisation introuvable.' })
      return
    }
    if (meetings?.id && method === 'POST') {
      const body = await readJson<CreateMeetingRequest>(req)
      send(res, 201, orchestrator.createMeeting(actor, body))
      return
    }

    const messages = matchPath('/v1/organizations/:id/agents/:agentId/messages', url.pathname)
    if (messages?.id && messages.agentId && method === 'GET') {
      send(res, 200, { messages: orchestrator.messagesFor(messages.id, messages.agentId) })
      return
    }
    if (messages?.id && messages.agentId && method === 'POST') {
      const body = await readJson<PostMessageRequest>(req)
      const message = orchestrator.postMessage({
        organizationId: messages.id,
        agentId: messages.agentId,
        authorId: body.authorId || actor,
        body: body.body,
      })
      send(res, message ? 201 : 404, message ?? { error: 'Agent introuvable.' })
      return
    }

    if (method === 'GET' && url.pathname === '/v1/connectors') {
      send(res, 200, { connectors: connectorCatalog() })
      return
    }

    const briefing = matchPath('/v1/organizations/:id/voice/briefing', url.pathname)
    if (method === 'POST' && briefing?.id) {
      const text = orchestrator.memory.briefing(briefing.id)
      const mootion = mootionFromEnv()
      send(res, 200, {
        organizationId: briefing.id,
        text,
        synthesis: mootion ? 'mootion' : 'unconfigured',
      })
      return
    }

    const swarm = matchPath('/v1/organizations/:id/swarm', url.pathname)
    if (method === 'POST' && swarm?.id) {
      const body = await readJson<{ mission: string }>(req)
      send(res, 200, { steps: orchestrator.decompose(body.mission ?? '', swarm.id) })
      return
    }

    send(res, 404, { error: 'Route inconnue.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne.'
    send(res, 400, { error: message })
  } finally {
    if (writes && !readOnlyWrite && res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await cloud.save(orchestrator.db)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'enregistrement impossible'
        console.error(`ATLAS n’a pas pu enregistrer l’organisation : ${message}`)
      }
    }
  }
})

  server.listen(port, () => {
    console.log(`ATLAS gateway http://localhost:${port} (${cloud.runtime})`)
  })
}

void main()
