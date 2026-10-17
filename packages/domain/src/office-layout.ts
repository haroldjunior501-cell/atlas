import type { Id, Presence } from './model'
import {
  ARCHETYPES,
  detectArchetype,
  zoneForDepartment,
  type ArchetypeSpaceKind,
  type ArchetypeTheme,
  type OfficeArchetype,
} from './office-archetype'

/** Source d’entrée pour le générateur — l’organisation est la vérité. */
export interface OfficeOrgAgent {
  id: Id
  firstName: string
  lastName: string
  role: string
  face?: string | null
  status?: Presence
  avatarStyle?: string
  currentTaskId?: string | null
}

export interface OfficeOrgDepartment {
  id: Id
  name: string
  type?: string
  color?: string
  agents: OfficeOrgAgent[]
}

export interface OfficeOrgTool {
  id: Id
  provider: string
  departmentId?: Id | null
}

export interface OfficeOrgSwarm {
  id: Id
  name: string
  agentIds: Id[]
}

export interface OfficeOrgInput {
  id: Id
  name: string
  departments: OfficeOrgDepartment[]
  tools?: OfficeOrgTool[]
  swarms?: OfficeOrgSwarm[]
  sector?: string
  businessModel?: string
  intention?: string
  /** Force un environnement ; sinon ATLAS le déduit du métier. */
  archetype?: OfficeArchetype
  /** Zones ajoutées ou retirées à la demande (ids de pièces hors départements). */
  spaces?: { added?: OfficeExtraSpace[]; removed?: string[] }
}

export interface OfficeExtraSpace {
  id: string
  kind: OfficeSpaceKind
  name: string
}

/** Grammaire des espaces : bureau moderne + zones métier. */
export type OfficeSpaceKind =
  | 'private_office'
  | 'cubicle'
  | 'open_space'
  | 'team_zone'
  | 'meeting_medium'
  | 'project_room'
  | 'enclave'
  | 'focus_room'
  | 'phone_booth'
  | 'cafeteria'
  | 'lounge'
  | 'lobby'
  | 'kitchen'
  | 'archive'
  | 'storage'
  | 'reception'
  | ArchetypeSpaceKind

export type DeskStyle = 'rect' | 'l_shape' | 'u_shape' | 'bench' | 'standing'

export type OfficePropKind =
  | 'plant'
  | 'cabinet'
  | 'server'
  | 'mailbox'
  | 'printer'
  | 'sofa'
  | 'table'
  | 'round_table'
  | 'whiteboard'
  | 'tv'
  | 'bookshelf'
  | 'locker'
  | 'coffee'
  | 'fridge'
  | 'microwave'
  | 'lamp'
  | 'partition'
  | 'phone_booth'
  | 'rug'
  | 'reception_desk'
  | 'chair'
  | 'tree'
  // Véhicules
  | 'car'
  | 'van'
  | 'truck'
  | 'ambulance'
  | 'forklift'
  | 'scooter'
  // Automobile
  | 'car_lift'
  | 'tool_cabinet'
  | 'tire_stack'
  | 'display_podium'
  | 'flag_banner'
  | 'bay_marking'
  | 'parking_line'
  | 'counter'
  | 'chairs_row'
  | 'logo_wall'
  // Agence
  | 'moodboard'
  | 'easel'
  | 'big_screen'
  | 'backdrop'
  | 'camera_tripod'
  | 'softbox'
  | 'bean_bag'
  | 'ping_pong'
  | 'neon_sign'
  // Restauration
  | 'stove'
  | 'prep_table'
  | 'fridge_pro'
  | 'pass_counter'
  | 'dining_table'
  | 'bar_counter'
  | 'parasol_table'
  | 'planter'
  | 'guest'
  // Santé
  | 'exam_bed'
  | 'medical_cart'
  | 'lab_bench'
  | 'wall_partition'
  // Logistique / industrie
  | 'pallet_rack'
  | 'pallet'
  | 'conveyor'
  | 'pack_table'
  | 'box_stack'
  | 'dock_door'
  | 'cnc_machine'
  | 'robot_arm'
  | 'measure_machine'
  | 'shelving'
  // Commerce
  | 'retail_shelf'
  | 'display_table'
  | 'mannequin'
  | 'checkout_counter'
  | 'fitting_booth'
  | 'shopper'
  // Tech / immobilier
  | 'server_rack'
  | 'listing_board'
  | 'model_table'

export type FloorFinish = 'carpet' | 'wood' | 'concrete' | 'tile' | 'asphalt'

export interface OfficeRoom {
  id: Id
  departmentId: Id | null
  name: string
  kind: OfficeSpaceKind
  /** Compat ancienne API CreationTheater. */
  legacyKind?: 'department' | 'lobby' | 'pause' | 'meeting'
  color: string
  floor: FloorFinish
  glass: boolean
  wallHeight: number
  /** Zone extérieure (parking, cour, terrasse) : pas de murs. */
  outdoor: boolean
  x: number
  z: number
  w: number
  d: number
}

export interface OfficeDesk {
  id: Id
  roomId: Id
  departmentId: Id | null
  style: DeskStyle
  x: number
  z: number
  rotation: number
  agentId: Id | null
  hasMonitor: boolean
  hasLamp: boolean
  hasPedestal: boolean
}

export interface OfficeAgentPlacement {
  id: Id
  deskId: Id
  roomId: Id
  departmentId: Id | null
  name: string
  role: string
  face: string | null
  status: Presence
  avatarStyle: string
  /** Pipeline photoréaliste : flame | splat | exavatar */
  renderMode: 'portrait' | 'flame' | 'splat' | 'exavatar'
  x: number
  z: number
  rotation: number
  color: string
  pose: 'sit' | 'stand'
  /** Poste occupé : desk, lift, stove, exam, counter, machine… */
  station: string
  /** L’agent circule entre son poste et les allées. */
  wander: boolean
}

export interface OfficeProp {
  id: Id
  kind: OfficePropKind
  roomId: Id
  x: number
  z: number
  rotation: number
  scale?: number
  label?: string
  provider?: string
  color?: string
  /** Emprise au sol (marquages, rayonnages, convoyeurs). */
  w?: number
  d?: number
  /** Animation : véhicule qui roule, chariot qui patrouille, bras robot. */
  motion?: 'drive' | 'patrol' | 'spin'
  /** Bornes de la trajectoire pour drive / patrol (axe x). */
  path?: { x0: number; x1: number }
  /** Élément suivi dans les données opérationnelles (véhicule, machine…). */
  assetId?: string
}

export interface OfficeLabel {
  id: Id
  roomId: Id
  text: string
  color: string
  x: number
  z: number
  /** Label imprimé au sol (style jumeau numérique). */
  floorPrint?: boolean
  size?: 'zone' | 'bay'
}

export interface OfficeWalkway {
  z: number
  x0: number
  x1: number
}

export interface OfficeLayout {
  id: Id
  organizationId: Id
  version: number
  cellSize: number
  width: number
  depth: number
  /** Qualité cible du rendu front. */
  quality: 'studio' | 'hyper'
  archetype: OfficeArchetype
  archetypeLabel: string
  theme: ArchetypeTheme
  building: { x: number; z: number; w: number; d: number; entranceX: number }
  walkways: OfficeWalkway[]
  rooms: OfficeRoom[]
  desks: OfficeDesk[]
  agents: OfficeAgentPlacement[]
  props: OfficeProp[]
  labels: OfficeLabel[]
}

const PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#ea580c', '#db2777',
  '#0891b2', '#ca8a04', '#4f46e5', '#0d9488', '#c026d3',
]

