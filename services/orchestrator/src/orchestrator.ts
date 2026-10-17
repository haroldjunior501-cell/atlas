import type {
  Agent,
  AgentRelation,
  AgentAction,
  CompanyDocument,
  Decision,
  DecisionStatus,
  Department,
  Id,
  Meeting,
  Message,
  Organization,
  Permission,
  Task,
  TaskStatus,
} from '@atlas/domain'
import { OrganizationMemory } from './memory'
import { answerFromMemory } from './nvidia'
import { evaluatePermission } from './permissions'
import { RoleSwarm, TemplatePlanner, type MissionStep, type Planner, type Swarm } from './planner'
import {
  addDecision,
  addDocument,
  addMeeting,
  addMessage,
  addTask,
  agentsFor,
  briefingThread,
  createDatabase,
  departmentsFor,
  ensureUser,
  materializeDraft,
  recordAudit,
  replacePermissions,
  threadFor,
  type AtlasDatabase,
} from './store'

export interface OrganizationEvent {
  organizationId: Id
  type: string
  at: string
}

export interface RealtimeHub {
  publish(event: OrganizationEvent): void
  subscribe(organizationId: Id, listener: (event: OrganizationEvent) => void): () => void
}

export class InProcessRealtimeHub implements RealtimeHub {
  private readonly listeners = new Map<Id, Set<(event: OrganizationEvent) => void>>()

  publish(event: OrganizationEvent): void {
    for (const listener of this.listeners.get(event.organizationId) ?? []) listener(event)
  }

  subscribe(organizationId: Id, listener: (event: OrganizationEvent) => void): () => void {
    const set = this.listeners.get(organizationId) ?? new Set()
    set.add(listener)
    this.listeners.set(organizationId, set)
    return () => set.delete(listener)
  }
}

export interface CommandResult {
  outcome: 'allowed' | 'approval_required' | 'denied'
  reason: string
  task: Task | null
  decision: Decision | null
}

function departmentByName(db: AtlasDatabase, organizationId: Id, name: string) {
  const found = departmentsFor(db, organizationId).find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  )
  if (found) return found
  const created = { id: crypto.randomUUID(), organizationId, name }
  db.departments.set(created.id, created)
  return created
}

function reportsCycle(db: AtlasDatabase, agentId: Id, reportsToId: Id | null): boolean {
  let current = reportsToId
  const seen = new Set<Id>()
  while (current) {
    if (current === agentId || seen.has(current)) return true
    seen.add(current)
    current = db.agents.get(current)?.reportsToId ?? null
  }
  return false
}

export class AtlasOrchestrator {
  readonly db: AtlasDatabase
  readonly memory: OrganizationMemory
  readonly hub: RealtimeHub

  constructor(
    private readonly planner: Planner = new TemplatePlanner(),
    private readonly swarm: Swarm = new RoleSwarm(),
    hub: RealtimeHub = new InProcessRealtimeHub(),
    db: AtlasDatabase = createDatabase(),
  ) {
    this.db = db
    this.hub = hub
    this.memory = new OrganizationMemory((organizationId) => {
      const organization = this.db.organizations.get(organizationId)
      if (!organization) return null
      return {
        organization,
        departments: departmentsFor(this.db, organizationId),
        agents: agentsFor(this.db, organizationId),
        tasks: this.db.tasks.filter((task) => task.organizationId === organizationId),
        decisions: this.db.decisions.filter((decision) => decision.organizationId === organizationId),
        documents: this.db.documents.filter((document) => document.organizationId === organizationId),
        meetings: this.db.meetings.filter((meeting) => meeting.organizationId === organizationId),
        conversations: this.db.conversations.filter(
          (conversation) => conversation.organizationId === organizationId,
        ),
        messages: this.db.messages,
        audit: this.db.audit.filter((entry) => entry.organizationId === organizationId),
        integrations: this.db.integrations.filter(
          (integration) => integration.organizationId === organizationId,
        ),
      }
    })
  }

  async createOrganization(ownerId: Id, intention: string) {
    ensureUser(this.db, ownerId)
    const draft = await this.planner.draftOrganization(intention)
    const organization = materializeDraft(this.db, ownerId, draft)
    this.publish(organization.id, 'organization.created')
    return {
      organization,
      departments: departmentsFor(this.db, organization.id),
      agents: agentsFor(this.db, organization.id),
      relations: this.db.relations.filter((relation) => relation.organizationId === organization.id),
    }
  }

  renameOrganization(actorId: Id, organizationId: Id, name: string, objective?: string | null) {
    const organization = this.db.organizations.get(organizationId)
    if (!organization || organization.ownerId !== actorId) return null
    const next = name.trim()
    if (next) organization.name = next.slice(0, 48)
    if (objective !== undefined) organization.objective = objective
    this.publish(organizationId, 'organization.updated')
    return organization
  }

