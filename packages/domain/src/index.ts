export type {
  ActionKind,
  Agent,
  AgentAction,
  AgentRelation,
  AuditEntry,
  Avatar,
  CompanyDocument,
  ConnectorCategory,
  ConnectorProvider,
  Conversation,
  ConversationKind,
  Decision,
  DecisionStatus,
  DelegationLevel,
  Department,
  Id,
  Integration,
  Meeting,
  Message,
  Objective,
  OfficeLayoutRecord,
  Organization,
  OrganizationDraft,
  Permission,
  PermissionDecision,
  PermissionOutcome,
  Personality,
  Presence,
  RelationKind,
  RiskLevel,
  RoleDraft,
  Task,
  TaskStatus,
  User,
  Workflow,
  WorkflowStep,
} from './model'
export { ACTION, CATEGORY_LABEL, CONNECTOR_CATALOG, connectorOf } from './catalog'
export type { ConnectorDescriptor } from './catalog'
export { draftFromIntention, parseOrganizationPlan, ORGANIZATION_PLAN_PROMPT } from './organization-plan'
export {
  departmentColor,
  departmentType,
  generateLayout,
  officeOrgFromChart,
  primarySpaceForDept,
} from './office-layout'
export type {
  DeskStyle,
  FloorFinish,
  OfficeAgentPlacement,
  OfficeDesk,
  OfficeLabel,
  OfficeLayout,
  OfficeOrgAgent,
  OfficeOrgDepartment,
  OfficeOrgInput,
  OfficeOrgSwarm,
  OfficeOrgTool,
  OfficeProp,
  OfficePropKind,
  OfficeRoom,
  OfficeSpaceKind,
  OfficeWalkway,
  OfficeExtraSpace,
} from './office-layout'
export { SPACE_CATALOG, spaceFromText, spacesFor } from './office-spaces'
export type { SpaceOption } from './office-spaces'
export {
  ARCHETYPES,
  ARCHETYPE_IDS,
  detectArchetype,
  sampleOrganization,
  zoneForDepartment,
} from './office-archetype'
export type { ArchetypeSpec, ArchetypeTheme, OfficeArchetype } from './office-archetype'
export { formatChf, generateOperations } from './office-ops'
export type {
  OfficeOps,
  OpsAction,
  OpsActionKind,
  OpsAsset,
  OpsInventoryLine,
  OpsKpi,
  OpsRecord,
  OpsRecordStatus,
  OpsStage,
  OpsZone,
} from './office-ops'
export {
  agentFace,
  agentVoice,
  businessModelLabel,
  businessModelOf,
  hoursFor,
  isFemaleName,
  kitFor,
  knownObjectives,
  knownTools,
  objectivesFor,
  resolveAgentFace,
  skillsFor,
  toneFor,
  toolsFor,
} from './agent-kit'
export {
  PARTNER_CAPABILITIES,
  memoryCategoryOf,
  researchModeOf,
} from './partner'
export type {
  MemoryCategory,
  PartnerCapability,
  PartnerDomain,
  PersonalMemoryFact,
  ResearchMode,
} from './partner'
export { speechLang } from './speech-lang'
export { ZTC_ATLAS_RULES, ZTC_SITE, isZtcOrganization, ztcMissionExamples } from './ztc-hosting'
export type { ZtcCertainty } from './ztc-hosting'
export {
  CREW_CONNECTORS,
  CREW_PLAN_PROMPT,
  CREW_ROLES,
  CREW_ROLE_IDS,
  alignPrices,
  assignCrew,
  connectorIn,
  countIn,
  fallbackPlan,
  median,
  perKilo,
  permissionFor,
  planFromModel,
  priceMismatches,
  pricesIn,
  readySteps,
  searchQueries,
  targetsIn,
  tokensOf,
  topicOf,
} from './crew'
export type {
  CrewMember,
  CrewPlan,
  CrewRole,
  CrewRoleInfo,
  CrewStep,
  CrewTool,
  Mismatch,
  PriceHit,
  Recommendation,
} from './crew'