const DEPT_COLOR: Array<{ test: RegExp; color: string }> = [
  { test: /direction|ceo|exec|gestion|admin|jurid/i, color: '#7c3aed' },
  { test: /vente|sales|commercial|revenu/i, color: '#2563eb' },
  { test: /support|succ[eè]s|accueil|patient|logistique/i, color: '#059669' },
  { test: /compta|financ|tr[eé]sor|rh|ressource/i, color: '#ea580c' },
  { test: /market|croissance|com|brand/i, color: '#db2777' },
  { test: /produit|tech|d[eé]v|ing[eé]n|produ?ction|cr[eé]a|r&d|recherche/i, color: '#0891b2' },
  { test: /ops|op[eé]ration/i, color: '#ca8a04' },
]

const CAR_COLORS = ['#f8fafc', '#111827', '#9ca3af', '#dc2626', '#1d4ed8', '#e5e7eb', '#374151', '#f8fafc']

function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash
}

export function departmentColor(name: string, fallbackIndex = 0): string {
  for (const rule of DEPT_COLOR) {
    if (rule.test.test(name)) return rule.color
  }
  return PALETTE[fallbackIndex % PALETTE.length]!
}

export function departmentType(name: string): string {
  const lower = name.toLowerCase()
  if (/direction|ceo|exec|admin|jurid/.test(lower)) return 'direction'
  if (/vente|sales|commercial|market|croissance/.test(lower)) return 'sales'
  if (/support|succ[eè]s|accueil|logistique/.test(lower)) return 'support'
  if (/compta|financ|rh|ressource/.test(lower)) return 'finance'
  if (/produit|tech|d[eé]v|produ?ction|cr[eé]a|r&d/.test(lower)) return 'product'
  if (/ops|op[eé]ration/.test(lower)) return 'ops'
  return 'general'
}

/** Style d’aménagement principal selon le type de département. */
export function primarySpaceForDept(type: string, agentCount: number): OfficeSpaceKind {
  if (type === 'direction' || type === 'finance') {
    return agentCount <= 2 ? 'private_office' : 'cubicle'
  }
  if (type === 'sales') return 'cubicle'
  if (type === 'product') return agentCount >= 4 ? 'open_space' : 'team_zone'
  return 'open_space'
}

const OUTDOOR = new Set<OfficeSpaceKind>(['parking', 'truck_yard', 'terrace'])
const FRONT = new Set<OfficeSpaceKind>(['lobby', 'reception', 'service_desk', 'waiting_room', 'showroom', 'dining_room', 'sales_floor', 'listing_wall', 'loading_dock', 'checkout'])
const STANDARD = new Set<OfficeSpaceKind>([
  'private_office', 'cubicle', 'open_space', 'team_zone', 'meeting_medium', 'project_room', 'enclave',
  'focus_room', 'phone_booth', 'cafeteria', 'lounge', 'lobby', 'kitchen', 'archive', 'storage', 'reception',
])
const COMMON = new Set<OfficeSpaceKind>(['cafeteria', 'lounge', 'kitchen', 'phone_booth', 'focus_room'])

function footprintFor(kind: OfficeSpaceKind, agents: number): { w: number; d: number; cols: number; rows: number } {
  const n = Math.max(agents, kind === 'phone_booth' || kind === 'focus_room' ? 0 : 1)
  const span = (per: number, min: number, pad: number) => Math.max(min, Math.ceil(n * per + pad))
  switch (kind) {
    case 'private_office':
      return { cols: 1, rows: Math.max(1, n), w: 5, d: Math.max(5, 4 + n * 2) }
    case 'cubicle': {
      const cols = Math.min(3, Math.max(1, n))
      const rows = Math.max(1, Math.ceil(n / cols))
      return { cols, rows, w: cols * 3 + 2, d: rows * 3 + 2 }
    }
    case 'open_space':
    case 'team_zone':
    case 'creative_studio': {
      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))))
      const rows = Math.max(1, Math.ceil(n / cols))
      return { cols, rows, w: cols * 3 + 3, d: rows * 3 + (kind === 'creative_studio' ? 5 : 3) }
    }
    case 'meeting_medium': return { cols: 0, rows: 0, w: 8, d: 6 }
    case 'project_room': return { cols: 0, rows: 0, w: 7, d: 6 }
    case 'enclave': return { cols: 0, rows: 0, w: 4, d: 4 }
    case 'focus_room': return { cols: 0, rows: 0, w: 3, d: 3 }
    case 'phone_booth': return { cols: 0, rows: 0, w: 2, d: 2 }
    case 'cafeteria': return { cols: 0, rows: 0, w: 8, d: 6 }
    case 'lounge': return { cols: 0, rows: 0, w: 6, d: 5 }
    case 'lobby':
    case 'reception': return { cols: 0, rows: 0, w: 7, d: 5 }
    case 'kitchen': return { cols: 0, rows: 0, w: 4, d: 4 }
    case 'archive':
    case 'storage': return { cols: 0, rows: 0, w: 4, d: 5 }
    // Zones métier
    case 'workshop': return { cols: 0, rows: 0, w: Math.min(8, Math.max(4, agents)) * 4 + 1, d: 8 }
    case 'showroom': return { cols: 0, rows: 0, w: span(3.2, 15, 5), d: 10 }
    case 'parts_store': return { cols: 0, rows: 0, w: span(2, 8, 6), d: 7 }
    case 'service_desk': return { cols: 0, rows: 0, w: span(2.6, 8, 3), d: 6 }
    case 'parking': return { cols: 0, rows: 0, w: 24, d: 8 }
    case 'delivery_bay': return { cols: 0, rows: 0, w: 7, d: 7 }
    case 'photo_studio': return { cols: 0, rows: 0, w: 8, d: 7 }
    case 'pitch_room': return { cols: 0, rows: 0, w: 8, d: 6 }
    case 'war_room': return { cols: 0, rows: 0, w: span(2.6, 8, 3), d: 6 }
    case 'kitchen_pro': return { cols: 0, rows: 0, w: span(2.4, 10, 3), d: 7 }
    case 'dining_room': return { cols: 0, rows: 0, w: 14, d: 10 }
    case 'terrace': return { cols: 0, rows: 0, w: 12, d: 6 }
    case 'cold_room': return { cols: 0, rows: 0, w: 5, d: 5 }
    case 'waiting_room': return { cols: 0, rows: 0, w: span(2.6, 9, 4), d: 7 }
    case 'exam_room': return { cols: 0, rows: 0, w: Math.max(3, agents) * 4 + 1, d: 6 }
    case 'lab': return { cols: 0, rows: 0, w: span(2.6, 8, 3), d: 6 }
    case 'pharmacy': return { cols: 0, rows: 0, w: 5, d: 5 }
    case 'warehouse': return { cols: 0, rows: 0, w: span(2.2, 16, 6), d: 12 }
    case 'loading_dock': return { cols: 0, rows: 0, w: span(2.5, 12, 4), d: 6 }
    case 'packing_area': return { cols: 0, rows: 0, w: span(2.6, 10, 4), d: 7 }
    case 'truck_yard': return { cols: 0, rows: 0, w: 20, d: 9 }
    case 'sales_floor': return { cols: 0, rows: 0, w: 15, d: 11 }
    case 'checkout': return { cols: 0, rows: 0, w: span(2.8, 7, 3), d: 5 }
    case 'stockroom': return { cols: 0, rows: 0, w: 8, d: 6 }
    case 'fitting_rooms': return { cols: 0, rows: 0, w: 7, d: 4 }
    case 'server_room': return { cols: 0, rows: 0, w: 7, d: 6 }
    case 'listing_wall': return { cols: 0, rows: 0, w: span(3.2, 12, 4), d: 8 }
    case 'production_line': return { cols: 0, rows: 0, w: span(3.2, 16, 4), d: 9 }
    case 'quality_lab': return { cols: 0, rows: 0, w: 7, d: 6 }
    default: return { cols: 2, rows: 2, w: 8, d: 6 }
  }
}

