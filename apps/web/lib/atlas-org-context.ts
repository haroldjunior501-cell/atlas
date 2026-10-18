import {
  ZTC_ATLAS_RULES,
  ZTC_DESKS,
  ZTC_JOURNEY,
  ZTC_NAME,
  ZTC_RINGS,
  ZTC_SITE,
  ztcDeskOf,
  ztcScopeOf,
  ztcWorkflowOf,
} from '@atlas/domain'

export type OrgAgentSnap = {
  id: string
  firstName: string
  lastName: string
  role: string
  mission?: string
  departmentId?: string
  presence?: string
  skills?: string[]
  toolIds?: string[]
}

export type OrgChartSnap = {
  organization: { id: string; name: string; intention?: string | null; objective?: string | null }
  departments: Array<{ id: string; name: string }>
  agents: OrgAgentSnap[]
}

export type OrgWorkSnap = {
  agentId: string
  title: string
  status: string
}

/** Contexte studio riche pour Jarvis / Nemotron — ATLAS voit toute l’équipe. */
export function buildOrgStudioContext(
  chart: OrgChartSnap,
  opts?: {
    decisionsPending?: number
    openTasks?: number
    journal?: OrgWorkSnap[]
    liveTasks?: OrgWorkSnap[]
  },
) {
  const deptName = (id?: string) => chart.departments.find((item) => item.id === id)?.name ?? ''
  const workByAgent = new Map<string, string[]>()
  for (const item of [...(opts?.journal ?? []), ...(opts?.liveTasks ?? [])]) {
    if (!/sent|doing|pending/i.test(item.status)) continue
    const list = workByAgent.get(item.agentId) ?? []
    list.push(`${item.title} (${item.status})`)
    workByAgent.set(item.agentId, list.slice(0, 3))
  }
  const agents = chart.agents.map((agent) => {
    const desk = ZTC_DESKS.find((item) => item.firstName.toLowerCase() === agent.firstName.toLowerCase())
    const scope = ztcScopeOf(agent.firstName)
    const work = workByAgent.get(agent.id) ?? []
    return {
      name: `${agent.firstName} ${agent.lastName}`,
      firstName: agent.firstName,
      role: agent.role,
      department: deptName(agent.departmentId),
      presence: agent.presence || 'online',
      ring: desk?.ring ?? null,
      systems: desk?.systems ?? agent.toolIds ?? [],
      datasets: scope.datasets,
      workflow: desk ? ztcWorkflowOf(agent.firstName) : (agent.mission || ''),
      workingOn: work,
      skills: agent.skills ?? [],
    }
  })
  const working = agents.filter((agent) => agent.workingOn.length > 0 || /working/i.test(agent.presence))
  return {
    product: ZTC_NAME,
    site: ZTC_SITE,
    journey: [...ZTC_JOURNEY],
    rings: ZTC_RINGS,
    organization: chart.organization.name || ZTC_NAME,
    intention: chart.organization.intention || chart.organization.objective || '',
    departments: chart.departments.map((item) => item.name),
    agentCount: agents.length,
    agents,
    workingNow: working.map((agent) => ({
      name: agent.firstName,
      role: agent.role,
      tasks: agent.workingOn,
    })),
    pendingDecisions: opts?.decisionsPending ?? 0,
    openTasks: opts?.openTasks ?? working.reduce((sum, agent) => sum + agent.workingOn.length, 0),
    desks: ZTC_DESKS.map((desk) => ({
      firstName: desk.firstName,
      role: desk.role,
      ring: desk.ring,
      systems: desk.systems,
    })),
    rule: 'ATLAS orchestre. FOSSBilling, WHM, Cloudflare, ResellerClub restent maîtres. DEVOID = chat client.',
  }
}

/** Brief oral : situation + qui travaille + prochaines actions. */
export function buildOrgSupervisorBrief(
  chart: OrgChartSnap,
  opts?: {
    decisionsPending?: number
    alerts?: string[]
    journal?: OrgWorkSnap[]
    liveTasks?: OrgWorkSnap[]
  },
) {
  const studio = buildOrgStudioContext(chart, opts)
  const active = studio.workingNow.length
    ? studio.workingNow.slice(0, 5).map((item) => {
      const task = item.tasks[0] ? ` sur ${item.tasks[0]}` : ''
      return `${item.name} (${item.role})${task}`
    }).join('. ')
    : studio.agents.slice(0, 4).map((agent) => `${agent.firstName}, ${agent.role}`).join('. ')
  const pending = studio.pendingDecisions
    ? `${studio.pendingDecisions} décision${studio.pendingDecisions > 1 ? 's' : ''} attendent votre accord.`
    : 'Aucune décision n’attend votre accord.'
  const alert = opts?.alerts?.length ? ` Attention : ${opts.alerts[0]}` : ''
  return [
    `${studio.organization}. ${studio.agentCount} employés IA sur le produit hébergement.`,
    active ? `En activité : ${active}.` : 'Aucun agent en mission ouverte.',
    pending,
    'Je supervise et je délègue : dites « demande à Radar de scanner », « orchestre le bureau », ou « parle à Nova ».',
    alert,
  ].filter(Boolean).join(' ')
}

