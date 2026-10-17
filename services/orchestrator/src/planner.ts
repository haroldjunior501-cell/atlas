import type { OrganizationDraft } from '@atlas/domain'
import { planOrganization } from './nvidia'

export interface Planner {
  draftOrganization(intention: string): Promise<OrganizationDraft>
}

export class TemplatePlanner implements Planner {
  draftOrganization(intention: string): Promise<OrganizationDraft> {
    return planOrganization(intention)
  }
}

export interface MissionStep {
  role: string
  task: string
}

export interface Swarm {
  decompose(mission: string, roles: string[]): MissionStep[]
}

export class RoleSwarm implements Swarm {
  decompose(mission: string, roles: string[]): MissionStep[] {
    if (roles.length === 0) return []
    return roles.map((role) => ({
      role,
      task: `${role} contribue à : ${mission}`,
    }))
  }
}
