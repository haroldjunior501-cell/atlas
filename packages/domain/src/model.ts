export type Id = string

export type Presence = 'online' | 'working' | 'idle' | 'offline'

export type DelegationLevel = 'autonomous' | 'approval' | 'restricted'

export type RiskLevel = 'low' | 'medium' | 'high'

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'discussing'

export type TaskStatus = 'todo' | 'doing' | 'done'

export type ConversationKind = 'ceo_agent' | 'agent_agent' | 'briefing'

export type RelationKind = 'reports_to' | 'collaborates'

export type ConnectorCategory =
  | 'communication'
  | 'calendar'
  | 'development'
  | 'documents'
  | 'business'
  | 'design'
  | 'automation'
  | 'machine'
  | 'search'
  | 'commerce'
  | 'hosting'

export type ConnectorProvider =
  | 'gmail'
  | 'outlook'
  | 'slack'
  | 'teams'
  | 'discord'
  | 'telegram'
  | 'x'
  | 'google_calendar'
  | 'outlook_calendar'
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'linear'
  | 'google_drive'
  | 'onedrive'
  | 'notion'
  | 'dropbox'
  | 'crm'
  | 'hubspot'
  | 'salesforce'
  | 'pipedrive'
  | 'stripe'
  | 'analytics'
  | 'mixpanel'
  | 'figma'
  | 'canva'
  | 'mootion'
  | 'shopify'
  | 'resend'
  | 'n8n'
  | 'mcp'
  | 'browser'
  | 'machine'
  | 'filesystem'
  | 'ztc_core'
  | 'fossbilling'
  | 'whm'
  | 'cloudflare'
  | 'resellerclub'
  | 'devoid'

export type ActionKind = 'analyze' | 'act'

export interface User {
  id: Id
  name: string
  email: string
}

export interface Organization {
  id: Id
  ownerId: Id
  name: string
  intention: string
  objective: string | null
}

export interface Department {
  id: Id
  organizationId: Id
  name: string
  /** Couleur spatiale (bureau 3D) — optionnelle, déduite du nom si absente. */
  color?: string
  /** Type métier (direction, sales, support…) pour le générateur de plan. */
  type?: string
}

/** Snapshot versionné du plan de bureau généré depuis l’organisation. */
export interface OfficeLayoutRecord {
  id: Id
  organizationId: Id
  gridJson: string
  version: number
}

export interface Avatar {
  appearance: string
  age: number | null
  style: string
  voiceId: string
  face?: string
}

export interface Personality {
  traits: string[]
  tone?: string
  hours?: string
}

export interface Objective {
  id: Id
  label: string
  metric: string | null
  target: string | null
  dueAt: string | null
}

export interface Permission {
  action: string
  allowed: boolean
  requiresApproval: boolean
  spendLimit: number | null
}

export interface Agent {
  id: Id
  organizationId: Id
  departmentId: Id
  reportsToId: Id | null
  firstName: string
  lastName: string
  role: string
  mission: string
  presence: Presence
  personality: Personality
  skills: string[]
  objectives: Objective[]
  toolIds: string[]
  permissions: Permission[]
  delegation: DelegationLevel
  avatar: Avatar
}

export interface AgentRelation {
  id: Id
  organizationId: Id
  fromAgentId: Id
  toAgentId: Id
  kind: RelationKind
}

export interface WorkflowStep {
  id: Id
  agentRole: string
  action: string
  requiresApproval: boolean
}

export interface Workflow {
  id: Id
  organizationId: Id
  name: string
  trigger: string
  steps: WorkflowStep[]
}

export interface Task {
  id: Id
  organizationId: Id
  agentId: Id
  title: string
  status: TaskStatus
  missionId: string | null
}

export interface Conversation {
  id: Id
  organizationId: Id
  participantIds: Id[]
  kind: ConversationKind
}

export interface Message {
  id: Id
  conversationId: Id
  authorId: Id
  body: string
  createdAt: string
}

export interface CompanyDocument {
  id: Id
  organizationId: Id
  name: string
  mimeType: string
  accessibleTo: string[]
}

export interface Integration {
  id: Id
  organizationId: Id
  provider: ConnectorProvider
  status: 'disconnected' | 'connected'
}

export interface Meeting {
  id: Id
  organizationId: Id
  title: string
  startsAt: string
  createdByAgentId: Id | null
  agenda: string[]
}

export interface Decision {
  id: Id
  organizationId: Id
  requestedByAgentId: Id
  title: string
  summary: string
  amount: number | null
  risk: RiskLevel
  status: DecisionStatus
}

export interface AuditEntry {
  id: Id
  organizationId: Id
  actorId: Id
  action: string
  permission: string | null
  reason: string
  at: string
}

export interface AgentAction {
  type: string
  kind: ActionKind
  amount: number | null
}

export type PermissionOutcome = 'allowed' | 'approval_required' | 'denied'

export interface PermissionDecision {
  outcome: PermissionOutcome
  action: string
  reason: string
}

export interface RoleDraft {
  firstName: string
  lastName: string
  role: string
  mission: string
  skills: string[]
  traits: string[]
  tone?: string
  hours?: string
  department: string
  reportsToRole: string | null
  delegation: DelegationLevel
  permissions: Permission[]
  objectives?: Objective[]
  toolIds?: string[]
  voiceId?: string
  face?: string
}

export interface OrganizationDraft {
  name: string
  intention: string
  objective: string | null
  sector?: string
  businessModel?: string
  roles: RoleDraft[]
}