  chart(organizationId: Id) {
    const organization = this.db.organizations.get(organizationId)
    if (!organization) return null
    return {
      organization,
      departments: departmentsFor(this.db, organizationId),
      agents: agentsFor(this.db, organizationId),
      relations: this.db.relations.filter((relation) => relation.organizationId === organizationId),
    }
  }

  async askMemory(
    actorId: Id,
    organizationId: Id,
    question: string,
  ): Promise<{ reply: string; source: 'nim' | 'local' } | null> {
    const organization = this.db.organizations.get(organizationId)
    if (!organization || organization.ownerId !== actorId) return null
    const dossier = this.memory.dossier(organizationId)
    const fallback = this.memory.answerLocal(organizationId)
    if (!dossier || !fallback) return null
    const generated = await answerFromMemory(question, dossier)
    const reply = generated ?? fallback
    const thread = briefingThread(this.db, organizationId, actorId)
    addMessage(this.db, { conversationId: thread.id, authorId: actorId, body: question })
    addMessage(this.db, { conversationId: thread.id, authorId: 'atlas', body: reply })
    recordAudit(this.db, {
      organizationId,
      actorId,
      action: 'memory.asked',
      permission: null,
      reason: question,
    })
    this.publish(organizationId, 'memory.asked')
    return { reply, source: generated ? 'nim' : 'local' }
  }