function deskStyleFor(space: OfficeSpaceKind, role: string): DeskStyle {
  if (space === 'private_office') {
    if (/ceo|directeur|directrice|ministre|fondateur|g[eé]rant/i.test(role)) return 'u_shape'
    return 'l_shape'
  }
  if (space === 'cubicle') return 'l_shape'
  if (space === 'open_space' || space === 'creative_studio') return 'bench'
  return 'rect'
}

function toolPropKind(provider: string): OfficePropKind {
  if (/slack|teams|discord|telegram/.test(provider)) return 'server'
  if (/gmail|outlook|resend|mail/.test(provider)) return 'mailbox'
  if (/drive|notion|dropbox|onedrive/.test(provider)) return 'bookshelf'
  if (/stripe|crm|hubspot|analytics/.test(provider)) return 'printer'
  return 'server'
}

function roomMeta(kind: OfficeSpaceKind): Pick<OfficeRoom, 'floor' | 'glass' | 'wallHeight' | 'legacyKind' | 'outdoor'> {
  if (OUTDOOR.has(kind)) {
    return { floor: kind === 'terrace' ? 'wood' : 'asphalt', glass: false, wallHeight: 0, legacyKind: 'department', outdoor: true }
  }
  if (kind === 'lobby' || kind === 'reception') {
    return { floor: 'tile', glass: true, wallHeight: 0.55, legacyKind: 'lobby', outdoor: false }
  }
  if (kind === 'cafeteria' || kind === 'lounge' || kind === 'kitchen') {
    return { floor: 'wood', glass: false, wallHeight: 0.5, legacyKind: 'pause', outdoor: false }
  }
  if (kind === 'meeting_medium' || kind === 'project_room' || kind === 'enclave' || kind === 'pitch_room') {
    return { floor: 'carpet', glass: true, wallHeight: 0.85, legacyKind: 'meeting', outdoor: false }
  }
  if (kind === 'focus_room' || kind === 'phone_booth' || kind === 'private_office') {
    return { floor: 'carpet', glass: kind !== 'private_office', wallHeight: 1.05, legacyKind: 'department', outdoor: false }
  }
  if (['workshop', 'parts_store', 'warehouse', 'loading_dock', 'packing_area', 'production_line', 'stockroom', 'cold_room', 'delivery_bay', 'archive', 'storage'].includes(kind)) {
    return { floor: 'concrete', glass: false, wallHeight: 1.2, legacyKind: 'department', outdoor: false }
  }
  if (['showroom', 'server_room', 'war_room', 'listing_wall', 'lab', 'quality_lab', 'photo_studio'].includes(kind)) {
    return { floor: 'tile', glass: true, wallHeight: 0.9, legacyKind: 'department', outdoor: false }
  }
  if (['kitchen_pro', 'exam_room', 'pharmacy', 'waiting_room', 'checkout', 'sales_floor', 'fitting_rooms', 'service_desk'].includes(kind)) {
    return { floor: 'tile', glass: false, wallHeight: 0.8, legacyKind: 'department', outdoor: false }
  }
  if (kind === 'dining_room') return { floor: 'wood', glass: false, wallHeight: 0.6, legacyKind: 'department', outdoor: false }
  return { floor: 'carpet', glass: kind === 'open_space' || kind === 'cubicle', wallHeight: 0.72, legacyKind: 'department', outdoor: false }
}

function annexesForDept(type: string, agentCount: number): OfficeSpaceKind[] {
  const extra: OfficeSpaceKind[] = []
  if (type === 'direction') {
    extra.push('meeting_medium')
    if (agentCount >= 1) extra.push('focus_room')
  }
  if (type === 'product') extra.push('project_room', 'team_zone', 'focus_room')
  if (type === 'sales') extra.push('meeting_medium', 'phone_booth', 'phone_booth')
  if (type === 'support') extra.push('storage', 'enclave')
  if (type === 'finance') extra.push('archive', 'enclave')
  if (type === 'general' || type === 'ops') extra.push('enclave')
  return extra
}

type Planned = {
  id: string
  name: string
  kind: OfficeSpaceKind
  departmentId: Id | null
  color: string
  agents: OfficeOrgAgent[]
  w: number
  d: number
  cols: number
  rows: number
  rank: number
}

function rankOf(kind: OfficeSpaceKind, archetype: OfficeArchetype): number {
  if (FRONT.has(kind)) return 0
  if (COMMON.has(kind)) return 3
  if (!STANDARD.has(kind)) return 1
  return archetype === 'corporate' ? 1 : 2
}

/**
 * Cœur du système : l’organisation → environnement 3D propre à son métier.
 */
