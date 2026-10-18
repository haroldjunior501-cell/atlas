import type {
  Agent,
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
  Task,
} from '@atlas/domain'

export interface OrganizationState {
  organization: Organization
  departments: Department[]
  agents: Agent[]
  tasks: Task[]
  decisions: Decision[]
  documents: CompanyDocument[]
  meetings: Meeting[]
  conversations: Conversation[]
  messages: Message[]
  audit: AuditEntry[]
  integrations: Integration[]
}

export class OrganizationMemory {
  constructor(private readonly read: (organizationId: Id) => OrganizationState | null) {}

  recall(organizationId: Id): OrganizationState | null {
    return this.read(organizationId)
  }

  briefing(organizationId: Id): string {
    const state = this.recall(organizationId)
    if (!state) return 'Aucune organisation chargée.'
    const pending = state.decisions.filter((decision) => decision.status === 'pending').length
    const openTasks = state.tasks.filter((task) => task.status !== 'done').length
    const working = state.agents.filter((agent) => agent.presence === 'working' || state.tasks.some((task) => task.agentId === agent.id && task.status !== 'done'))
    const roster = working.length
      ? working.slice(0, 6).map((agent) => `${agent.firstName} (${agent.role})`).join(', ')
      : state.agents.slice(0, 6).map((agent) => `${agent.firstName} (${agent.role})`).join(', ')
    return [
      `Bonjour. ${state.organization.name} — ATLAS orchestre ${state.agents.length} employés.`,
      roster ? `Équipe : ${roster}.` : 'Aucun employé en poste.',
      `${state.meetings.length} réunion${state.meetings.length > 1 ? 's' : ''} au calendrier.`,
      `${openTasks} tâche${openTasks > 1 ? 's' : ''} en cours.`,
      `${pending} décision${pending > 1 ? 's' : ''} en attente d’approbation.`,
      'Je peux parler à un agent, lui confier une mission ou répartir le travail.',
    ].join(' ')
  }

  dossier(organizationId: Id): string | null {
    const state = this.recall(organizationId)
    if (!state) return null
    const departmentName = (id: string) => state.departments.find((item) => item.id === id)?.name ?? ''
    const people = state.agents
      .map((agent) => {
        const manager = state.agents.find((item) => item.id === agent.reportsToId)
        const reports = manager ? `${manager.firstName} ${manager.lastName}` : 'ATLAS / le dirigeant'
        const open = state.tasks.filter((task) => task.agentId === agent.id && task.status !== 'done').map((task) => task.title)
        const work = open.length ? ` — en cours : ${open.slice(0, 2).join(', ')}` : ''
        const skills = agent.skills?.length ? ` · compétences ${agent.skills.slice(0, 3).join(', ')}` : ''
        return `${agent.firstName} ${agent.lastName}, ${agent.role}, ${departmentName(agent.departmentId)}, présence ${agent.presence}, rattaché à ${reports}${skills}${work}`
      })
      .join('\n')
    const tasks = state.tasks.filter((task) => task.status !== 'done').slice(0, 12).map((task) => {
      const owner = state.agents.find((agent) => agent.id === task.agentId)
      return `${owner?.firstName ?? '?'}: ${task.title}`
    })
    const decisions = state.decisions.filter((decision) => decision.status === 'pending').slice(0, 5).map((decision) => decision.title)
    const meetings = state.meetings.slice(0, 3).map((meeting) => meeting.title)
    const departments = state.departments.map((item) => item.name).join(', ')
    const briefingIds = new Set(
      state.conversations.filter((conversation) => conversation.kind === 'briefing').map((conversation) => conversation.id),
    )
    const prior = state.messages
      .filter((message) => briefingIds.has(message.conversationId))
      .slice(-8)
      .map((message) => `${message.authorId === 'atlas' ? 'ATLAS' : 'Dirigeant'} : ${message.body}`)
    return [
      `Organisation : ${state.organization.name}`,
      `Intention : ${state.organization.intention}`,
      `Départements : ${departments || 'aucun'}`,
      `ATLAS supervise ${state.agents.length} employés IA et orchestre les missions.`,
      people ? `Employés :\n${people}` : 'Employés : aucun',
      `Tâches en cours : ${tasks.length > 0 ? tasks.join(' ; ') : 'aucune'}`,
      `Décisions en attente : ${decisions.length > 0 ? decisions.join(' ; ') : 'aucune'}`,
      `Réunions : ${meetings.length > 0 ? meetings.join(' ; ') : 'aucune'}`,
      prior.length > 0 ? `Échanges déjà en mémoire :\n${prior.join('\n')}` : 'Échanges déjà en mémoire : aucun',
    ].join('\n')
  }

  answerLocal(organizationId: Id): string | null {
    const state = this.recall(organizationId)
    if (!state) return null
    const people = state.agents.map((agent) => `${agent.firstName} (${agent.role})`).join(', ')
    const openTasks = state.tasks.filter((task) => task.status !== 'done').length
    const pending = state.decisions.filter((decision) => decision.status === 'pending').length
    return `${state.organization.name}. ATLAS orchestre : ${people || 'Aucun employé'}. ${openTasks} tâche${openTasks > 1 ? 's' : ''} en cours, ${pending} décision${pending > 1 ? 's' : ''} en attente. Je peux déléguer à un agent ou faire un briefing.`
  }
}
