import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AtlasAction, StudioView } from '@/lib/atlas-voice'
import { viewLabel } from '@/lib/atlas-voice'

export type StudioUiOp = 'fullscreen' | 'exitFullscreen' | 'overview' | 'top'

export type StudioRemoteAction =
  | AtlasAction
  | { kind: 'ui'; op: StudioUiOp }

export type StudioRemoteCommand = {
  id: string
  userId: string
  organizationId?: string | null
  at: number
  action: StudioRemoteAction
  source: string
}

/** Chemin stable sous apps/web/data (cwd Next = apps/web). */
function storePath() {
  return join(process.cwd(), 'data', 'studio-remote-queue.json')
}

const MAX = 100
const TTL_MS = 10 * 60_000

type Bag = { items: StudioRemoteCommand[] }

declare global {
  // eslint-disable-next-line no-var
  var __atlasStudioQueue: Bag | undefined
}

function bag(): Bag {
  if (!globalThis.__atlasStudioQueue) globalThis.__atlasStudioQueue = { items: [] }
  return globalThis.__atlasStudioQueue
}

function readDisk(): StudioRemoteCommand[] {
  try {
    const raw = readFileSync(storePath(), 'utf8')
    const parsed = JSON.parse(raw) as Bag
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

function writeDisk(items: StudioRemoteCommand[]) {
  try {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true })
    writeFileSync(storePath(), JSON.stringify({ items: items.slice(-MAX) }, null, 2))
  } catch { /* ignore */ }
}

function mergeLive(): StudioRemoteCommand[] {
  const cut = Date.now() - TTL_MS
  const live = bag()
  const disk = readDisk()
  const byId = new Map<string, StudioRemoteCommand>()
  for (const item of [...disk, ...live.items]) {
    if (item.at >= cut) byId.set(item.id, item)
  }
  const items = [...byId.values()].sort((a, b) => a.at - b.at).slice(-MAX)
  live.items = items
  return items
}

export function enqueueStudioCommand(input: {
  userId: string
  organizationId?: string | null
  action: StudioRemoteAction
  source?: string
}): StudioRemoteCommand {
  const items = mergeLive()
  const command: StudioRemoteCommand = {
    id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId || 'harold',
    organizationId: input.organizationId || null,
    at: Date.now(),
    action: input.action,
    source: input.source || 'mobile',
  }
  items.push(command)
  bag().items = items.slice(-MAX)
  writeDisk(bag().items)
  return command
}

function matchesUser(item: StudioRemoteCommand, userId: string, organizationId?: string | null) {
  const uid = userId || 'harold'
  if (item.userId === uid) return true
  if (uid === 'harold' || item.userId === 'harold') return true
  if (organizationId && item.organizationId && item.organizationId === organizationId) return true
  // Compte mobile phone:… ↔ Studio local
  if (/^phone:/i.test(item.userId) || /^phone:/i.test(uid)) return true
  return false
}

export function takeStudioCommands(userId: string, since = 0, organizationId?: string | null): StudioRemoteCommand[] {
  const items = mergeLive()
  const pending = items.filter((item) => item.at > since && matchesUser(item, userId, organizationId))
  if (pending.length) {
    const taken = new Set(pending.map((item) => item.id))
    bag().items = items.filter((item) => !taken.has(item.id))
    writeDisk(bag().items)
  }
  return pending
}

export function peekStudioCommands(userId: string, since = 0, organizationId?: string | null): StudioRemoteCommand[] {
  return mergeLive().filter((item) => item.at > since && matchesUser(item, userId, organizationId))
}

const VIEWS: Array<{ re: RegExp; view: StudioView }> = [
  { re: /bureau|jumeau|vue\s*3d|\b3d\b|office/, view: 'bureau' },
  { re: /factur|devis|encaiss/, view: 'factures' },
  { re: /organigramme|org\s*chart/, view: 'organigramme' },
  { re: /employ/, view: 'employes' },
  { re: /mission/, view: 'missions' },
  { re: /workflow|procedure/, view: 'workflows' },
  { re: /reunion/, view: 'reunions' },
  { re: /approbation|decision/, view: 'approbations' },
  { re: /connaissance|knowledge/, view: 'connaissances' },
  { re: /integration|connecteur|plugin/, view: 'integrations' },
  { re: /observ/, view: 'observabilite' },
  { re: /template|modele/, view: 'templates' },
  { re: /tutoriel/, view: 'tutoriels' },
  { re: /\bcompte\b|securit/, view: 'compte' },
]