export function generateLayout(org: OfficeOrgInput, version = 1): OfficeLayout {
  const departments = org.departments.filter((d) => d.name.trim())
  const agentTotal = departments.reduce((sum, d) => sum + d.agents.length, 0)
  const archetype = org.archetype ?? detectArchetype({
    name: org.name,
    sector: org.sector,
    businessModel: org.businessModel,
    intention: org.intention,
    departments: departments.map((d) => d.name),
    roles: departments.flatMap((d) => d.agents.map((a) => a.role)),
  })
  const spec = ARCHETYPES[archetype]
  const accent = spec.theme.accent

  const planned: Planned[] = []
  const taken = new Set<OfficeSpaceKind>()
  const removed = new Set(org.spaces?.removed ?? [])
  const plan = (item: Omit<Planned, 'w' | 'd' | 'cols' | 'rows' | 'rank'>) => {
    if (item.id !== item.departmentId && (removed.has(item.id) || removed.has(`${org.id}-room-${item.id}`))) return
    planned.push({ ...item, ...footprintFor(item.kind, item.agents.length), rank: rankOf(item.kind, archetype) })
    taken.add(item.kind)
  }

  for (const sig of spec.signature.filter((s) => s.kind === 'lobby' || s.kind === 'reception')) {
    plan({ id: `__${sig.key}__`, name: sig.name, kind: sig.kind as OfficeSpaceKind, departmentId: null, color: accent, agents: [] })
  }

  for (const [index, dept] of departments.entries()) {
    const type = dept.type || departmentType(dept.name)
    const color = dept.color || departmentColor(dept.name, index)
    const zone = archetype === 'corporate' ? null : zoneForDepartment(archetype, dept.name, dept.agents.map((a) => a.role))
    const kind = (zone as OfficeSpaceKind | null) ?? primarySpaceForDept(type, dept.agents.length)
    plan({ id: dept.id, name: dept.name, kind, departmentId: dept.id, color, agents: dept.agents })
    const annexes = archetype === 'corporate' || archetype === 'tech'
      ? annexesForDept(type, dept.agents.length)
      : !zone && type === 'direction' ? ['meeting_medium' as OfficeSpaceKind] : []
    for (const [ai, annex] of annexes.entries()) {
      if (archetype !== 'corporate' && taken.has(annex)) continue
      plan({ id: `${dept.id}-ax-${ai}-${annex}`, name: labelForKind(annex, dept.name), kind: annex, departmentId: dept.id, color, agents: [] })
    }
  }

  for (const sig of spec.signature) {
    if (taken.has(sig.kind as OfficeSpaceKind)) continue
    plan({ id: `__${sig.key}__`, name: sig.name, kind: sig.kind as OfficeSpaceKind, departmentId: null, color: accent, agents: [] })
  }

  if (archetype !== 'corporate' || agentTotal >= 3) {
    const commons: Array<{ key: string; name: string; kind: string }> = [...spec.commons]
    for (const common of commons) {
      plan({ id: `__${common.key}__`, name: common.name, kind: common.kind as OfficeSpaceKind, departmentId: null, color: '#94a3b8', agents: [] })
    }
  }
  for (const extra of org.spaces?.added ?? []) {
    plan({ id: `x-${extra.id}`, name: extra.name, kind: extra.kind, departmentId: null, color: accent, agents: [] })
  }
  if ((org.swarms?.length ?? 0) > 0) {
    plan({ id: '__swarm__', name: 'Swarm', kind: 'project_room', departmentId: null, color: '#a78bfa', agents: [] })
  }

  // ---- Implantation : extérieur devant, bâtiment derrière, allées entre les rangées.
  const outdoor = planned.filter((p) => OUTDOOR.has(p.kind))
  const indoor = planned
    .filter((p) => !OUTDOOR.has(p.kind))
    .map((p, order) => ({ p, order }))
    .sort((a, b) => a.p.rank - b.p.rank || a.order - b.order)
    .map(({ p }) => p)

  const area = indoor.reduce((sum, p) => sum + (p.w + 1) * (p.d + 2), 0)
  const widest = Math.max(0, ...indoor.map((p) => p.w))
  const outdoorRun = outdoor.reduce((sum, p) => sum + p.w + 1, 0)
  const innerWidth = Math.max(26, widest + 2, Math.ceil(Math.sqrt(area * 1.7)), Math.min(outdoorRun - 2, 60))

  const pos = new Map<string, { x: number; z: number }>()
  let outX = 1
  let outZ = 1
  let outRow = 0
  for (const p of outdoor) {
    if (outX > 1 && outX + p.w > innerWidth + 2) {
      outX = 1
      outZ += outRow + 1
      outRow = 0
    }
    pos.set(p.id, { x: outX, z: outZ })
    outX += p.w + 1
    outRow = Math.max(outRow, p.d)
  }
  const buildingZ = outdoor.length ? outZ + outRow + 2 : 3
  const buildingX = 1
  const corridor = 2
  const walkways: OfficeWalkway[] = []
  let cx = buildingX + 1
  let cz = buildingZ + corridor
  let rowH = 0
  walkways.push({ z: buildingZ + corridor / 2, x0: buildingX + 0.6, x1: buildingX + innerWidth - 0.6 })
  for (const p of indoor) {
    if (cx > buildingX + 1 && cx + p.w > buildingX + innerWidth) {
      cx = buildingX + 1
      cz += rowH + corridor
      walkways.push({ z: cz - corridor / 2, x0: buildingX + 0.6, x1: buildingX + innerWidth - 0.6 })
      rowH = 0
    }
    pos.set(p.id, { x: cx, z: cz })
    cx += p.w + 1
    rowH = Math.max(rowH, p.d)
  }
  const buildingD = cz + rowH + 1 - buildingZ

  const rooms: OfficeRoom[] = []
  const desks: OfficeDesk[] = []
  const agents: OfficeAgentPlacement[] = []
  const props: OfficeProp[] = []
  const labels: OfficeLabel[] = []

  for (const item of planned) {
    const at = pos.get(item.id)
    if (!at) continue
    const roomId = `${org.id}-room-${item.id}`
    const room: OfficeRoom = {
      id: roomId,
      departmentId: item.departmentId,
      name: item.name,
      kind: item.kind,
      color: item.color,
      x: at.x,
      z: at.z,
      w: item.w,
      d: item.d,
      ...roomMeta(item.kind),
    }
    rooms.push(room)
    labels.push({
      id: `${roomId}-label`,
      roomId,
      text: item.name.toUpperCase().slice(0, 22),
      color: item.departmentId ? item.color : accent,
      x: at.x + item.w / 2,
      z: at.z + 0.55,
      floorPrint: true,
      size: 'zone',
    })
    const ctx: ZoneCtx = { org: org.id, room, plan: item, accent, desks, agents, props, labels, archetype }
    if (STANDARD.has(item.kind)) furnishStandard(ctx)
    else furnishZone(ctx)
  }

  const entranceRoom = rooms.find((r) => !r.outdoor && FRONT.has(r.kind)) ?? rooms.find((r) => !r.outdoor)
  const entranceX = entranceRoom ? entranceRoom.x + entranceRoom.w / 2 : buildingX + innerWidth / 2

  const lobbyRoom = rooms.find((r) => r.kind === 'lobby' || r.kind === 'reception') ?? entranceRoom
  for (const tool of org.tools ?? []) {
    const target =
      rooms.find((r) => r.departmentId && r.departmentId === tool.departmentId && r.kind !== 'phone_booth') ||
      lobbyRoom ||
      rooms[0]
    if (!target) continue
    const jitter = (hashSeed(tool.id) % 100) / 100
    props.push({
      id: `tool-${tool.id}`,
      kind: toolPropKind(tool.provider),
      roomId: target.id,
      x: target.x + 1.4 + jitter * Math.max(1, target.w - 2.8),
      z: target.z + target.d - 1.3,
      rotation: 0,
      label: tool.provider,
      provider: tool.provider,
    })
  }

  // Arbres le long de la façade.
  const treeRoom = rooms[0]?.id ?? 'site'
  for (let x = buildingX + 2; x < buildingX + innerWidth - 1; x += 6) {
    if (Math.abs(x - entranceX) < 2.5) continue
    props.push({ id: `tree-${x}`, kind: 'tree', roomId: treeRoom, x, z: buildingZ - 0.9, rotation: 0, scale: 0.9 + ((hashSeed(`${org.id}${x}`) % 30) / 100) })
  }

  let maxX = buildingX + innerWidth + 1
  let maxZ = buildingZ + buildingD + 1
  for (const room of rooms) {
    maxX = Math.max(maxX, room.x + room.w + 1)
    maxZ = Math.max(maxZ, room.z + room.d + 1)
  }

  return {
    id: `layout-${org.id}-${archetype}-v${version}`,
    organizationId: org.id,
    version,
    cellSize: 1,
    width: maxX,
    depth: maxZ,
    quality: 'hyper',
    archetype,
    archetypeLabel: spec.label,
    theme: spec.theme,
    building: { x: buildingX, z: buildingZ, w: innerWidth, d: buildingD, entranceX },
    walkways,
    rooms,
    desks,
    agents,
    props,
    labels,
  }
}

function labelForKind(kind: OfficeSpaceKind, deptName: string): string {
  switch (kind) {
    case 'meeting_medium': return `Réunion · ${deptName}`
    case 'project_room': return `Projet · ${deptName}`
    case 'team_zone': return `Équipe · ${deptName}`
    case 'enclave': return `Enclave · ${deptName}`
    case 'focus_room': return `Focus · ${deptName}`
    case 'phone_booth': return 'Cabine'
    case 'archive': return 'Archives'
    case 'storage': return 'Stock'
    default: return kind
  }
}

interface ZoneCtx {
  org: Id
  room: OfficeRoom
  plan: Planned
  accent: string
  archetype: OfficeArchetype
  desks: OfficeDesk[]
  agents: OfficeAgentPlacement[]
  props: OfficeProp[]
  labels: OfficeLabel[]
}

function facing(fromX: number, fromZ: number, toX: number, toZ: number) {
  return Math.atan2(toX - fromX, toZ - fromZ)
}

function placeAgent(
  ctx: ZoneCtx,
  agent: OfficeOrgAgent,
  spot: { x: number; z: number; rotation: number; pose: 'sit' | 'stand'; station: string; deskId?: string; wander?: boolean },
) {
  ctx.agents.push({
    id: agent.id,
    deskId: spot.deskId ?? `${ctx.room.id}-st-${agent.id}`,
    roomId: ctx.room.id,
    departmentId: ctx.plan.departmentId,
    name: `${agent.firstName} ${agent.lastName}`.trim(),
    role: agent.role,
    face: agent.face ?? null,
    status: agent.status ?? 'online',
    avatarStyle: agent.avatarStyle || 'portrait',
    renderMode: agent.face ? 'portrait' : 'flame',
    x: spot.x,
    z: spot.z,
    rotation: spot.rotation,
    color: ctx.plan.color,
    pose: spot.pose,
    station: spot.station,
    wander: spot.wander ?? agent.status === 'idle',
  })
}