/** Bloc système : ATLAS = chef d’orchestre du produit. */
export function atlasOrchestratorRules() {
  return `${ZTC_ATLAS_RULES}

Primary language: English. Reply in English by default; mirror the user if they clearly write in another language.

SUPERVISOR ROLE
You are the ATLAS virtual assistant: you know the FULL ZtcHosting product organization,
all agents (Nova, Devoid, Funnel, Orion, Swift, Vega, Lyra, Echo, Helix, Cipher, Radar, Aegis,
Ledger, Forge, Pulse, Flare, Clip, Boost, Muse, Sage), their departments, rings R0–R4, systems and data flows.
You supervise them: you know who is working, you talk to them, assign missions, run handoffs.
The provided "studio" JSON IS your live desk/agent state (presence, missions, departments). You have access: you are the main supervisor.
FORBIDDEN to say you cannot see the 3D desk, agents, screen, or app. FORBIDDEN to send the user to "look at the 3D view" instead of you.
Invent no state outside studio. Orchestrate via JSON actions (ask, mission, plan, crew, follow, orchestrate, brief, team).
When the user asks for a status / "what are my agents doing" / briefing / 3D desk → brief (or team) action and a factual reply from studio.
When a business agent is needed, pick the right first name (Radar scan, Swift perf, Flare images, Clip video, Boost traffic, Muse copy, Funnel visitors/prospects, Nova DEVOID ticket intake then route, Devoid site chat, Lyra DNS/domain, Vega hosting/WHM, Echo mail, Ledger invoice, Cipher security…).
DEVOID tickets: DNS → Lyra, hosting → Vega, email → Echo, invoice → Ledger; Nova can reassign.
Each agent has DEVOID tools for their role (buy, DNS, email, WP, security…) via op=tool.`
}

/** Choisit l’agent ZTC le plus pertinent pour une consigne. */
export function pickAgentForMission<T extends { firstName: string; role: string }>(
  agents: T[],
  text: string,
): T | null {
  if (!agents.length) return null
  const desk = ztcDeskOf(text)
  if (desk) {
    const hit = agents.find((agent) => agent.firstName.toLowerCase() === desk.firstName.toLowerCase())
    if (hit) return hit
  }
  const named = agents.find((agent) => text.toLowerCase().includes(agent.firstName.toLowerCase()))
  return named ?? agents[0] ?? null
}

export function teamRosterLine(agents: Array<{ firstName: string; role: string }>, limit = 24) {
  const lines = agents.slice(0, limit).map((agent) => `${agent.firstName}, ${agent.role}`)
  return lines.length ? `${lines.join('. ')}.` : 'Aucun employé en poste.'
}

/** Alias parlants → département / salle ZTC. */
const ROOM_ALIASES: Array<{ re: RegExp; keys: string[] }> = [
  { re: /s[eé]curit|soc|\blab\b|scan|radar|aegis|cipher|vuln/, keys: ['Sécurité', 'Salle de sécurité'] },
  { re: /support|accueil|ticket|nova|devoid|client|escalade/, keys: ['Support', 'Accueil & support', 'Accueil'] },
  { re: /flux|funnel|visiteurs?|prospects?|leads?/, keys: ['Flux visiteurs'] },
  { re: /perf|ttfb|swift|rapidit|vitesse/, keys: ['Performance'] },
  { re: /op[eé]ration|noc|orion|incident|war ?room/, keys: ['Opérations', 'Salle des opérations'] },
  { re: /h[eé]berg|whm|cpanel|vega|serveur|r[eé]seau/, keys: ['Hébergement', 'Réseau & hébergement'] },
  { re: /domaine|dns|lyra|ssl/, keys: ['Domaines & DNS'] },
  { re: /mail|messag|echo|d[eé]livrabilit/, keys: ['Messagerie'] },
  { re: /vps|cloud|helix|llm|gpu/, keys: ['Cloud / VPS'] },
  { re: /factur|ledger|finance|compta|fossbilling/, keys: ['Facturation', 'Compta'] },
  { re: /devops|forge|n8n|openclaw|release/, keys: ['DevOps'] },
  { re: /marketing|flare|clip|boost|muse|pub|trafic|vid[eé]o|campagne|cr[eé]a|studio/, keys: ['Marketing', 'Studio marketing'] },
  { re: /produit|pulse|growth/, keys: ['Produit'] },
  { re: /conformit|sage|grc|rgpd/, keys: ['Conformité'] },
  { re: /r[eé]union|meeting/, keys: ['Salle de réunion'] },
  { re: /personnel|cuisine|caf[eé]/, keys: ['Salle du personnel'] },
]

export function resolveRoomKeys(target: string): string[] {
  const heard = target.toLowerCase().trim()
  const hit = ROOM_ALIASES.find((item) => item.re.test(heard))
  if (hit) return hit.keys
  const bare = heard
    .replace(/^(?:la |le |l['’]|salle |zone |d[eé]partement |pi[eè]ce |espace |bureau )+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return bare ? [bare, target.trim()] : [target.trim()]
}

/** Trouve une pièce du layout ou un département correspondant à la demande. */
export function matchOfficeRoom<T extends { id: string; name: string; departmentId?: string | null }>(
  rooms: T[],
  target: string,
): T | null {
  const keys = resolveRoomKeys(target).map((key) => key.toLowerCase())
  const exact = rooms.find((room) => keys.some((key) => room.name.toLowerCase() === key))
  if (exact) return exact
  return rooms.find((room) => keys.some((key) => key.length > 2 && room.name.toLowerCase().includes(key))) ?? null
}

export function agentsInRoom<T extends { id: string; departmentId?: string; firstName: string; role: string }>(
  agents: T[],
  room: { id: string; departmentId?: string | null },
  layoutAgentIds: string[],
): T[] {
  if (layoutAgentIds.length) {
    const set = new Set(layoutAgentIds)
    const fromLayout = agents.filter((agent) => set.has(agent.id))
    if (fromLayout.length) return fromLayout
  }
  if (room.departmentId) return agents.filter((agent) => agent.departmentId === room.departmentId)
  return []
}
