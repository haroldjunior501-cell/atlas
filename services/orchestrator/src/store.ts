import type {
  Agent,
  AgentRelation,
  AgentAction,
  AuditEntry,
  CompanyDocument,
  Conversation,
  Decision,
  Department,
  Id,
  Integration,
  Meeting,
  Message,
  Organization,
  OrganizationDraft,
  Permission,
  Task,
  User,
} from '@atlas/domain'

export interface AtlasDatabase {
  users: Map<Id, User>
  organizations: Map<Id, Organization>
  departments: Map<Id, Department>
  agents: Map<Id, Agent>
  relations: AgentRelation[]
  tasks: Task[]
  decisions: Decision[]
  documents: CompanyDocument[]
  meetings: Meeting[]
  conversations: Conversation[]
  messages: Message[]
  audit: AuditEntry[]
  integrations: Integration[]
}

export function createDatabase(): AtlasDatabase {
  return {
    users: new Map(),
    organizations: new Map(),
    departments: new Map(),
    agents: new Map(),
    relations: [],
    tasks: [],
    decisions: [],
    documents: [],
    meetings: [],
    conversations: [],
    messages: [],
    audit: [],
    integrations: [],
  }
}

export function ensureUser(db: AtlasDatabase, userId: Id): User {
  const existing = db.users.get(userId)
  if (existing) return existing
  const user: User = { id: userId, name: userId, email: `${userId}@atlas.local` }
  db.users.set(userId, user)
  return user
}

const id = (): Id => crypto.randomUUID()

export function materializeDraft(db: AtlasDatabase, ownerId: Id, draft: OrganizationDraft): Organization {
  const organization: Organization = {
    id: id(),
    ownerId,
    name: draft.name,
    intention: draft.intention,
    objective: draft.objective,
  }
  db.organizations.set(organization.id, organization)

  const departmentIds = new Map<string, Id>()
  for (const role of draft.roles) {
    if (departmentIds.has(role.department)) continue
    const department: Department = {
      id: id(),
      organizationId: organization.id,
      name: role.department,
    }
    departmentIds.set(role.department, department.id)
    db.departments.set(department.id, department)
  }

  const agentsByRole = new Map<string, Agent>()
  for (const role of draft.roles) {
    const agent: Agent = {
      id: id(),
      organizationId: organization.id,
      departmentId: departmentIds.get(role.department) ?? id(),
      reportsToId: null,
      firstName: role.firstName,
      lastName: role.lastName,
      role: role.role,
      mission: role.mission,
      presence: 'idle',
      personality: {
        traits: role.traits,
        tone: role.tone,
        hours: role.hours,
      },
      skills: role.skills,
      objectives: role.objectives ?? [],
      toolIds: role.toolIds ?? [],
      permissions: role.permissions,
      delegation: role.delegation,
      avatar: {
        appearance: 'portrait',
        age: null,
        style: role.department.toLowerCase(),
        voiceId: role.voiceId ?? 'Ava',
        face: role.face,
      },
    }
    agentsByRole.set(role.role, agent)
    db.agents.set(agent.id, agent)
  }

  for (const role of draft.roles) {
    if (!role.reportsToRole) continue
    const agent = agentsByRole.get(role.role)
    const manager = agentsByRole.get(role.reportsToRole)
    if (agent && manager) agent.reportsToId = manager.id
  }

  recordAudit(db, {
    organizationId: organization.id,
    actorId: ownerId,
    action: 'organization.created',
    permission: null,
    reason: draft.intention,
  })

  return organization
}

export function recordAudit(
  db: AtlasDatabase,
  entry: Omit<AuditEntry, 'id' | 'at'>,
): AuditEntry {
  const stored: AuditEntry = { ...entry, id: id(), at: new Date().toISOString() }
  db.audit.push(stored)
  return stored
}

export function agentsFor(db: AtlasDatabase, organizationId: Id): Agent[] {
  return [...db.agents.values()].filter((agent) => agent.organizationId === organizationId)
}

export function departmentsFor(db: AtlasDatabase, organizationId: Id): Department[] {
  return [...db.departments.values()].filter((department) => department.organizationId === organizationId)
}

export function replacePermissions(
  db: AtlasDatabase,
  agent: Agent,
  delegation: Agent['delegation'],
  permissions: Permission[],
): Agent {
  agent.delegation = delegation
  agent.permissions = permissions
  db.agents.set(agent.id, agent)
  return agent
}

export function addTask(db: AtlasDatabase, task: Omit<Task, 'id'>): Task {
  const stored: Task = { ...task, id: id() }
  db.tasks.push(stored)
  return stored
}

export function addDecision(db: AtlasDatabase, decision: Omit<Decision, 'id'>): Decision {
  const stored: Decision = { ...decision, id: id() }
  db.decisions.push(stored)
  return stored
}

export function addDocument(db: AtlasDatabase, document: Omit<CompanyDocument, 'id'>): CompanyDocument {
  const stored: CompanyDocument = { ...document, id: id() }
  db.documents.push(stored)
  return stored
}

export function addMeeting(db: AtlasDatabase, meeting: Omit<Meeting, 'id'>): Meeting {
  const stored: Meeting = { ...meeting, id: id() }
  db.meetings.push(stored)
  return stored
}

export function briefingThread(db: AtlasDatabase, organizationId: Id, actorId: Id): Conversation {
  const existing = db.conversations.find(
    (conversation) => conversation.organizationId === organizationId && conversation.kind === 'briefing',
  )
  if (existing) return existing
  const conversation: Conversation = {
    id: id(),
    organizationId,
    participantIds: [actorId],
    kind: 'briefing',
  }
  db.conversations.push(conversation)
  return conversation
}

export function threadFor(db: AtlasDatabase, organizationId: Id, agentId: Id): Conversation {
  const existing = db.conversations.find(
    (conversation) =>
      conversation.organizationId === organizationId &&
      conversation.kind === 'ceo_agent' &&
      conversation.participantIds.includes(agentId),
  )
  if (existing) return existing
  const conversation: Conversation = {
    id: id(),
    organizationId,
    participantIds: [agentId],
    kind: 'ceo_agent',
  }
  db.conversations.push(conversation)
  return conversation
}

export function addMessage(db: AtlasDatabase, message: Omit<Message, 'id' | 'createdAt'>): Message {
  const stored: Message = { ...message, id: id(), createdAt: new Date().toISOString() }
  db.messages.push(stored)
  return stored
}

export { id }
