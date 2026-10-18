import {
  draftFromIntention,
  isZtcOrganization,
  lockToZtc,
  missingZtcDesks,
  sampleOrganization,
  ZTC_DEPARTMENTS,
  ZTC_DESKS,
  ZTC_INTENTION,
  ZTC_NAME,
  ztcSkillsOf,
  ztcWorkflowOf,
  type OfficeOrgInput,
  type OrganizationDraft,
} from '@atlas/domain'

export type SyncChart = {
  organization: { id: string; name: string; objective?: string | null; intention?: string | null }
  departments: Array<{ id: string; name: string }>
  agents: Array<{
    id: string
    firstName: string
    lastName: string
    role: string
    mission?: string
    departmentId: string
    skills?: string[]
    toolIds?: string[]
  }>
}

type Call = <T>(path: string, init?: RequestInit) => Promise<T>

function ztcPlan(): OrganizationDraft {
  return draftFromIntention(lockToZtc(ZTC_INTENTION))
}

export function ztcAgentCount(firstNames: string[]) {
  const names = new Set(ZTC_DESKS.map((desk) => desk.firstName.toLowerCase()))
  return firstNames.filter((name) => names.has(name.trim().toLowerCase())).length
}

export function needsZtcRoster(chart: SyncChart, meta?: { sector?: string; businessModel?: string }) {
  const ztc = isZtcOrganization(chart.organization.name, meta?.sector, chart.organization.intention || chart.organization.objective || '')
    || meta?.businessModel === 'hosting'
    || /ztc|h[eé]berg/i.test(chart.organization.name)
  if (!ztc) return true // produit verrouillé ZTC : toujours aligner
  return missingZtcDesks(chart.agents.map((agent) => agent.firstName)).length > 0
    || ztcAgentCount(chart.agents.map((agent) => agent.firstName)) < 12
}

/** Bureau 3D immédiat : 19 postes ZTC même si le gateway n’a pas encore synchronisé. */
export function ztcOfficeOrg(
  organization: { id: string; name: string; intention?: string | null; objective?: string | null },
  tools: Array<{ id: string; provider: string }> = [],
): OfficeOrgInput {
  const sample = sampleOrganization('hosting')
  return {
    id: organization.id,
    name: ZTC_NAME,
    sector: sample.sector,
    businessModel: 'hosting',
    intention: organization.intention || organization.objective || ZTC_INTENTION,
    archetype: 'hosting',
    tools,
    departments: sample.departments.map((dept) => ({
      id: `${organization.id}-${dept.id}`,
      name: dept.name,
      type: dept.name,
      agents: dept.agents.map((agent) => ({
        ...agent,
        id: `${organization.id}-${agent.id}`,
      })),
    })),
  }
}

/** Installe les 19 postes ZTC (départements, rôles, compétences, flux données) sur l’org gateway. */
export async function ensureZtcRoster(
  chart: SyncChart,
  call: Call,
  rememberProfile: (id: string, extra: Record<string, unknown>) => void,
): Promise<{ chartId: string; hired: string[]; already: number }> {
  const plan = ztcPlan()
  const orgId = chart.organization.id
  const ztcNames = new Set(ZTC_DESKS.map((desk) => desk.firstName.toLowerCase()))
  const foreign = chart.agents.filter((agent) => !ztcNames.has(agent.firstName.toLowerCase()))
  // Ancienne équipe (location / SaaS / marketing…) → on retire pour ne garder que ZTC.
  for (const agent of foreign) {
    await call(`/v1/agents/${agent.id}`, { method: 'DELETE' }).catch(() => null)
  }
  const kept = chart.agents.filter((agent) => ztcNames.has(agent.firstName.toLowerCase()))
  const missing = missingZtcDesks(kept.map((agent) => agent.firstName))
  const hired: string[] = []

  await call(`/v1/organizations/${orgId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: ZTC_NAME,
      objective: plan.objective,
    }),
  }).catch(() => null)

  const deptNames = [...new Set(plan.roles.map((role) => ZTC_DEPARTMENTS[role.firstName] || role.department))]
  for (const name of deptNames) {
    const exists = chart.departments.some((item) => item.name.toLowerCase() === name.toLowerCase())
    if (exists) continue
    await call('/v1/departments', {
      method: 'POST',
      body: JSON.stringify({ organizationId: orgId, name }),
    }).catch(() => null)
  }

  const byFirst = new Map(kept.map((agent) => [agent.firstName.toLowerCase(), agent]))

  for (const role of plan.roles) {
    const desk = ZTC_DESKS.find((item) => item.firstName === role.firstName)
    const department = ZTC_DEPARTMENTS[role.firstName] || role.department
    const skills = ztcSkillsOf(role.firstName)
    const mission = ztcWorkflowOf(role.firstName)
    const existing = byFirst.get(role.firstName.toLowerCase())

    if (existing) {
      await call(`/v1/agents/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: role.role,
          mission,
          skills,
          traits: role.traits,
          tone: role.tone,
          hours: role.hours,
          objectives: role.objectives,
          toolIds: role.toolIds,
          departmentName: department,
        }),
      }).catch(() => null)
      rememberProfile(existing.id, {
        firstName: role.firstName,
        lastName: role.lastName,
        skills,
        objectives: role.objectives,
        toolIds: role.toolIds,
        personality: { traits: role.traits, tone: role.tone, hours: role.hours },
        avatar: {
          appearance: 'portrait',
          age: null,
          style: department.toLowerCase(),
          voiceId: role.voiceId ?? 'Ava',
          face: role.face,
        },
      })
      continue
    }

    if (!missing.includes(role.firstName)) continue

    const created = await call<{ id: string }>('/v1/agents', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: orgId,
        departmentName: department,
        firstName: role.firstName,
        lastName: role.lastName,
        role: role.role,
        mission,
        skills,
        traits: role.traits,
        tone: role.tone,
        hours: role.hours,
        objectives: role.objectives,
        toolIds: role.toolIds,
        voiceId: role.voiceId,
        face: role.face,
        delegation: role.delegation,
        permissions: role.permissions,
        reportsToId: null,
      }),
    }).catch(() => null)

    if (!created?.id) continue
    hired.push(role.firstName)
    rememberProfile(created.id, {
      firstName: role.firstName,
      lastName: role.lastName,
      skills,
      objectives: role.objectives,
      toolIds: role.toolIds,
      personality: { traits: role.traits, tone: role.tone, hours: role.hours },
      avatar: {
        appearance: 'portrait',
        age: null,
        style: department.toLowerCase(),
        voiceId: role.voiceId ?? 'Ava',
        face: role.face,
      },
    })

    await call(`/v1/organizations/${orgId}/agents/${created.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        authorId: created.id,
        body: `${role.firstName} · ${role.role} · ${department}. ${mission} Anneau ${desk?.ring ?? 'R0'}.`,
      }),
    }).catch(() => null)
  }

  // Wire reportsTo when both ends exist
  try {
    const latest = await call<SyncChart>(`/v1/organizations/${orgId}`)
    const byRole = new Map(latest.agents.map((agent) => [agent.role, agent]))
    for (const role of plan.roles) {
      if (!role.reportsToRole) continue
      const agent = byRole.get(role.role)
      const manager = byRole.get(role.reportsToRole)
      if (!agent || !manager) continue
      await call(`/v1/agents/${agent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ reportsToId: manager.id }),
      }).catch(() => null)
    }
  } catch { /* ignore */ }

  return {
    chartId: orgId,
    hired,
    already: ZTC_DESKS.length - missing.length,
  }
}