function seatAtDesk(ctx: ZoneCtx, agent: OfficeOrgAgent, x: number, z: number, style: DeskStyle, facingFront = false) {
  const deskId = `${ctx.room.id}-desk-${agent.id}`
  ctx.desks.push({
    id: deskId,
    roomId: ctx.room.id,
    departmentId: ctx.plan.departmentId,
    style,
    x,
    z,
    rotation: facingFront ? Math.PI : 0,
    agentId: agent.id,
    hasMonitor: true,
    hasLamp: style === 'l_shape' || style === 'u_shape',
    hasPedestal: style !== 'bench',
  })
  placeAgent(ctx, agent, {
    x,
    z: facingFront ? z - 0.55 : z + 0.55,
    rotation: facingFront ? 0 : Math.PI,
    pose: 'sit',
    station: 'desk',
    deskId,
  })
}

/** Agents en surplus : debout dans la zone, en circulation. */
function overflow(ctx: ZoneCtx, extra: OfficeOrgAgent[]) {
  const { room } = ctx
  extra.forEach((agent, index) => {
    const x = room.x + 1.2 + ((index * 1.6) % Math.max(1.6, room.w - 2.4))
    const z = room.z + 1.6 + Math.floor((index * 1.6) / Math.max(1.6, room.w - 2.4)) * 1.2
    placeAgent(ctx, agent, { x, z, rotation: 0, pose: 'stand', station: 'floor', wander: true })
  })
}

