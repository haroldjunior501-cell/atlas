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
    return [
      `Bonjour. ${state.organization.name}.`,
      `${state.meetings.length} réunion${state.meetings.length > 1 ? 's' : ''} au calendrier.`,
      `${openTasks} tâche${openTasks > 1 ? 's' : ''} en cours.`,
      `${pending} décision${pending > 1 ? 's' : ''} en attente d’approbation.`,
    ].join(' ')
  }

  dossier(organizationId: Id): string | null {
    const state = this.recall(organizationId)
    if (!state) return null
    const departmentName = (id: string) => state.departments.find((item) => item.id === id)?.name ?? ''
    const people = state.agents
      .slice(0, 12)
      .map((agent) => {
        const manager = state.agents.find((item) => item.id === agent.reportsToId)
        const reports = manager ? `${manager.firstName} ${manager.lastName}` : 'le dirigeant'
        return `${agent.firstName} ${agent.lastName}, ${agent.role}, ${departmentName(agent.departmentId)}, rattaché à ${reports}`
      })
      .join('\n')
    const tasks = state.tasks.filter((task) => task.status !== 'done').slice(0, 5).map((task) => task.title)
    const decisions = state.decisions.filter((decision) => decision.status === 'pending').slice(0, 3).map((decision) => decision.title)
    const meetings = state.meetings.slice(0, 3).map((meeting) => meeting.title)
    const briefingIds = new Set(
      state.conversations.filter((conversation) => conversation.kind === 'briefing').map((conversation) => conversation.id),
    )
    const prior = state.messages
      .filter((message) => briefingIds.has(message.conversationId))
      .slice(-6)
      .map((message) => `${message.authorId === 'atlas' ? 'ATLAS' : 'Dirigeant'} : ${message.body}`)
    return [
      `Organisation : ${state.organization.name}`,
      `Intention : ${state.organization.intention}`,
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
    const people = state.agents.slice(0, 4).map((agent) => `${agent.firstName} (${agent.role})`).join(', ')
    const openTasks = state.tasks.filter((task) => task.status !== 'done').length
    const pending = state.decisions.filter((decision) => decision.status === 'pending').length
    return `${state.organization.name}. ${people || 'Aucun employé'}. ${openTasks} tâche${openTasks > 1 ? 's' : ''} en cours, ${pending} décision${pending > 1 ? 's' : ''} en attente. Le modèle n’est pas connecté : je m’en tiens à cette mémoire.`
  }
}
