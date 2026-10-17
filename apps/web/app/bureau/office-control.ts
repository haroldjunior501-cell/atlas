export type WorkStatus = 'todo' | 'doing' | 'done' | 'pending' | 'approved' | 'rejected' | 'denied' | 'sent'

/** Étape réelle du travail d’un agent : tâche, décision ou consigne envoyée. */
export interface WorkItem {
  id: string
  agentId: string
  title: string
  status: WorkStatus
  source: 'task' | 'decision' | 'journal'
  taskId?: string
  at?: string
}

export interface AgentTool {
  provider: string
  label: string
  /** L’agent a le droit d’utiliser l’outil. */
  granted: boolean
  /** L’outil est réellement connecté pour l’organisation. */
  connected: boolean
}

export interface ActivityLine {
  id: string
  at: string
  who: string
  what: string
}

export type ControlResult = { ok: boolean; note: string }

/** Commandes réelles qu’ATLAS et l’utilisateur peuvent lancer depuis le Bureau 3D. */
export interface OfficeControl {
  live: boolean
  busy: boolean
  stream: 'live' | 'polling' | 'off'
  departments: Array<{ id: string; name: string; agents: number }>
  work: (agentId: string) => WorkItem[]
  tools: (agentId: string) => AgentTool[]
  delegation: (agentId: string) => string | null
  activity: ActivityLine[]
  mission: (agentId: string, text: string) => Promise<ControlResult>
  hire: (role: string, departmentName: string) => Promise<ControlResult>
  move: (agentId: string, departmentName: string) => Promise<ControlResult>
  fire: (agentId: string) => Promise<ControlResult>
  autonomy: (agentId: string, level: 'autonomous' | 'approval') => Promise<ControlResult>
  addDepartment: (name: string) => Promise<ControlResult>
  removeDepartment: (departmentId: string) => Promise<ControlResult>
  grantTool: (agentId: string, provider: string, on: boolean) => Promise<ControlResult>
  setTaskStatus: (taskId: string, status: 'todo' | 'doing' | 'done') => Promise<ControlResult>
  openIntegrations: () => void
}

export const WORK_LABEL: Record<WorkStatus, string> = {
  todo: 'À faire',
  doing: 'En cours',
  done: 'Terminé',
  pending: 'Attend votre accord',
  approved: 'Approuvé',
  rejected: 'Refusé',
  denied: 'Bloqué',
  sent: 'Transmis',
}

const FIRST = ['Lina', 'Hugo', 'Chloé', 'Luca', 'Nora', 'Elias', 'Mila', 'Noé', 'Jade', 'Matteo', 'Zoé', 'Léon', 'Inès', 'Arthur', 'Sofia', 'Yanis', 'Maëlle', 'Gabriel', 'Alma', 'Timéo']
const LAST = ['Favre', 'Rochat', 'Keller', 'Bernasconi', 'Schmid', 'Weber', 'Huber', 'Meier', 'Gerber', 'Rossi', 'Brunner', 'Dubois', 'Steiner', 'Pasche', 'Monnier', 'Perret']

/** Prénom + nom inédits dans l’équipe. */
export function freshName(taken: Array<{ firstName: string; lastName: string }>) {
  const used = new Set(taken.map((a) => `${a.firstName} ${a.lastName}`.toLowerCase()))
  const firsts = new Set(taken.map((a) => a.firstName.toLowerCase()))
  const seed = taken.length * 7 + Date.now() % 97
  for (let i = 0; i < FIRST.length * LAST.length; i += 1) {
    const first = FIRST[(seed + i) % FIRST.length]!
    const last = LAST[(seed * 3 + i * 5) % LAST.length]!
    if (!firsts.has(first.toLowerCase()) && !used.has(`${first} ${last}`.toLowerCase())) return { firstName: first, lastName: last }
  }
  return { firstName: FIRST[seed % FIRST.length]!, lastName: LAST[seed % LAST.length]! }
}