function furnishZone(ctx: ZoneCtx) {
  const { room, plan, props, labels, accent } = ctx
  const X = room.x
  const Z = room.z
  const W = room.w
  const D = room.d
  const cx = X + W / 2
  const cz = Z + D / 2
  const people = plan.agents
  const seed = hashSeed(room.id)
  let n = 0
  const add = (kind: OfficePropKind, x: number, z: number, extra: Partial<OfficeProp> = {}) => {
    n += 1
    props.push({ id: `${room.id}-${kind}-${n}`, kind, roomId: room.id, x, z, rotation: 0, ...extra })
  }
  const carColor = (i: number) => CAR_COLORS[(seed + i * 3) % CAR_COLORS.length]!

  switch (room.kind) {
    case 'workshop': {
      const bays = Math.round((W - 1) / 4)
      for (let i = 0; i < bays; i += 1) {
        const bx = X + 0.5 + i * 4 + 2
        add('bay_marking', bx, cz + 0.4, { w: 3.6, d: D - 1.6, color: accent })
        add('car_lift', bx, cz + 0.4, { color: accent })
        if (i < Math.max(people.length, bays - 1)) add('car', bx, cz + 0.4, { color: carColor(i), assetId: `${room.id}-veh-${i}`, scale: 1, label: 'lift' })
        add('tool_cabinet', bx - 1.3, Z + 1.1, { color: accent })
        labels.push({ id: `${room.id}-bay-${i}`, roomId: room.id, text: `P${String(i + 1).padStart(2, '0')}`, color: accent, x: bx, z: Z + D - 0.7, floorPrint: true, size: 'bay' })
        const agent = people[i]
        if (agent) placeAgent(ctx, agent, { x: bx + 1.45, z: cz - 0.6, rotation: facing(bx + 1.45, cz - 0.6, bx, cz + 0.4), pose: 'stand', station: 'lift' })
      }
      add('tire_stack', X + W - 0.9, Z + 1.1)
      add('tire_stack', X + W - 0.9, Z + 1.9)
      overflow(ctx, people.slice(bays))
      break
    }
    case 'showroom': {
      const cars = Math.max(3, Math.min(5, Math.floor((W - 2) / 4)))
      for (let i = 0; i < cars; i += 1) {
        const x = X + 2.4 + i * ((W - 4.8) / Math.max(1, cars - 1))
        add('display_podium', x, Z + 3.6, { color: accent })
        add('car', x, Z + 3.6, { color: carColor(i + 2), rotation: 0.5 + (i % 2) * -1, assetId: `${room.id}-veh-${i}`, label: 'show' })
      }
      add('logo_wall', cx, Z + D - 0.35, { color: accent, w: Math.min(8, W - 4) })
      add('flag_banner', X + 0.8, Z + 0.9, { color: accent })
      add('flag_banner', X + W - 0.8, Z + 0.9, { color: accent })
      add('plant', X + 0.9, Z + D - 1)
      add('plant', X + W - 0.9, Z + D - 1)
      people.forEach((agent, i) => {
        const x = X + 2 + i * 3.2
        add('chairs_row', x, Z + D - 3.7, { scale: 0.45 })
        seatAtDesk(ctx, agent, x, Z + D - 2.8, 'rect')
      })
      break
    }
    case 'parts_store': {
      const racks = Math.max(2, Math.floor((W - 3) / 2.2))
      for (let i = 0; i < racks; i += 1) add('pallet_rack', X + 1.4 + i * 2.2, Z + D - 2.6, { w: 3.2, rotation: Math.PI / 2, color: accent })
      add('counter', cx, Z + 1.5, { w: Math.min(5, W - 2) })
      add('tire_stack', X + W - 0.9, Z + 1)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: cx - 1 + i * 1.4, z: Z + 2.3, rotation: Math.PI, pose: 'stand', station: 'counter' }))
      break
    }
    case 'service_desk': {
      add('counter', cx, Z + D - 2, { w: W - 2.4, color: accent })
      add('chairs_row', cx - 1.6, Z + 1.6)
      add('chairs_row', cx + 1.6, Z + 1.6)
      add('coffee', X + W - 0.8, Z + 1)
      add('plant', X + 0.8, Z + 1)
      add('tv', cx, Z + D - 0.4)
      people.forEach((agent, i) => {
        const x = X + 1.8 + i * 2.6
        placeAgent(ctx, agent, { x, z: Z + D - 1.35, rotation: Math.PI, pose: 'stand', station: 'counter' })
      })
      break
    }
    case 'parking': {
      const spots = Math.floor((W - 1) / 2.6)
      const clinic = ctx.archetype === 'clinic'
      for (let i = 0; i < spots; i += 1) {
        const x = X + 1.8 + i * 2.6
        add('parking_line', x - 1.3, Z + D - 2.3, { d: 4 })
        const filled = (seed >> (i % 16)) & 1 || i % 3 === 0
        if (clinic && i < 2) add('ambulance', x, Z + D - 2.3, { rotation: Math.PI, assetId: `${room.id}-veh-${i}` })
        else if (filled) add('car', x, Z + D - 2.3, { color: carColor(i), rotation: Math.PI, assetId: `${room.id}-veh-${i}`, label: 'parked' })
      }
      add('parking_line', X + W - 0.5, Z + D - 2.3, { d: 4 })
      add('car', X + 2, Z + 1.4, { color: carColor(7), rotation: Math.PI / 2, motion: 'drive', path: { x0: X + 1.5, x1: X + W - 1.5 } })
      overflow(ctx, people)
      break
    }
    case 'delivery_bay': {
      add('display_podium', cx, cz + 0.4, { color: accent, scale: 1.1 })
      add('car', cx, cz + 0.4, { color: carColor(5), rotation: -0.6, assetId: `${room.id}-veh-0`, label: 'delivery' })
      add('flag_banner', X + 0.8, Z + D - 1, { color: accent })
      add('plant', X + W - 0.8, Z + D - 1)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: cx + 2 - i * 0.9, z: cz - 1.8, rotation: facing(cx + 2, cz - 1.8, cx, cz), pose: 'stand', station: 'delivery' }))
      break
    }
    case 'creative_studio': {
      const cols = plan.cols || 2
      people.forEach((agent, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        seatAtDesk(ctx, agent, X + 2 + col * 3, Z + 2 + row * 3, 'bench')
      })
      const boards = Math.max(2, Math.floor((W - 2) / 3))
      for (let i = 0; i < boards; i += 1) add('moodboard', X + 1.6 + i * 3, Z + D - 0.35, { color: accent })
      add('easel', X + W - 1, Z + D - 1.6)
      add('bean_bag', X + 1, Z + D - 1.6, { color: accent })
      add('plant', X + W - 0.8, Z + 0.9)
      break
    }
    case 'photo_studio': {
      add('backdrop', cx, Z + D - 1, { w: 4.2 })
      add('softbox', cx - 2.2, cz)
      add('softbox', cx + 2.2, cz)
      add('camera_tripod', cx, Z + 2, { rotation: 0 })
      add('display_table', cx, Z + D - 2.2, { scale: 0.7 })
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: cx - 0.7 + i * 1.4, z: Z + 1.3, rotation: 0, pose: 'stand', station: 'camera' }))
      break
    }
    case 'pitch_room': {
      add('round_table', cx, cz, { scale: 1.4 })
      add('big_screen', cx, Z + D - 0.35, { w: 3.2, color: accent })
      const seats = Math.max(6, people.length)
      for (let i = 0; i < seats; i += 1) {
        const a = (i / seats) * Math.PI * 2
        const x = cx + Math.sin(a) * 1.55
        const z = cz + Math.cos(a) * 1.15
        const agent = people[i]
        add('chair', x, z, { rotation: facing(x, z, cx, cz) })
        if (agent) placeAgent(ctx, agent, { x, z, rotation: facing(x, z, cx, cz), pose: 'sit', station: 'meeting' })
      }
      add('plant', X + 0.8, Z + 0.8)
      break
    }
    case 'war_room': {
      const screens = Math.max(2, Math.floor((W - 2) / 2.8))
      for (let i = 0; i < screens; i += 1) add('big_screen', X + 1.6 + i * 2.8, Z + D - 0.35, { w: 2.4, color: accent })
      people.forEach((agent, i) => {
        const x = X + 1.6 + i * 2.6
        const deskId = `${room.id}-desk-${agent.id}`
        ctx.desks.push({ id: deskId, roomId: room.id, departmentId: plan.departmentId, style: 'rect', x, z: Z + D - 2.6, rotation: Math.PI, agentId: agent.id, hasMonitor: true, hasLamp: false, hasPedestal: false })
        placeAgent(ctx, agent, { x, z: Z + D - 3.15, rotation: 0, pose: 'sit', station: 'desk', deskId })
      })
      add('neon_sign', X + 0.6, cz, { rotation: Math.PI / 2, color: accent })
      break
    }
    case 'kitchen_pro': {
      const stations = Math.max(3, people.length)
      const step = (W - 2) / stations
      for (let i = 0; i < stations; i += 1) add('stove', X + 1 + step * (i + 0.5), Z + D - 0.8)
      add('prep_table', cx, cz - 0.2, { w: W - 3 })
      add('pass_counter', cx, Z + 0.9, { w: W - 3, color: accent })
      add('fridge_pro', X + W - 0.7, cz)
      people.forEach((agent, i) => {
        const x = X + 1 + step * (i + 0.5)
        placeAgent(ctx, agent, { x, z: Z + D - 1.9, rotation: 0, pose: 'stand', station: 'stove' })
      })
      break
    }
    case 'dining_room': {
      const cols = 4
      const rows = 3
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const x = X + 1.8 + c * 2.7
          const z = Z + 1.8 + r * 2.6
          add('dining_table', x, z)
          if ((seed >> ((r * cols + c) % 16)) & 1) add('guest', x - 0.55, z, { rotation: Math.PI / 2, color: CAR_COLORS[(r + c) % CAR_COLORS.length] })
          if ((seed >> ((r * cols + c + 5) % 16)) & 1) add('guest', x + 0.55, z, { rotation: -Math.PI / 2, color: PALETTE[(r * 3 + c) % PALETTE.length] })
        }
      }
      add('bar_counter', X + W - 1.2, cz, { d: D - 3, rotation: Math.PI / 2, color: accent })
      add('plant', X + 0.8, Z + 0.8)
      people.forEach((agent, i) => {
        const bartender = /bar/i.test(agent.role)
        const x = bartender ? X + W - 0.5 : X + 3 + (i % 3) * 2.7
        const z = bartender ? cz : Z + 3.1 + Math.floor(i / 3) * 2.6
        placeAgent(ctx, agent, { x, z, rotation: bartender ? -Math.PI / 2 : Math.PI / 2, pose: 'stand', station: bartender ? 'bar' : 'service', wander: !bartender })
      })
      break
    }
    case 'terrace': {
      for (let i = 0; i < 4; i += 1) add('parasol_table', X + 1.8 + i * 2.8, cz, { color: i % 2 ? accent : '#f8fafc' })
      add('planter', X + 0.6, Z + 0.6, { w: W - 1.2 })
      add('planter', X + 0.6, Z + D - 0.6, { w: W - 1.2 })
      add('guest', X + 2.4, cz, { rotation: -Math.PI / 2, color: '#2563eb' })
      add('guest', X + 4.6, cz + 0.4, { rotation: Math.PI / 2, color: '#db2777' })
      overflow(ctx, people)
      break
    }
    case 'cold_room': {
      add('shelving', X + 0.8, cz, { w: D - 1.6, rotation: Math.PI / 2 })
      add('shelving', X + W - 0.8, cz, { w: D - 1.6, rotation: Math.PI / 2 })
      add('fridge_pro', cx, Z + D - 0.7)
      add('box_stack', cx, cz)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: cx - 0.6 + i * 1.2, z: Z + 1.4, rotation: Math.PI, pose: 'stand', station: 'stock' }))
      break
    }
    case 'waiting_room': {
      add('counter', cx, Z + D - 1.9, { w: Math.min(W - 2, Math.max(3, people.length * 2.4)), color: accent })
      for (let i = 0; i < 3; i += 1) add('chairs_row', X + 1.8 + i * ((W - 3.6) / 2), Z + 1.6)
      add('guest', X + 1.6, Z + 1.6, { color: '#64748b' })
      add('plant', X + 0.7, Z + D - 0.8)
      add('tv', X + W - 0.5, cz, { rotation: -Math.PI / 2 })
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: cx - (people.length - 1) * 1.2 + i * 2.4, z: Z + D - 1.2, rotation: Math.PI, pose: 'sit', station: 'counter' }))
      break
    }
    case 'exam_room': {
      const cabins = Math.round((W - 1) / 4)
      for (let i = 0; i < cabins; i += 1) {
        const bx = X + 0.5 + i * 4 + 2
        if (i > 0) add('wall_partition', bx - 2, cz + 0.4, { d: D - 1.6 })
        add('exam_bed', bx - 0.4, cz + 0.7, { rotation: Math.PI / 2 })
        add('medical_cart', bx + 1.3, Z + D - 1)
        add('table', bx + 1.2, Z + 1.3, { scale: 0.5 })
        labels.push({ id: `${room.id}-cab-${i}`, roomId: room.id, text: `S${String(i + 1).padStart(2, '0')}`, color: accent, x: bx, z: Z + D - 0.6, floorPrint: true, size: 'bay' })
        const agent = people[i]
        if (agent) placeAgent(ctx, agent, { x: bx + 0.9, z: cz + 0.3, rotation: facing(bx + 0.9, cz + 0.3, bx - 0.4, cz + 0.7), pose: 'stand', station: 'exam' })
        if ((seed >> i) & 1) add('guest', bx - 0.4, cz + 0.7, { rotation: Math.PI / 2, color: '#93c5fd' })
      }
      overflow(ctx, people.slice(cabins))
      break
    }
    case 'lab':
    case 'quality_lab': {
      const benches = Math.max(2, people.length)
      const step = (W - 2) / benches
      for (let i = 0; i < benches; i += 1) add(room.kind === 'lab' ? 'lab_bench' : 'measure_machine', X + 1 + step * (i + 0.5), Z + D - 1.3)
      add('lab_bench', cx, Z + 1.4, { w: W - 3 })
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: X + 1 + step * (i + 0.5), z: Z + D - 2.3, rotation: 0, pose: 'stand', station: 'bench' }))
      break
    }
    case 'pharmacy': {
      add('shelving', cx, Z + D - 0.7, { w: W - 1.6 })
      add('shelving', X + 0.7, cz, { w: D - 2, rotation: Math.PI / 2 })
      add('medical_cart', cx, cz)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: cx + 1 + i, z: cz, rotation: 0, pose: 'stand', station: 'stock' }))
      break
    }
    case 'warehouse': {
      const rows = Math.max(3, Math.floor((D - 3) / 2.6))
      for (let r = 0; r < rows; r += 1) add('pallet_rack', cx, Z + 2 + r * 2.6, { w: W - 4, color: accent })
      for (let r = 0; r < rows - 1; r += 1) {
        if (r % 2 === 0) add('forklift', X + 2, Z + 3.3 + r * 2.6, { motion: 'patrol', path: { x0: X + 2, x1: X + W - 2 }, color: accent, assetId: `${room.id}-fork-${r}` })
      }
      add('pallet', X + W - 1, Z + D - 1)
      add('pallet', X + W - 2.2, Z + D - 1)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: X + 1, z: Z + 3.3 + (i % Math.max(1, rows - 1)) * 2.6, rotation: Math.PI / 2, pose: 'stand', station: 'rack', wander: i % 2 === 0 }))
      break
    }
    case 'loading_dock': {
      const doors = Math.max(3, Math.floor((W - 2) / 3.2))
      for (let i = 0; i < doors; i += 1) {
        const x = X + 1.8 + i * 3.2
        add('dock_door', x, Z + 0.2, { color: accent })
        add('pallet', x, Z + 1.6)
        if (i % 2 === 0) add('box_stack', x + 0.8, Z + 2.6)
      }
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: X + 2.6 + i * 3.2, z: Z + 2.4, rotation: Math.PI, pose: 'stand', station: 'dock', wander: i % 2 === 1 }))
      break
    }
    case 'packing_area': {
      add('conveyor', cx, Z + 1.6, { w: W - 2 })
      const tables = Math.max(3, people.length)
      const step = (W - 2) / tables
      for (let i = 0; i < tables; i += 1) add('pack_table', X + 1 + step * (i + 0.5), Z + 3)
      add('box_stack', X + W - 1, Z + D - 1)
      add('box_stack', X + 1, Z + D - 1)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: X + 1 + step * (i + 0.5), z: Z + 3.8, rotation: Math.PI, pose: 'stand', station: 'packing' }))
      break
    }
    case 'truck_yard': {
      const trucks = Math.max(2, Math.floor((W - 2) / 4.5))
      for (let i = 0; i < trucks; i += 1) {
        const x = X + 2.4 + i * 4.5
        add('parking_line', x - 1.6, Z + D - 3.2, { d: 6 })
        if (i === trucks - 1) add('van', x, Z + D - 2.4, { rotation: Math.PI, color: '#f8fafc', assetId: `${room.id}-veh-${i}` })
        else add('truck', x, Z + D - 3.2, { rotation: Math.PI, color: accent, assetId: `${room.id}-veh-${i}` })
      }
      add('van', X + 2, Z + 1.3, { rotation: Math.PI / 2, motion: 'drive', path: { x0: X + 1.5, x1: X + W - 1.5 }, color: '#f8fafc' })
      overflow(ctx, people)
      break
    }
    case 'sales_floor': {
      for (let i = 0; i < 3; i += 1) add('retail_shelf', X + 2.4 + i * 3.4, Z + D - 3, { w: 4, rotation: Math.PI / 2 })
      add('display_table', X + W - 3.4, Z + 3, { color: accent })
      add('display_table', X + W - 3.4, Z + 6, { color: accent })
      for (let i = 0; i < 3; i += 1) add('mannequin', X + 1.4 + i * 1.3, Z + 1.3, { color: PALETTE[(seed + i) % PALETTE.length] })
      add('shopper', X + 5.8, Z + 4.2, { color: '#2563eb' })
      add('shopper', X + W - 2.2, Z + 4.6, { color: '#16a34a' })
      add('plant', X + W - 0.8, Z + 0.8)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: X + W - 4.6 + (i % 2) * 2.4, z: Z + 4.5 + Math.floor(i / 2) * 1.6, rotation: -Math.PI / 2, pose: 'stand', station: 'floor', wander: i % 2 === 1 }))
      break
    }
    case 'checkout': {
      const tills = Math.max(2, people.length)
      const step = (W - 1.6) / tills
      for (let i = 0; i < tills; i += 1) add('checkout_counter', X + 0.8 + step * (i + 0.5), cz, { color: accent })
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: X + 0.8 + step * (i + 0.5) + 0.5, z: cz + 0.9, rotation: Math.PI, pose: 'stand', station: 'till' }))
      add('shopper', X + 0.8 + step * 0.5, Z + 1, { color: '#ea580c' })
      break
    }
    case 'stockroom': {
      add('shelving', cx, Z + D - 0.8, { w: W - 1.6 })
      add('shelving', cx, cz, { w: W - 3 })
      add('box_stack', X + 1, Z + 1)
      add('box_stack', X + 1.9, Z + 1)
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: cx - 1 + i * 1.5, z: cz - 1.1, rotation: 0, pose: 'stand', station: 'stock', wander: i === 0 }))
      break
    }
    case 'fitting_rooms': {
      for (let i = 0; i < 3; i += 1) add('fitting_booth', X + 1.4 + i * 2.1, cz + 0.4, { color: accent })
      overflow(ctx, people)
      break
    }
    case 'server_room': {
      for (let r = 0; r < 2; r += 1) {
        for (let i = 0; i < Math.floor((W - 2) / 1); i += 1) {
          if (i >= 5) break
          add('server_rack', X + 1.3 + i * 1.05, Z + 2 + r * 2.2, { rotation: r ? Math.PI : 0, assetId: `${room.id}-rack-${r}-${i}` })
        }
      }
      people.forEach((agent, i) => placeAgent(ctx, agent, { x: X + W - 1, z: Z + 2 + i * 1.2, rotation: -Math.PI / 2, pose: 'stand', station: 'rack' }))
      break
    }
    case 'listing_wall': {
      const boards = Math.max(3, Math.floor((W - 2) / 2.6))
      for (let i = 0; i < boards; i += 1) add('listing_board', X + 1.4 + i * 2.6, Z + 0.5, { color: accent, assetId: `${room.id}-bien-${i}` })
      add('model_table', cx, Z + 3, { color: accent })
      people.forEach((agent, i) => {
        const x = X + 2 + i * 3.2
        add('chairs_row', x, Z + D - 3.6, { scale: 0.45 })
        seatAtDesk(ctx, agent, x, Z + D - 2.6, 'rect')
      })
      add('plant', X + W - 0.8, Z + D - 0.8)
      break
    }
    case 'production_line': {
      add('conveyor', cx, cz + 0.3, { w: W - 2 })
      const stations = Math.max(3, people.length)
      const step = (W - 2) / stations
      for (let i = 0; i < stations; i += 1) {
        const x = X + 1 + step * (i + 0.5)
        add(i % 3 === 1 ? 'robot_arm' : 'cnc_machine', x, Z + D - 1.4, { color: accent, motion: i % 3 === 1 ? 'spin' : undefined, assetId: `${room.id}-mach-${i}` })
      }
      add('bay_marking', cx, cz + 0.3, { w: W - 1, d: 2.2, color: '#facc15' })
      add('box_stack', X + 1, Z + 1)
      add('pallet', X + W - 1.2, Z + 1)
      people.forEach((agent, i) => {
        const x = X + 1 + step * (i + 0.5)
        placeAgent(ctx, agent, { x, z: Z + D - 2.7, rotation: 0, pose: 'stand', station: 'machine' })
      })
      break
    }
    default:
      overflow(ctx, people)
  }
}

