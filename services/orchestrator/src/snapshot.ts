import type {
  Agent,
  AgentRelation,
  AuditEntry,
  CompanyDocument,
  Conversation,
  Decision,
  Department,
  Integration,
  Meeting,
  Message,
  Organization,
  Task,
  User,
} from '@atlas/domain'
import { createDatabase, type AtlasDatabase } from './store'

export interface OrganizationRecord {
  organization: Organization
  departments: Department[]
  agents: Agent[]
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

export interface CloudSnapshot {
  users: User[]
  organizations: OrganizationRecord[]
}

export function snapshotDatabase(db: AtlasDatabase): CloudSnapshot {
  const organizations = [...db.organizations.values()].map((organization) => {
    const conversations = db.conversations.filter(
      (conversation) => conversation.organizationId === organization.id,
    )
    const conversationIds = new Set(conversations.map((conversation) => conversation.id))
    return {
      organization,
      departments: [...db.departments.values()].filter(
        (department) => department.organizationId === organization.id,
      ),
      agents: [...db.agents.values()].filter((agent) => agent.organizationId === organization.id),
      relations: db.relations.filter((relation) => relation.organizationId === organization.id),
      tasks: db.tasks.filter((task) => task.organizationId === organization.id),
      decisions: db.decisions.filter((decision) => decision.organizationId === organization.id),
      documents: db.documents.filter((document) => document.organizationId === organization.id),
      meetings: db.meetings.filter((meeting) => meeting.organizationId === organization.id),
      conversations,
      messages: db.messages.filter((message) => conversationIds.has(message.conversationId)),
      audit: db.audit.filter((entry) => entry.organizationId === organization.id),
      integrations: db.integrations.filter(
        (integration) => integration.organizationId === organization.id,
      ),
    }
  })
  return { users: [...db.users.values()], organizations }
}

export function databaseFromSnapshot(snapshot: CloudSnapshot): AtlasDatabase {
  const db = createDatabase()
  for (const user of snapshot.users) db.users.set(user.id, user)
  for (const record of snapshot.organizations) {
    db.organizations.set(record.organization.id, record.organization)
    for (const department of record.departments) db.departments.set(department.id, department)
    for (const agent of record.agents) db.agents.set(agent.id, agent)
    db.relations.push(...(record.relations ?? []))
    db.tasks.push(...record.tasks)
    db.decisions.push(...record.decisions)
    db.documents.push(...record.documents)
    db.meetings.push(...record.meetings)
    db.conversations.push(...record.conversations)
    db.messages.push(...record.messages)
    db.audit.push(...record.audit)
    db.integrations.push(...record.integrations)
  }
  return db
}
