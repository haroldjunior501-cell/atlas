import type {
  Agent,
  AgentRelation,
  AuditEntry,
  CompanyDocument,
  Decision,
  DecisionStatus,
  Department,
  Integration,
  Meeting,
  Message,
  Organization,
  OrganizationDraft,
  Permission,
  Task,
} from '@atlas/domain'

export interface CreateOrganizationRequest {
  intention: string
}

export interface CreateOrganizationResponse {
  organization: Organization
  departments: Department[]
  agents: Agent[]
}

export interface OrganizationChartResponse {
  organization: Organization
  departments: Department[]
  agents: Agent[]
  relations: AgentRelation[]
}

export interface CreateAgentRequest {
  organizationId: string
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
  reportsToId: string | null
}

export interface UpdatePermissionsRequest {
  delegation: Agent['delegation']
  permissions: Permission[]
}

export interface UpdateAgentRequest {
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
  reportsToId?: string | null
}

export interface SubmitCommandRequest {
  organizationId: string
  agentId: string
  text: string
  action: string
  amount: number | null
}

export interface SubmitCommandResponse {
  outcome: 'allowed' | 'approval_required' | 'denied'
  reason: string
  task: Task | null
  decision: Decision | null
}

export interface ResolveDecisionRequest {
  status: Extract<DecisionStatus, 'approved' | 'rejected' | 'discussing'>
}

export interface ImportKnowledgeRequest {
  organizationId: string
  name: string
  mimeType: string
  accessibleTo: string[]
}

export interface ObservabilitySnapshot {
  agents: number
  activeAgents: number
  openTasks: number
  pendingDecisions: number
  recentAudit: AuditEntry[]
}

export interface VoiceBriefingResponse {
  organizationId: string
  text: string
  synthesis: 'unconfigured' | 'mootion'
}

export interface PostMessageRequest {
  organizationId: string
  authorId: string
  body: string
}

export interface ConversationThreadResponse {
  messages: Message[]
}

export interface KnowledgeListResponse {
  documents: CompanyDocument[]
}

export interface MeetingListResponse {
  meetings: Meeting[]
}

export interface CreateMeetingRequest {
  organizationId: string
  title: string
  startsAt: string
  createdByAgentId: string | null
  agenda: string[]
}

export interface IntegrationListResponse {
  integrations: Integration[]
}

export interface OrganizationDraftResponse {
  draft: OrganizationDraft
}