/** Intentions UI Studio depuis le mobile (avant Jarvis). */
export function interpretStudioRemote(raw: string): StudioRemoteAction | null {
  const heard = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

  // Plein écran en priorité
  if (/(quitte|sors|ferme|exit).{0,20}(plein|ecran|fullscreen)|(plein|ecran|fullscreen).{0,20}(quitte|sors|ferme|exit)/.test(heard)) {
    return { kind: 'ui', op: 'exitFullscreen' }
  }
  if (/plein\s*ecran|fullscreen|maximize|agrandi/.test(heard)) {
    return { kind: 'ui', op: 'fullscreen' }
  }
  if (/vue (?:du )?dessus|camera (?:du )?dessus|top ?view|vue aerienne/.test(heard)) {
    return { kind: 'ui', op: 'top' }
  }
  if (/vue d'?ensemble|overview|recul|zoom out/.test(heard)) {
    return { kind: 'ui', op: 'overview' }
  }

  // Conversation (« présente mon organisation ») ≠ pilotage UI
  if (/presente|presenter|parle[- ]moi|explique|decrit|resume|c'?est quoi/.test(heard)
    && /organisation|equipe|ztc|ztchosting|agents?/.test(heard)
    && !/(ouvre|bascule|plein|bureau\s*3d|studio)/.test(heard)) {
    return null
  }

  const steering = /(ouvre|ouvrir|affiche|montre|va |aller |passe |bascule|active|lance|met |mets )/.test(heard)
  if (!steering && !/bureau\s*3d|organigramme|factur|plein|studio/.test(heard)) return null

  if (/accueil|home|tableau de bord|dashboard/.test(heard) && steering) return { kind: 'home' }
  if (/mode avance/.test(heard)) return { kind: 'mode', advanced: true }
  if (/mode (?:simple|normal|basique)/.test(heard)) return { kind: 'mode', advanced: false }
  if (/brief/.test(heard) && /ouvre|affiche|montre|lance/.test(heard)) return { kind: 'brief' }
  if (/\bequipe\b|team/.test(heard) && /ouvre|affiche|montre|lance/.test(heard) && !/presente|explique/.test(heard)) {
    return { kind: 'team' }
  }
  if (/\btaches?\b|tasks?/.test(heard) && /ouvre|affiche|montre/.test(heard)) return { kind: 'tasks' }
  if (/integrations?|outils|tools|plugins?/.test(heard) && /ouvre|affiche|montre/.test(heard)) {
    return { kind: 'tools' }
  }
  if (/recharge|rafraichis|reload/.test(heard)) return { kind: 'load' }

  for (const item of VIEWS) {
    if (!item.re.test(heard)) continue
    if (steering || item.view === 'bureau' || item.view === 'organigramme' || item.view === 'factures') {
      // « montre mon organisation » ne doit pas ouvrir une vue au hasard
      if (item.view === 'employes' && /organisation/.test(heard) && /presente|explique|parle/.test(heard)) continue
      return { kind: 'navigate', view: item.view }
    }
  }

  if (/salle|piece|room/.test(heard)) {
    const room = heard.match(/(?:salle|piece|room)\s+([a-z0-9\- ]{2,40})/i)?.[1]?.trim()
    if (room) return { kind: 'room', target: room }
  }

  return null
}

export function isStudioUiAction(action: StudioRemoteAction | null | undefined): boolean {
  if (!action) return false
  return action.kind === 'navigate'
    || action.kind === 'ui'
    || action.kind === 'home'
    || action.kind === 'mode'
    || action.kind === 'room'
    || action.kind === 'brief'
    || action.kind === 'team'
    || action.kind === 'tasks'
    || action.kind === 'tools'
    || action.kind === 'load'
    || action.kind === 'orchestrate'
    || action.kind === 'compose'
}

export function speakStudioRemote(action: StudioRemoteAction): string {
  if (action.kind === 'navigate') return `C’est fait. J’ouvre ${viewLabel(action.view)}.`
  if (action.kind === 'ui') {
    if (action.op === 'fullscreen') return 'C’est fait. Bureau 3D en plein écran.'
    if (action.op === 'exitFullscreen') return 'C’est fait. Plein écran quitté.'
    if (action.op === 'top') return 'C’est fait. Vue du dessus.'
    return 'C’est fait. Vue d’ensemble.'
  }
  if (action.kind === 'home') return 'C’est fait. Retour à l’organigramme.'
  if (action.kind === 'mode') return action.advanced ? 'Mode avancé activé.' : 'Mode simple activé.'
  if (action.kind === 'room') return `C’est fait. Je cadre la salle ${action.target}.`
  if (action.kind === 'brief') return 'C’est fait. Briefing ouvert.'
  if (action.kind === 'team') return 'C’est fait. Équipe affichée.'
  if (action.kind === 'tasks') return 'C’est fait. Missions ouvertes.'
  if (action.kind === 'tools') return 'C’est fait. Intégrations ouvertes.'
  if (action.kind === 'load') return 'C’est fait. Observabilité ouverte.'
  if (action.kind === 'compose') return 'C’est fait. Composition lancée sur le Studio.'
  if (action.kind === 'orchestrate') return 'C’est fait. Orchestration ouverte.'
  return 'C’est fait sur ton Studio.'
}
