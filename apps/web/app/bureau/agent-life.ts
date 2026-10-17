import type { OfficeAgentPlacement, OfficeLayout, OfficeProp, OfficeRoom } from '@atlas/domain'

/**
 * Vie des agents dans le Bureau 3D : déplacements et tâches sur place.
 * Ne touche pas au plan : les trajets suivent les portes et les allées existantes.
 */

export type Point = { x: number; z: number }

export type ErrandKind = 'colleague' | 'meeting' | 'asset' | 'break' | 'handover'

export interface Errand {
  kind: ErrandKind
  to: Point
  face: Point
  roomId: string
  withId?: string
  going: string
  there: string
  stay: number
  carry: boolean
}

const MEETING = /meeting|project_room|enclave|focus|conference|board/
const BREAK = /cafeteria|kitchen|lounge/
const WORK_PROPS = new Set(['printer', 'whiteboard', 'cabinet', 'bookshelf', 'server', 'mailbox', 'tv', 'reception_desk', 'locker'])

const PLAYBOOK: Array<{ test: RegExp; colleague: string; asset: string; meeting: string }> = [
  { test: /vente|commercial|sales|business|account|offre/i, colleague: 'point sur les prospects', asset: 'prépare une offre client', meeting: 'rendez-vous client' },
  { test: /market|acquisition|growth|communication|contenu|social|marque|brand/i, colleague: 'brief de campagne', asset: 'imprime les visuels', meeting: 'revue des campagnes' },
  { test: /financ|compta|factur|tréso|cfo|budget/i, colleague: 'valide un budget', asset: 'classe les factures', meeting: 'revue de trésorerie' },
  { test: /opéra|operation|logist|stock|supply|achat|production|réserve/i, colleague: 'coordonne une livraison', asset: 'contrôle le stock', meeting: 'point opérations' },
  { test: /support|service client|relation client|success|satisfaction/i, colleague: 'remonte un retour client', asset: 'traite un dossier client', meeting: 'point satisfaction' },
  { test: /\brh\b|recrut|people|talent|ressources humaines/i, colleague: 'prépare un recrutement', asset: 'met à jour les dossiers', meeting: 'entretien candidat' },
  { test: /produit|design|dév|tech|ingénieur|data|it\b/i, colleague: 'revue produit', asset: 'teste une nouveauté', meeting: 'atelier produit' },
  { test: /direct|ceo|manager|chef|head|lead|associ/i, colleague: 'point d’équipe', asset: 'revoit les objectifs', meeting: 'comité de direction' },
  { test: /support|nova|succ[eè]s client/i, colleague: 'escalade un ticket', asset: 'relit le statut d’une commande', meeting: 'point satisfaction' },
  { test: /sre|orion|noc|infra/i, colleague: 'corrèle un incident', asset: 'lit les métriques de latence', meeting: 'revue de capacité' },
  { test: /whm|vega|h[eé]berg/i, colleague: 'vérifie un provisionnement', asset: 'contrôle un quota cPanel', meeting: 'revue hébergement' },
  { test: /domaine|lyra|dns/i, colleague: 'valide une zone DNS', asset: 'vérifie un certificat', meeting: 'point domaines' },
  { test: /ledger|factur|billing/i, colleague: 'rapproche une facture', asset: 'relance un renouvellement', meeting: 'revue finance' },
]
const DEFAULT_PLAY = { colleague: 'partage un dossier', asset: 'récupère des documents', meeting: 'réunion d’équipe' }

const first = (name: string) => name.split(' ')[0] ?? name

export function playbookOf(agent: OfficeAgentPlacement, room?: OfficeRoom) {
  const text = `${agent.role} ${room?.name ?? ''}`
  return PLAYBOOK.find((item) => item.test.test(text)) ?? DEFAULT_PLAY
}