  createAgent(ownerId: Id, input: {
    organizationId: Id
    departmentName: string
    firstName: string
    lastName: string
    role: string
    mission: string
    skills: string[]
    traits: string[]
    tone?: string
    hours?: string
    objectives?: Agent['objectives']
    toolIds?: string[]
    voiceId?: string
    face?: string
    delegation: Agent['delegation']
    permissions: Permission[]
    reportsToId: Id | null
  }): Agent {
    const department =
      departmentsFor(this.db, input.organizationId).find(
        (item) => item.name.toLowerCase() === input.departmentName.toLowerCase(),
      ) ??
      (() => {
        const created = {
          id: crypto.randomUUID(),
          organizationId: input.organizationId,
          name: input.departmentName,
        }
        this.db.departments.set(created.id, created)
        return created
      })()

    const agent: Agent = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      departmentId: department.id,
      reportsToId: input.reportsToId,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      mission: input.mission,
      presence: 'idle',
      personality: { traits: input.traits, tone: input.tone, hours: input.hours },
      skills: input.skills,
      objectives: input.objectives ?? [],
      toolIds: input.toolIds ?? [],
      permissions: input.permissions,
      delegation: input.delegation,
      avatar: {
        appearance: 'portrait',
        age: null,
        style: input.departmentName.toLowerCase(),
        voiceId: input.voiceId ?? 'Ava',
        face: input.face,
      },
    }
    this.db.agents.set(agent.id, agent)
    recordAudit(this.db, {
      organizationId: input.organizationId,
      actorId: ownerId,
      action: 'agent.created',
      permission: null,
      reason: input.role,
    })
    this.publish(input.organizationId, 'agent.created')
    return agent
  }

  updateAgent(actorId: Id, agentId: Id, patch: {
    firstName?: string
    lastName?: string
    role?: string
    mission?: string
    traits?: string[]
    skills?: string[]
    tone?: string
    hours?: string
    objectives?: Agent['objectives']
    toolIds?: string[]
    voiceId?: string
    face?: string
    departmentName?: string
    reportsToId?: Id | null
  }): Agent | null {
    const agent = this.db.agents.get(agentId)
    if (!agent) return null
    if (patch.reportsToId !== undefined && patch.reportsToId !== agent.reportsToId) {
      if (patch.reportsToId && !this.db.agents.get(patch.reportsToId)) return null
      if (reportsCycle(this.db, agentId, patch.reportsToId)) {
        throw new Error('Un employé ne peut pas être rattaché à quelqu’un qui dépend de lui.')
      }
      agent.reportsToId = patch.reportsToId
    }
    if (patch.departmentName !== undefined) {
      const name = patch.departmentName.trim()
      if (!name) throw new Error('Le département a besoin d’un nom.')
      agent.departmentId = departmentByName(this.db, agent.organizationId, name).id
    }
    if (patch.firstName !== undefined) agent.firstName = patch.firstName
    if (patch.lastName !== undefined) agent.lastName = patch.lastName
    if (patch.role !== undefined) agent.role = patch.role
    if (patch.mission !== undefined) agent.mission = patch.mission
    if (patch.traits !== undefined || patch.tone !== undefined || patch.hours !== undefined) {
      agent.personality = {
        traits: patch.traits ?? agent.personality.traits,
        tone: patch.tone ?? agent.personality.tone,
        hours: patch.hours ?? agent.personality.hours,
      }
    }
    if (patch.skills !== undefined) agent.skills = patch.skills
    if (patch.objectives !== undefined) agent.objectives = patch.objectives
    if (patch.toolIds !== undefined) agent.toolIds = patch.toolIds
    if (patch.voiceId !== undefined || patch.face !== undefined) {
      agent.avatar = {
        ...agent.avatar,
        voiceId: patch.voiceId ?? agent.avatar.voiceId,
        face: patch.face ?? agent.avatar.face,
      }
    }
    recordAudit(this.db, {
      organizationId: agent.organizationId,
      actorId,
      action: 'agent.updated',
      permission: null,
      reason: agent.role,
    })
    this.publish(agent.organizationId, 'agent.updated')
    return agent
  }

  updatePermissions(actorId: Id, agentId: Id, delegation: Agent['delegation'], permissions: Permission[]): Agent | null {
    const agent = this.db.agents.get(agentId)
    if (!agent) return null
    replacePermissions(this.db, agent, delegation, permissions)
    recordAudit(this.db, {
      organizationId: agent.organizationId,
      actorId,
      action: 'agent.permissions_updated',
      permission: delegation,
      reason: 'Mise à jour explicite des permissions.',
    })
    this.publish(agent.organizationId, 'agent.permissions_updated')
    return agent
  }

  removeAgent(actorId: Id, agentId: Id): boolean {
    const agent = this.db.agents.get(agentId)
    if (!agent) return false
    for (const other of this.db.agents.values()) {
      if (other.reportsToId === agent.id) other.reportsToId = agent.reportsToId
    }
    this.db.relations = this.db.relations.filter(
      (relation) => relation.fromAgentId !== agent.id && relation.toAgentId !== agent.id,
    )
    this.db.agents.delete(agent.id)
    recordAudit(this.db, {
      organizationId: agent.organizationId,
      actorId,
      action: 'agent.removed',
      permission: null,
      reason: agent.role,
    })
    this.publish(agent.organizationId, 'agent.removed')
    return true
  }

  createDepartment(actorId: Id, organizationId: Id, name: string): Department {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Le département a besoin d’un nom.')
    const department = departmentByName(this.db, organizationId, trimmed)
    recordAudit(this.db, {
      organizationId,
      actorId,
      action: 'department.created',
      permission: null,
      reason: department.name,
    })
    return department
  }

  removeDepartment(actorId: Id, departmentId: Id): boolean {
    const department = this.db.departments.get(departmentId)
    if (!department) return false
    const occupied = [...this.db.agents.values()].some((agent) => agent.departmentId === department.id)
    if (occupied) throw new Error('Retirez d’abord les employés de ce département.')
    this.db.departments.delete(department.id)
    recordAudit(this.db, {
      organizationId: department.organizationId,
      actorId,
      action: 'department.removed',
      permission: null,
      reason: department.name,
    })
    return true
  }

  collaborate(actorId: Id, organizationId: Id, fromAgentId: Id, toAgentId: Id) {
    const from = this.db.agents.get(fromAgentId)
    const to = this.db.agents.get(toAgentId)
    if (!from || !to || from.organizationId !== organizationId || to.organizationId !== organizationId) return null
    if (from.id === to.id) throw new Error('Un employé ne collabore pas avec lui-même.')
    const [left, right] = [from.id, to.id].sort()
    const existing = this.db.relations.find(
      (relation) =>
        relation.kind === 'collaborates' &&
        relation.fromAgentId === left &&
        relation.toAgentId === right,
    )
    if (existing) return existing
    const relation = {
      id: crypto.randomUUID(),
      organizationId,
      fromAgentId: left,
      toAgentId: right,
      kind: 'collaborates' as const,
    }
    this.db.relations.push(relation)
    recordAudit(this.db, {
      organizationId,
      actorId,
      action: 'relation.created',
      permission: null,
      reason: 'Collaboration',
    })
    return relation
  }

  removeRelation(actorId: Id, relationId: Id): boolean {
    const relation = this.db.relations.find((item) => item.id === relationId)
    if (!relation) return false
    this.db.relations = this.db.relations.filter((item) => item.id !== relationId)
    recordAudit(this.db, {
      organizationId: relation.organizationId,
      actorId,
      action: 'relation.removed',
      permission: null,
      reason: 'Collaboration',
    })
    return true
  }

  submitCommand(actorId: Id, input: {
    organizationId: Id
    agentId: Id
    text: string
    action: AgentAction
  }): CommandResult | null {
    const agent = this.db.agents.get(input.agentId)
    if (!agent || agent.organizationId !== input.organizationId) return null
    const decision = evaluatePermission(agent, input.action)
    recordAudit(this.db, {
      organizationId: input.organizationId,
      actorId,
      action: `command.${decision.outcome}`,
      permission: input.action.type,
      reason: decision.reason,
    })

    if (decision.outcome === 'denied') {
      this.publish(input.organizationId, 'command.denied')
      return { outcome: 'denied', reason: decision.reason, task: null, decision: null }
    }

    if (decision.outcome === 'approval_required') {
      const pending = addDecision(this.db, {
        organizationId: input.organizationId,
        requestedByAgentId: agent.id,
        title: input.text,
        summary: decision.reason,
        amount: input.action.amount,
        risk: input.action.amount !== null && input.action.amount > 500 ? 'medium' : 'low',
        status: 'pending',
      })
      this.publish(input.organizationId, 'decision.pending')
      return { outcome: 'approval_required', reason: decision.reason, task: null, decision: pending }
    }

    const task = addTask(this.db, {
      organizationId: input.organizationId,
      agentId: agent.id,
      title: input.text,
      status: 'doing',
      missionId: null,
    })
    agent.presence = 'working'
    this.publish(input.organizationId, 'task.started')
    return { outcome: 'allowed', reason: decision.reason, task, decision: null }
  }

  updateTask(actorId: Id, taskId: Id, status: TaskStatus): Task | null {
    const task = this.db.tasks.find((item) => item.id === taskId)
    if (!task) return null
    task.status = status
    const agent = this.db.agents.get(task.agentId)
    if (agent) {
      const busy = this.db.tasks.some((item) => item.agentId === agent.id && item.status === 'doing')
      agent.presence = busy ? 'working' : 'online'
    }
    recordAudit(this.db, {
      organizationId: task.organizationId,
      actorId,
      action: `task.${status}`,
      permission: null,
      reason: task.title,
    })
    this.publish(task.organizationId, 'task.updated')
    return task
  }

  resolveDecision(actorId: Id, decisionId: Id, status: Extract<DecisionStatus, 'approved' | 'rejected' | 'discussing'>): Decision | null {
    const decision = this.db.decisions.find((item) => item.id === decisionId)
    if (!decision) return null
    decision.status = status
    recordAudit(this.db, {
      organizationId: decision.organizationId,
      actorId,
      action: `decision.${status}`,
      permission: 'approval_center',
      reason: decision.title,
    })
    if (status === 'approved') {
      addTask(this.db, {
        organizationId: decision.organizationId,
        agentId: decision.requestedByAgentId,
        title: decision.title,
        status: 'doing',
        missionId: null,
      })
    }
    this.publish(decision.organizationId, `decision.${status}`)
    return decision
  }

  importKnowledge(actorId: Id, document: Omit<CompanyDocument, 'id'>): CompanyDocument {
    const stored = addDocument(this.db, document)
    recordAudit(this.db, {
      organizationId: document.organizationId,
      actorId,
      action: 'knowledge.imported',
      permission: null,
      reason: document.name,
    })
    return stored
  }

  createMeeting(actorId: Id, meeting: Omit<Meeting, 'id'>): Meeting {
    const stored = addMeeting(this.db, meeting)
    recordAudit(this.db, {
      organizationId: meeting.organizationId,
      actorId,
      action: 'meeting.created',
      permission: null,
      reason: meeting.title,
    })
    this.publish(meeting.organizationId, 'meeting.created')
    return stored
  }

  postMessage(input: { organizationId: Id; agentId: Id; authorId: Id; body: string }): Message | null {
    const agent = this.db.agents.get(input.agentId)
    if (!agent) return null
    const conversation = threadFor(this.db, input.organizationId, input.agentId)
    return addMessage(this.db, {
      conversationId: conversation.id,
      authorId: input.authorId,
      body: input.body,
    })
  }

  messagesFor(organizationId: Id, agentId: Id): Message[] {
    const conversation = this.db.conversations.find(
      (item) => item.organizationId === organizationId && item.participantIds.includes(agentId),
    )
    if (!conversation) return []
    return this.db.messages.filter((message) => message.conversationId === conversation.id)
  }

  decompose(mission: string, organizationId: Id): MissionStep[] {
    return this.swarm.decompose(
      mission,
      agentsFor(this.db, organizationId).map((agent) => agent.role),
    )
  }

  private publish(organizationId: Id, type: string): void {
    this.hub.publish({ organizationId, type, at: new Date().toISOString() })
  }
}