function furnishStandard(ctx: ZoneCtx) {
  const { room, plan, props } = ctx
  const roomId = room.id
  const pack = { x: room.x, z: room.z, w: room.w, d: room.d }
  const cx = pack.x + pack.w / 2
  const cz = pack.z + pack.d / 2

  if (plan.agents.length > 0 && plan.cols > 0) {
    let slot = 0
    for (let row = 0; row < plan.rows; row += 1) {
      for (let col = 0; col < plan.cols; col += 1) {
        if (slot >= plan.agents.length) break
        const agent = plan.agents[slot]!
        const deskX = pack.x + 1.6 + col * 3
        const deskZ = pack.z + 1.7 + row * 3
        seatAtDesk(ctx, agent, deskX, deskZ, deskStyleFor(plan.kind, agent.role))
        if (plan.kind === 'cubicle') {
          props.push({ id: `${roomId}-desk-${slot}-part`, kind: 'partition', roomId, x: deskX, z: deskZ - 0.55, rotation: 0, scale: 1 })
        }
        slot += 1
      }
    }
  } else if (plan.agents.length > 0) {
    overflow(ctx, plan.agents)
  }

  const p = (id: string, kind: OfficePropKind, x: number, z: number, extra: Partial<OfficeProp> = {}) =>
    props.push({ id: `${roomId}-${id}`, kind, roomId, x, z, rotation: 0, ...extra })

  switch (plan.kind) {
    case 'lobby':
    case 'reception':
      p('reception', 'reception_desk', cx, cz, { color: ctx.accent })
      p('plant-a', 'plant', pack.x + 1.2, pack.z + pack.d - 1.2)
      p('plant-b', 'plant', pack.x + pack.w - 1.2, pack.z + pack.d - 1.2)
      p('sofa', 'sofa', pack.x + 2, pack.z + 1.3, { rotation: 0.2 })
      if (ctx.archetype === 'marketing_agency') p('neon', 'neon_sign', cx, pack.z + pack.d - 0.35, { color: ctx.accent })
      break
    case 'meeting_medium':
    case 'project_room':
      p('table', 'round_table', cx, cz, { scale: plan.kind === 'meeting_medium' ? 1.35 : 1.1 })
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2
        const x = cx + Math.sin(a) * 1.4
        const z = cz + Math.cos(a) * 1.1
        p(`chair-${i}`, 'chair', x, z, { rotation: facing(x, z, cx, cz) })
      }
      p('tv', 'tv', pack.x + pack.w / 2, pack.z + pack.d - 0.4)
      p('wb', 'whiteboard', pack.x + 0.4, cz, { rotation: Math.PI / 2 })
      p('plant', 'plant', pack.x + pack.w - 1.1, pack.z + 1.1)
      break
    case 'enclave':
      p('table', 'table', cx, cz, { scale: 0.75 })
      p('sofa', 'sofa', cx, pack.z + pack.d - 1.1, { rotation: Math.PI })
      break
    case 'focus_room':
      p('desk', 'table', cx, cz, { scale: 0.7 })
      p('lamp', 'lamp', cx + 0.6, cz - 0.4)
      break
    case 'phone_booth':
      p('booth', 'phone_booth', cx, cz)
      break
    case 'cafeteria':
      p('table-a', 'round_table', pack.x + 2.5, cz, { scale: 0.9 })
      p('table-b', 'round_table', pack.x + pack.w - 2.5, cz, { scale: 0.9 })
      p('coffee', 'coffee', pack.x + pack.w / 2, pack.z + pack.d - 0.8)
      p('plant', 'plant', pack.x + 1.2, pack.z + 1.2)
      break
    case 'lounge':
      p('rug', 'rug', cx, cz, { scale: 1.4 })
      p('sofa-a', 'sofa', pack.x + 1.6, cz, { rotation: Math.PI / 2 })
      p('sofa-b', 'sofa', pack.x + pack.w - 1.6, cz, { rotation: -Math.PI / 2 })
      p('table', 'table', cx, cz, { scale: 0.55 })
      p('tv', 'tv', cx, pack.z + pack.d - 0.4)
      if (ctx.archetype === 'marketing_agency' || ctx.archetype === 'tech') {
        p('bean', 'bean_bag', cx - 0.9, pack.z + 1.1, { color: ctx.accent })
        p('pong', 'ping_pong', cx + 0.6, pack.z + 1.4, { scale: 0.7 })
      }
      break
    case 'kitchen':
      p('fridge', 'fridge', pack.x + 1, pack.z + pack.d - 0.8)
      p('micro', 'microwave', pack.x + 2.1, pack.z + pack.d - 0.8)
      p('coffee', 'coffee', pack.x + pack.w - 1, pack.z + pack.d - 0.8)
      p('table', 'round_table', cx, cz - 0.3, { scale: 0.6 })
      break
    case 'archive':
    case 'storage':
      p('cab-a', 'cabinet', pack.x + 1.1, pack.z + pack.d - 1)
      p('cab-b', 'cabinet', pack.x + 2.2, pack.z + pack.d - 1)
      p('cab-c', 'bookshelf', pack.x + pack.w - 0.8, cz)
      p('locker', 'locker', pack.x + 1.1, pack.z + 1.3)
      break
    case 'private_office':
    case 'cubicle':
    case 'open_space':
    case 'team_zone':
      p('cabinet', 'cabinet', pack.x + pack.w - 1, pack.z + pack.d - 0.9)
      p('plant', 'plant', pack.x + 0.9, pack.z + pack.d - 0.9)
      p('shelf', 'bookshelf', pack.x + pack.w - 0.8, pack.z + 1.4)
      if (plan.kind === 'open_space' || plan.kind === 'team_zone') {
        p('printer', 'printer', pack.x + 1, pack.z + pack.d - 2)
        p('wb', 'whiteboard', pack.x + 0.4, cz, { rotation: Math.PI / 2 })
      }
      break
    default:
      break
  }
}