/** Une tâche réelle de l’agent (données ops) devient le sujet de son déplacement. */
function topicOf(task: string | undefined, fallback: string) {
  const clean = task?.trim()
  if (!clean || /attend|prêt|^✋|^en pause$|^hors ligne$|^mission en cours$|^j[e’']/i.test(clean) || clean.length > 60) return fallback
  return clean.charAt(0).toLowerCase() + clean.slice(1)
}

function inside(room: OfficeRoom, p: Point, margin = 0.6): Point {
  return {
    x: Math.min(room.x + room.w - margin, Math.max(room.x + margin, p.x)),
    z: Math.min(room.z + room.d - margin, Math.max(room.z + margin, p.z)),
  }
}

/** Place debout à côté d’un collègue, du côté libre de son poste. */
export function besideOf(agent: OfficeAgentPlacement, room: OfficeRoom | undefined, side: 1 | -1): Point {
  const r = agent.rotation
  const p = { x: agent.x + Math.cos(r) * 0.85 * side - Math.sin(r) * 0.15, z: agent.z - Math.sin(r) * 0.85 * side - Math.cos(r) * 0.15 }
  return room ? inside(room, p, 0.45) : p
}

function frontOf(prop: OfficeProp, room: OfficeRoom | undefined): Point {
  const p = { x: prop.x + Math.sin(prop.rotation) * 0.95, z: prop.z + Math.cos(prop.rotation) * 0.95 }
  return room ? inside(room, p, 0.5) : p
}

export function pickErrand(
  layout: OfficeLayout,
  agent: OfficeAgentPlacement,
  options: { busy: Set<string>; task?: string; random?: () => number },
): Errand | null {
  const random = options.random ?? Math.random
  const rooms = new Map(layout.rooms.map((room) => [room.id, room]))
  const home = rooms.get(agent.roomId)
  const play = playbookOf(agent, home)
  const colleagues = layout.agents.filter((other) => other.id !== agent.id && other.status !== 'offline' && !options.busy.has(other.id))
  const meetings = layout.rooms.filter((room) => !room.outdoor && MEETING.test(room.kind))
  const breaks = layout.rooms.filter((room) => BREAK.test(room.kind))
  const tools = layout.props.filter((prop) => (prop.assetId || WORK_PROPS.has(prop.kind)) && rooms.has(prop.roomId))
  const nearTools = tools.filter((prop) => prop.roomId === agent.roomId)

  const options_: Array<{ weight: number; make: () => Errand | null }> = [
    {
      weight: colleagues.length ? 0.42 : 0,
      make: () => {
        const other = colleagues[Math.floor(random() * colleagues.length)]
        if (!other) return null
        const room = rooms.get(other.roomId)
        const topic = topicOf(options.task, play.colleague)
        return {
          kind: 'colleague', roomId: other.roomId, withId: other.id,
          to: besideOf(other, room, random() < 0.5 ? 1 : -1), face: { x: other.x, z: other.z },
          going: `Va voir ${first(other.name)}`, there: `Avec ${first(other.name)} : ${topic}`,
          stay: 6 + random() * 6, carry: random() < 0.5,
        }
      },
    },
    {
      weight: tools.length ? 0.3 : 0,
      make: () => {
        const pool = nearTools.length && random() < 0.6 ? nearTools : tools
        const prop = pool[Math.floor(random() * pool.length)]
        if (!prop) return null
        const room = rooms.get(prop.roomId)
        const label = topicOf(options.task, play.asset)
        return {
          kind: 'asset', roomId: prop.roomId,
          to: frontOf(prop, room), face: { x: prop.x, z: prop.z },
          going: `Va ${room ? `en ${room.name.toLowerCase()}` : 'chercher le matériel'}`, there: label.charAt(0).toUpperCase() + label.slice(1),
          stay: 4 + random() * 5, carry: true,
        }
      },
    },
    {
      weight: meetings.length ? 0.2 : 0,
      make: () => {
        const room = meetings[Math.floor(random() * meetings.length)]
        if (!room) return null
        const angle = random() * Math.PI * 2
        const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 }
        return {
          kind: 'meeting', roomId: room.id,
          to: inside(room, { x: center.x + Math.cos(angle) * 1.2, z: center.z + Math.sin(angle) * 1.2 }), face: center,
          going: `En route : ${room.name}`, there: `${room.name} : ${play.meeting}`,
          stay: 8 + random() * 8, carry: false,
        }
      },
    },
    {
      weight: breaks.length ? 0.08 : 0,
      make: () => {
        const room = breaks[Math.floor(random() * breaks.length)]
        if (!room) return null
        const center = { x: room.x + room.w / 2 + (random() - 0.5) * 1.5, z: room.z + room.d / 2 + (random() - 0.5) * 1.5 }
        return { kind: 'break', roomId: room.id, to: inside(room, center), face: { x: room.x + room.w / 2, z: room.z + room.d / 2 }, going: `Va en ${room.name.toLowerCase()}`, there: 'Pause café', stay: 5 + random() * 4, carry: false }
      },
    },
  ]
  const total = options_.reduce((sum, item) => sum + item.weight, 0)
  if (!total) return null
  let roll = random() * total
  for (const item of options_) {
    roll -= item.weight
    if (roll <= 0 && item.weight) return item.make()
  }
  return null
}

/** Livraison d’un vrai livrable de mission : l’agent l’apporte au collègue qui en a besoin. */
export function handoverErrand(layout: OfficeLayout, to: OfficeAgentPlacement, what: string): Errand {
  const room = layout.rooms.find((item) => item.id === to.roomId)
  return {
    kind: 'handover', roomId: to.roomId, withId: to.id,
    to: besideOf(to, room, 1), face: { x: to.x, z: to.z },
    going: `Apporte ${what} à ${first(to.name)}`, there: `Remet ${what} à ${first(to.name)}`,
    stay: 4, carry: true,
  }
}

function walkwayOf(layout: OfficeLayout, room: OfficeRoom) {
  if (room.outdoor) return 0
  let best = -1
  layout.walkways.forEach((walk, index) => {
    if (walk.z < room.z && (best < 0 || walk.z > layout.walkways[best]!.z)) best = index
  })
  return Math.max(0, best)
}

/** Du poste à l’allée : on sort par la porte, côté allée. */
function exitOf(layout: OfficeLayout, room: OfficeRoom, from: Point): { path: Point[]; walk: number; x: number } {
  const walk = walkwayOf(layout, room)
  const lane = layout.walkways[walk]!
  if (room.outdoor) {
    const gate = { x: room.x + room.w / 2, z: room.z + room.d + 0.4 }
    const door = layout.building.entranceX
    return { path: [gate, { x: door, z: layout.building.z - 0.4 }, { x: door, z: lane.z }], walk, x: door }
  }
  const door = room.x + room.w / 2
  const inner = room.z + 0.9
  return { path: [{ x: from.x, z: inner }, { x: door, z: inner }, { x: door, z: lane.z }], walk, x: door }
}

export function route(layout: OfficeLayout, from: Point, fromRoom: string, to: Point, toRoom: string): Point[] {
  const a = layout.rooms.find((room) => room.id === fromRoom)
  const b = layout.rooms.find((room) => room.id === toRoom)
  if (!a || !b || !layout.walkways.length) return [from, to]
  if (a.id === b.id) {
    const far = Math.hypot(to.x - from.x, to.z - from.z) > 2.5
    return clean(far && !a.outdoor ? [from, { x: from.x, z: a.z + 0.9 }, { x: to.x, z: a.z + 0.9 }, to] : [from, to])
  }
  const out = exitOf(layout, a, from)
  const into = exitOf(layout, b, to)
  const middle: Point[] = []
  let x = out.x
  let walk = out.walk
  while (walk !== into.walk) {
    const step = into.walk > walk ? 1 : -1
    const gap = crossingsOf(layout, step > 0 ? walk : walk - 1)
      .reduce((best, g) => (Math.abs(x - g) + Math.abs(g - into.x) < Math.abs(x - best) + Math.abs(best - into.x) ? g : best))
    middle.push({ x: gap, z: layout.walkways[walk]!.z }, { x: gap, z: layout.walkways[walk + step]!.z })
    x = gap
    walk += step
  }
  return clean([from, ...out.path, ...middle, ...[...into.path].reverse(), to])
}

/** Passages entre deux allées : les bords du bâtiment et les espaces entre les pièces d’une rangée. */
function crossingsOf(layout: OfficeLayout, row: number): number[] {
  const lane = layout.walkways[row]!
  const rooms = layout.rooms.filter((room) => !room.outdoor && walkwayOf(layout, room) === row).sort((p, q) => p.x - q.x)
  const xs = [lane.x0, lane.x1]
  rooms.forEach((room, index) => {
    const end = rooms[index + 1]?.x ?? lane.x1 + 0.6
    if (end - (room.x + room.w) >= 0.8) xs.push((room.x + room.w + end) / 2)
  })
  return xs
}

function clean(points: Point[]) {
  return points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1]!.x, p.z - points[i - 1]!.z) > 0.05)
}