/** Construit l’entrée générateur depuis le chart Studio. */
export function officeOrgFromChart(input: {
  organization: { id: Id; name: string; intention?: string; objective?: string | null }
  departments: Array<{ id: Id; name: string; color?: string; type?: string }>
  agents: Array<{
    id: Id
    departmentId: Id
    firstName: string
    lastName: string
    role: string
    presence?: Presence
    avatar?: { face?: string; style?: string; appearance?: string }
  }>
  tools?: OfficeOrgTool[]
  swarms?: OfficeOrgSwarm[]
  sector?: string
  businessModel?: string
  archetype?: OfficeArchetype
}): OfficeOrgInput {
  return {
    id: input.organization.id,
    name: input.organization.name,
    tools: input.tools,
    swarms: input.swarms,
    sector: input.sector,
    businessModel: input.businessModel,
    intention: [input.organization.intention, input.organization.objective].filter(Boolean).join(' · ') || undefined,
    archetype: input.archetype,
    departments: input.departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      color: dept.color,
      type: dept.type || departmentType(dept.name),
      agents: input.agents
        .filter((agent) => agent.departmentId === dept.id)
        .map((agent) => ({
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          role: agent.role,
          face: agent.avatar?.face ?? null,
          status: agent.presence ?? 'online',
          avatarStyle: agent.avatar?.style || agent.avatar?.appearance || 'portrait',
          currentTaskId: null,
        })),
    })),
  }
}
