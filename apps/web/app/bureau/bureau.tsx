'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import Link from 'next/link'
import { Mark } from '@/components/auth-screen'
import {
  CONNECTOR_CATALOG,
  agentFace,
  agentVoice,
  businessModelLabel,
  kitFor,
  lockToZtc,
  officeOrgFromChart,
  ZTC_MARK,
  ZTC_NAME,
  ZTC_DESKS,
  missingZtcDesks,
  researchModeOf,
  resolveAgentFace,
  spaceFromText,
  type CrewMember,
  type OfficeOrgInput,
  type OfficeSpaceKind,
  type OpsAction,
  type OrganizationDraft,
} from '@atlas/domain'
import { gatewayUrl } from '@/lib/atlas'
import { absorbAnswer, composeIntention, intakeQuestion, isIntakeCancel, nextIntakeSlot, type Intake } from '@/lib/atlas-intake'
import { atlasGreeting, interpretAtlas, localVoiceReply, speechLang, viewLabel, wantsAdoption, webQuery, webSearchUrl, youtubeSearchUrl } from '@/lib/atlas-voice'
import { extractInlineSource, transformFileExt } from '@/lib/atlas-docwork'
import { resolveAtlasAction, shouldConsultLlm } from '@/lib/atlas-execute'
import {
  createSessionContext,
  expandWithSession,
  pushSessionTurn,
  rememberSessionAction,
  sessionBrief,
  type SessionContext,
} from '@/lib/atlas-session'
import {
  correctFact,
  forgetFact,
  memoryBrief,
  memorySpokenSummary,
  rememberFact,
} from '@/lib/partner-memory'
import {
  createLipSyncClock,
  resetLipSyncClock,
  setLipSyncAudioLevel,
  setLipSyncProgress,
  stopLipSyncClock,
  wordEndIndex,
  type LipSyncClock,
} from '@/lib/lip-sync-clock'
import {
  agentsInRoom,
  buildOrgStudioContext,
  buildOrgSupervisorBrief,
  matchOfficeRoom,
  pickAgentForMission,
  teamRosterLine,
} from '@/lib/atlas-org-context'
import { ensureZtcRoster, needsZtcRoster, ztcAgentCount, ztcOfficeOrg } from '@/lib/ztc-roster-sync'
import { ConnectPanel, type PublicLink, type ToolAccess } from './connect-panel'
import { CreationTheater, ATLAS_INTEL, type CreationShow } from './creation-theater'
import { AceFace } from './ace-face'
import { BureauLive, type OfficeFocus } from './bureau-live'
import { FacturesSection, type InvoiceScope } from './factures-section'
import { useOfficeTwin } from './use-office-twin'
import { freshName, WORK_LABEL, type ControlResult, type OfficeControl, type WorkItem } from './office-control'
import { useCrew } from './use-crew'
import { CrewBoard } from './crew-board'
import styles from './bureau.module.css'

const TEMPLATES = [
  {
    title: 'ZTC Hosting',
    icon: 'layers',
    tone: 'saas',
    text: 'ATLAS orchestre ZTC Hosting : support, WHM, domaines, facturation, SKU IA, scan, perf, pub.',
    detail: 'Nova · Devoid · Orion · Swift · Vega · Lyra · Echo · Helix · Cipher · Radar · Aegis · Ledger · Forge · Pulse · Flare · Clip · Boost · Muse · Sage',
  },
]

const PERMISSIONS = [
  { action: 'read_analytics', label: 'Lire les analytics' },
  { action: 'read_crm', label: 'Lire le CRM' },
  { action: 'send_email', label: 'Envoyer des e-mails' },
  { action: 'create_campaign', label: 'Créer une campagne' },
  { action: 'spend', label: 'Dépenser' },
  { action: 'edit_billing', label: 'Modifier la facturation' },
  { action: 'edit_code', label: 'Modifier le code' },
  { action: 'finance', label: 'Finance' },
  { action: 'manage_budget', label: 'Gérer le budget' },
  { action: 'review_contract', label: 'Relire un contrat' },
]

const LESSONS = [
  'Décrivez l’organisation en une phrase, ou partez d’un modèle.',
  'Ouvrez un employé pour ajuster sa mission et son autonomie.',
  'Donnez une mission, puis validez ce qui demande votre accord.',
  'Importez un document et choisissez qui peut le lire.',
]

type View =
  | 'organigramme'
  | 'bureau'
  | 'factures'
  | 'employes'
  | 'missions'
  | 'workflows'
  | 'reunions'
  | 'approbations'
  | 'connaissances'
  | 'integrations'
  | 'observabilite'
  | 'templates'
  | 'tutoriels'
  | 'compte'

interface Permission {
  action: string
  allowed: boolean
  requiresApproval: boolean
  spendLimit: number | null
}

interface Agent {
  id: string
  organizationId: string
  departmentId: string
  reportsToId: string | null
  firstName: string
  lastName: string
  role: string
  mission: string
  presence?: string
  personality?: { traits: string[]; tone?: string; hours?: string }
  skills?: string[]
  objectives?: Array<{ id: string; label: string; metric: string | null; target: string | null; dueAt: string | null }>
  toolIds?: string[]
  permissions: Permission[]
  delegation: 'autonomous' | 'approval' | 'restricted'
  avatar?: { appearance: string; age: number | null; style: string; voiceId: string; face?: string }
}

interface Department { id: string; name: string }
interface Relation { id: string; fromAgentId: string; toAgentId: string }
interface Chart {
  organization: { id: string; name: string; intention?: string; objective?: string | null }
  departments: Department[]
  agents: Agent[]
  relations: Relation[]
}
interface Decision { id: string; title: string; summary: string; status: string; risk: string; amount: number | null; requestedByAgentId: string }
interface Doc { id: string; name: string; accessibleTo: string[] }
interface OrgMeta { sector?: string; businessModel?: string }
type Fiche = {
  firstName: string
  lastName: string
  role: string
  mission: string
  department: string
  reportsTo: string
  skills: string
  traits: string
  tone: string
  hours: string
  voice: string
  tools: string[]
  knowledge: string[]
  delegation: Agent['delegation']
  ceiling: string
}
interface Meeting { id: string; title: string; startsAt: string; agenda: string[] }
interface Audit { id: string; action: string; reason: string; at: string; actorId: string }
interface LiveTask { id: string; agentId: string; title: string; status: 'todo' | 'doing' | 'done' }
const AUDIT_LABEL: Record<string, string> = {
  command: 'Mission',
  task: 'Tâche',
  decision: 'Décision',
  agent: 'Équipe',
  department: 'Département',
  relation: 'Collaboration',
  knowledge: 'Connaissance',
  meeting: 'Réunion',
  organization: 'Organisation',
}
interface Connector { provider: string; label: string; category: string; capabilities?: string[]; writes?: boolean; mcp?: string }
interface Notice { id: string; kind: string; title: string; detail: string; at: string }
interface ToolAsk { id: string; provider: string; tool: string; input: string; preview: string }
interface ChatMessage { id: string; authorId: string; body: string }
interface SpeechEngine {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function userId() {
  return window.localStorage.getItem('atlas-user') || 'harold'
}

function profileName() {
  if (typeof window === 'undefined') return 'Vous'
  return window.localStorage.getItem('atlas-name')?.trim() || 'Vous'
}

function companyLabel() {
  if (typeof window === 'undefined') return 'Votre entreprise'
  return window.localStorage.getItem('atlas-company')?.trim() || 'Votre entreprise'
}

function rememberedMemory(id: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const map = JSON.parse(window.localStorage.getItem('atlas-agent-memory') || '{}') as Record<string, string>
    return map[id] || ''
  } catch {
    return ''
  }
}

function rememberMemory(id: string, text: string) {
  const map = JSON.parse(window.localStorage.getItem('atlas-agent-memory') || '{}') as Record<string, string>
  map[id] = text
  window.localStorage.setItem('atlas-agent-memory', JSON.stringify(map))
}

function uniqueNames(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}

function permissionLabel(action: string) {
  return PERMISSIONS.find((item) => item.action === action)?.label ?? action
}

function connectorLabel(provider: string) {
  return CONNECTOR_CATALOG.find((item) => item.provider === provider)?.label ?? provider
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${gatewayUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-atlas-user': userId(),
      ...init?.headers,
    },
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    const error = payload.error ?? 'Action impossible.'
    throw new Error(error === 'Route inconnue.' ? 'Cette action n’est pas encore sur le gateway en ligne.' : error)
  }
  return payload as T
}

function normalize(body: Partial<Chart> | null): Chart | null {
  if (!body?.organization) return null
  return {
    organization: body.organization,
    departments: body.departments ?? [],
    agents: body.agents ?? [],
    relations: body.relations ?? [],
  }
}

function tone(name: string) {
  const value = name.toLowerCase()
  if (value.includes('market')) return styles.marketing
  if (value.includes('sale') || value.includes('commerc')) return styles.sales
  if (value.includes('fin')) return styles.finance
  if (value.includes('legal') || value.includes('jurid') || value.includes('ops') || value.includes('oper')) return styles.ops
  return styles.product
}

function initials(agent: Agent) {
  return `${agent.firstName.charAt(0)}${agent.lastName.charAt(0)}`.toUpperCase()
}

function delegationLabel(value: Agent['delegation']) {
  if (value === 'autonomous') return 'Autonome'
  if (value === 'restricted') return 'Limité'
  return 'Me demander'
}

function encodeWav(chunks: Float32Array[], sampleRate: number): string {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const buffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, length * 2, true)
  let offset = 44
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const step = 0x8000
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step))
  }
  return btoa(binary)
}

const ANALYSIS_ACTIONS = ['read_analytics', 'read_crm', 'review_contract', 'finance', 'manage_budget']

function missionAction(agent: Agent): string {
  const allowed = agent.permissions.filter((permission) => permission.allowed)
  return (allowed.find((permission) => ANALYSIS_ACTIONS.includes(permission.action))
    ?? allowed.find((permission) => permission.action !== 'spend' && permission.action !== 'edit_billing')
    ?? allowed[0])?.action ?? 'read_analytics'
}

function profileOf(agent: Agent, knowledge: string[] = []) {
  return {
    firstName: agent.firstName,
    lastName: agent.lastName,
    role: agent.role,
    mission: agent.mission,
    skills: agent.skills ?? [],
    traits: agent.personality?.traits ?? [],
    tone: agent.personality?.tone,
    hours: agent.personality?.hours,
    delegation: agent.delegation,
    objectives: agent.objectives ?? [],
    tools: agent.toolIds ?? [],
    voice: agent.avatar?.voiceId,
    knowledge,
    memory: rememberedMemory(agent.id),
  }
}

function completeAgent(agent: Agent, department: string): Agent {
  const kit = kitFor(agent.firstName, agent.lastName, agent.role, department, agent.personality?.traits ?? [])
  const traits = agent.personality?.traits?.length ? agent.personality.traits : kit.traits
  return {
    ...agent,
    skills: agent.skills?.length ? agent.skills : kit.skills,
    toolIds: agent.toolIds?.length ? agent.toolIds : kit.toolIds,
    objectives: agent.objectives?.length ? agent.objectives : kit.objectives,
    personality: {
      traits,
      tone: agent.personality?.tone || kit.tone,
      hours: agent.personality?.hours || kit.hours,
    },
    avatar: {
      appearance: agent.avatar?.appearance ?? 'portrait',
      age: agent.avatar?.age ?? null,
      style: agent.avatar?.style || department.toLowerCase(),
      voiceId: agent.avatar?.voiceId && agent.avatar.voiceId !== 'Ava' ? agent.avatar.voiceId : kit.voiceId,
      face: resolveAgentFace(agent.firstName, agent.lastName, agent.avatar?.face || kit.face),
    },
  }
}

function staffingPayload(organizationId: string, firstName: string, lastName: string, role: string, department: string, reportsToId: string | null = null) {
  const kit = kitFor(firstName, lastName, role, department)
  return {
    organizationId,
    departmentName: department,
    firstName,
    lastName,
    role,
    mission: role,
    skills: kit.skills,
    traits: kit.traits,
    tone: kit.tone,
    hours: kit.hours,
    objectives: kit.objectives,
    toolIds: kit.toolIds,
    voiceId: kit.voiceId,
    face: kit.face,
    delegation: 'approval' as const,
    permissions: [] as Permission[],
    reportsToId,
  }
}

function rememberedName(id: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const map = JSON.parse(window.localStorage.getItem('atlas-org-names') || '{}') as Record<string, string>
    return map[id] || null
  } catch {
    return null
  }
}

function rememberName(id: string, name: string) {
  const map = JSON.parse(window.localStorage.getItem('atlas-org-names') || '{}') as Record<string, string>
  map[id] = name
  window.localStorage.setItem('atlas-org-names', JSON.stringify(map))
}

/** Espace perso pour outils — indépendant de l’organigramme. */
function personalWorkspaceId(): string {
  if (typeof window === 'undefined') return 'personal'
  try {
    const existing = window.localStorage.getItem('atlas-workspace')
    if (existing) return existing
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `personal-${Date.now()}`
    window.localStorage.setItem('atlas-workspace', id)
    return id
  } catch {
    return 'personal'
  }
}

type AgentExtra = Pick<Agent, 'objectives' | 'toolIds' | 'personality' | 'avatar' | 'skills'> & { firstName?: string; lastName?: string }

function rememberProfile(id: string, extra: AgentExtra) {
  const map = JSON.parse(window.localStorage.getItem('atlas-agent-profiles') || '{}') as Record<string, AgentExtra>
  map[id] = extra
  window.localStorage.setItem('atlas-agent-profiles', JSON.stringify(map))
}

function rememberMeta(id: string, meta: OrgMeta) {
  const map = JSON.parse(window.localStorage.getItem('atlas-org-meta') || '{}') as Record<string, OrgMeta>
  map[id] = { ...map[id], ...meta }
  window.localStorage.setItem('atlas-org-meta', JSON.stringify(map))
}

function rememberedMeta(id: string): OrgMeta {
  try {
    const map = JSON.parse(window.localStorage.getItem('atlas-org-meta') || '{}') as Record<string, OrgMeta>
    return map[id] ?? {}
  } catch {
    return {}
  }
}

function knowledgeMap(): Record<string, string[]> {
  try {
    return JSON.parse(window.localStorage.getItem('atlas-knowledge-access') || '{}') as Record<string, string[]>
  } catch {
    return {}
  }
}

function rememberKnowledge(docId: string, agentIds: string[]) {
  const map = knowledgeMap()
  map[docId] = agentIds
  window.localStorage.setItem('atlas-knowledge-access', JSON.stringify(map))
}

function grantStore(): Record<string, Record<string, Record<string, ToolAccess>>> {
  try {
    return JSON.parse(window.localStorage.getItem('atlas-tool-grants') || '{}') as Record<string, Record<string, Record<string, ToolAccess>>>
  } catch {
    return {}
  }
}

function rememberGrants(organizationId: string, grants: Record<string, Record<string, ToolAccess>>) {
  const map = grantStore()
  map[organizationId] = grants
  window.localStorage.setItem('atlas-tool-grants', JSON.stringify(map))
}

function readersOf(doc: Doc, overlay: Record<string, string[]>): string[] {
  return overlay[doc.id] ?? doc.accessibleTo
}

function withProfiles(chart: Chart): Chart {
  try {
    const map = JSON.parse(window.localStorage.getItem('atlas-agent-profiles') || '{}') as Record<string, AgentExtra>
    return {
      ...chart,
      agents: chart.agents.map((agent) => {
        const extra = map[agent.id]
        const department = chart.departments.find((item) => item.id === agent.departmentId)?.name ?? ''
        const merged: Agent = extra
          ? {
              ...agent,
              firstName: extra.firstName || agent.firstName,
              lastName: extra.lastName || agent.lastName,
              skills: extra.skills?.length ? extra.skills : agent.skills,
              objectives: extra.objectives?.length ? extra.objectives : agent.objectives,
              toolIds: extra.toolIds?.length ? extra.toolIds : agent.toolIds,
              personality: {
                traits: extra.personality?.traits?.length ? extra.personality.traits : agent.personality?.traits ?? [],
                tone: extra.personality?.tone || agent.personality?.tone,
                hours: extra.personality?.hours || agent.personality?.hours,
              },
              avatar: extra.avatar?.face || extra.avatar?.voiceId
                ? {
                    appearance: extra.avatar.appearance ?? agent.avatar?.appearance ?? 'portrait',
                    age: extra.avatar.age ?? agent.avatar?.age ?? null,
                    style: extra.avatar.style ?? agent.avatar?.style ?? 'enterprise',
                    voiceId: extra.avatar.voiceId ?? agent.avatar?.voiceId ?? 'Ava',
                    face: resolveAgentFace(agent.firstName, agent.lastName, extra.avatar.face || agent.avatar?.face),
                  }
                : agent.avatar,
            }
          : agent
        const next = completeAgent(merged, department)
        rememberProfile(next.id, {
          firstName: next.firstName,
          lastName: next.lastName,
          skills: next.skills,
          objectives: next.objectives,
          toolIds: next.toolIds,
          personality: next.personality,
          avatar: next.avatar,
        })
        return next
      }),
    }
  } catch {
    return {
      ...chart,
      agents: chart.agents.map((agent) => completeAgent(agent, chart.departments.find((item) => item.id === agent.departmentId)?.name ?? '')),
    }
  }
}

function recognizer(): SpeechEngine | null {
  const root = window as unknown as {
    SpeechRecognition?: new () => SpeechEngine
    webkitSpeechRecognition?: new () => SpeechEngine
  }
  const Ctor = root.SpeechRecognition ?? root.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export function Bureau({ overlay = false }: { overlay?: boolean } = {}) {
  const [booting, setBooting] = useState(true)
  const [identity, setIdentity] = useState({ name: 'Vous', company: 'Votre entreprise' })
  const [chart, setChart] = useState<Chart | null>(null)
  const [view, setView] = useState<View>('organigramme')
  const [advanced, setAdvanced] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [hint, setHint] = useState('')
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [channel, setChannel] = useState<'texte' | 'voix'>('voix')
  const [spoken, setSpoken] = useState('')
  /** Phrase TTS en cours — pilote les visèmes (pas le texte accumulé). */
  const [speakChunk, setSpeakChunk] = useState('')
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [a2fClip, setA2fClip] = useState<import('@atlas/voice').MayaAceClip | null>(null)
  const lipClock = useRef<LipSyncClock>(createLipSyncClock())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'details' | 'permissions' | 'relations' | 'discussion'>('details')
  const [zoom, setZoom] = useState(1)
  const [notes, setNotes] = useState(false)
  const [deptDraft, setDeptDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [hire, setHire] = useState({ firstName: '', lastName: '', role: '', department: '' })
  const [fiche, setFiche] = useState<Fiche>({
    firstName: '',
    lastName: '',
    role: '',
    mission: '',
    department: '',
    reportsTo: '',
    skills: '',
    traits: '',
    tone: '',
    hours: '',
    voice: '',
    tools: [],
    knowledge: [],
    delegation: 'approval',
    ceiling: '',
  })
  const [knowledgeAccess, setKnowledgeAccess] = useState<Record<string, string[]>>({})
  const [orgMeta, setOrgMeta] = useState<OrgMeta>({})
  const [peer, setPeer] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [mission, setMission] = useState('')
  const [missionAgent, setMissionAgent] = useState('')
  const [missionNote, setMissionNote] = useState('')
  const [procedure, setProcedure] = useState('')
  const [steps, setSteps] = useState<Array<{ role: string; task: string }>>([])
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingWhen, setMeetingWhen] = useState('')
  const [docName, setDocName] = useState('')
  const [docAgents, setDocAgents] = useState<string[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [documents, setDocuments] = useState<Doc[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [counts, setCounts] = useState<{ openTasks: number; pendingDecisions: number; activeAgents: number } | null>(null)
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [links, setLinks] = useState<PublicLink[]>([])
  const [grants, setGrants] = useState<Record<string, Record<string, ToolAccess>>>({})
  const [notices, setNotices] = useState<Notice[]>([])
  const [toolAsks, setToolAsks] = useState<ToolAsk[]>([])
  const [runtimeModel, setRuntimeModel] = useState('')
  const [doneLessons, setDoneLessons] = useState<string[]>([])
  const [briefing, setBriefing] = useState<Intake | null>(null)
  const [build, setBuild] = useState<CreationShow | null>(null)
  const [pickedTools, setPickedTools] = useState<string[]>([])
  const [firstAsk, setFirstAsk] = useState('Fais-moi le point : qui travaille, et orchestre l’équipe ZTC.')
  const briefingRef = useRef<Intake | null>(null)
  const connectGate = useRef<(() => void) | null>(null)
  const enterGate = useRef<(() => void) | null>(null)
  const engine = useRef<SpeechEngine | null>(null)
  const hearing = useRef(false)
  const speaking = useRef(false)
  const voiceGen = useRef(0)
  const nimAudio = useRef(false)
  const mediaRef = useRef<HTMLAudioElement | null>(null)
  const spokenLine = useRef('')
  const voiceQueue = useRef<string[]>([])
  const voiceBusy = useRef(false)
  const voicePrefer = useRef<string | undefined>(undefined)
  const spokenDisplay = useRef('')
  const sessionCtx = useRef<SessionContext>(createSessionContext())
  const earLive = useRef(false)
  const pulse = useRef(0)
  const talkStream = useRef<MediaStream | null>(null)
  const talkContext = useRef<AudioContext | null>(null)
  const talkChunks = useRef<Float32Array[]>([])
  const [talking, setTalking] = useState(false)
  const [siri, setSiri] = useState<{
    kind: 'videos' | 'web' | 'app' | 'mail' | 'post'
    title: string
    query: string
    url: string
    reply?: string
    clips?: Array<{ id: string; title: string; url: string; thumb: string }>
    hits?: Array<{ title: string; extract: string; url: string }>
  } | null>(null)
  const [focusTool, setFocusTool] = useState<string | null>(null)
  const pilotRef = useRef<(text: string) => void>(() => {})
  const openedId = useRef<string | null>(null)
  const wantTab = useRef<'details' | 'permissions' | 'relations' | 'discussion' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const selected = chart?.agents.find((agent) => agent.id === selectedId) ?? null
  const needle = query.trim().toLowerCase()
  const agents = useMemo(() => {
    if (!chart) return []
    return chart.agents.filter((agent) => {
      if (!needle) return true
      const department = chart.departments.find((item) => item.id === agent.departmentId)?.name ?? ''
      return `${agent.firstName} ${agent.lastName} ${agent.role} ${department}`.toLowerCase().includes(needle)
    })
  }, [chart, needle])

  /** Bureau 3D = projection déterministe de l’organisation (pas un dessin manuel). */
  const officeOrg = useMemo<OfficeOrgInput | null>(() => {
    if (!chart?.organization?.id) return null
    const tools = links
      .filter((item) => item.status === 'connected')
      .map((item) => ({ id: item.provider, provider: item.provider }))
    // Si le gateway a encore une vieille équipe (Julien/Sophie…) → forcer le roster ZTC live.
    const ztcOk = ztcAgentCount(chart.agents.map((agent) => agent.firstName)) >= 12
      && missingZtcDesks(chart.agents.map((agent) => agent.firstName)).length === 0
    if (!ztcOk) {
      return ztcOfficeOrg(chart.organization, tools)
    }
    const departments = chart.departments.length
      ? chart.departments
      : [{ id: `${chart.organization.id}-seed`, name: 'Direction' }]
    return officeOrgFromChart({
      organization: chart.organization,
      sector: orgMeta.sector || 'Hébergement web et cloud',
      businessModel: orgMeta.businessModel || 'hosting',
      archetype: 'hosting',
      departments,
      agents: chart.agents.map((agent) => ({
        id: agent.id,
        departmentId: agent.departmentId || departments[0]!.id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        role: agent.role,
        presence: (agent.presence as 'online' | 'working' | 'idle' | 'offline' | undefined) ?? 'online',
        avatar: {
          face: resolveAgentFace(agent.firstName, agent.lastName, agent.avatar?.face),
          style: agent.avatar?.style || 'portrait',
          appearance: agent.avatar?.appearance || 'portrait',
        },
      })),
      tools,
    })
  }, [chart, links, orgMeta])
  /** Travail réel : tâches du gateway (si la route est déployée) + consignes envoyées depuis le studio. */
  const [liveTasks, setLiveTasks] = useState<LiveTask[] | null>(null)
  const [journal, setJournal] = useState<WorkItem[]>([])
  const [stream, setStream] = useState<'live' | 'polling' | 'off'>('off')
  const orgId = chart?.organization.id ?? null
  useEffect(() => {
    if (!orgId) {
      setJournal([])
      return
    }
    try {
      setJournal(JSON.parse(window.localStorage.getItem(`atlas-work-journal:${orgId}`) || '[]') as WorkItem[])
    } catch {
      setJournal([])
    }
  }, [orgId])

  function logWork(item: Omit<WorkItem, 'id' | 'source' | 'at'>) {
    if (!orgId) return
    setJournal((current) => {
      const next = [{ ...item, id: `j-${Date.now()}`, source: 'journal' as const, at: new Date().toISOString() }, ...current].slice(0, 120)
      window.localStorage.setItem(`atlas-work-journal:${orgId}`, JSON.stringify(next))
      return next
    })
  }

  async function loadTasks(id: string) {
    try {
      const body = await call<{ tasks: LiveTask[] }>(`/v1/organizations/${id}/tasks`)
      setLiveTasks(body.tasks ?? [])
    } catch {
      setLiveTasks(null)
    }
  }

  const realTasks = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of [...journal].reverse()) if (item.status === 'sent' || item.status === 'doing') map[item.agentId] = item.title
    for (const task of liveTasks ?? []) if (task.status === 'doing') map[task.agentId] = task.title
    return Object.keys(map).length ? map : null
  }, [journal, liveTasks])

  // Suivi en direct : flux d’événements du gateway, sinon rafraîchissement régulier.
  useEffect(() => {
    if (!orgId) {
      setStream('off')
      return
    }
    let timer: ReturnType<typeof setTimeout> | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void loadChart(orgId).then((next) => (next ? Promise.all([loadOps(orgId), loadTasks(orgId)]) : null)).catch(() => {})
      }, 700)
    }
    void loadTasks(orgId)
    const source = new EventSource(`${gatewayUrl}/v1/organizations/${orgId}/events`)
    source.onopen = () => setStream('live')
    source.onmessage = refresh
    source.onerror = () => {
      setStream('polling')
      if (!poll) poll = setInterval(refresh, 20_000)
    }
    return () => {
      source.close()
      if (timer) clearTimeout(timer)
      if (poll) clearInterval(poll)
    }
    // loadChart / loadOps sont des fonctions du composant, stables à l’usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  /** Jumeau partagé : Bureau 3D et Factures lisent les mêmes dossiers et le même plan ATLAS. */
  const twin = useOfficeTwin(officeOrg, counts, async (agentId, mission) => {
    const agent = chart?.agents.find((item) => item.id === agentId)
    if (!agent) return 'agent introuvable'
    const status = await assign(agent, mission).catch(() => 'non transmise')
    void loadOps(agent.organizationId)
    return status
  }, realTasks)

  /** Mission d’équipe : les employés du bureau deviennent les agents de la mission. */
  const crewMembers = useMemo<CrewMember[]>(() => twin.layout.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    department: twin.layout.rooms.find((room) => room.id === agent.roomId)?.name,
  })), [twin.layout])
  const connectedTools = useMemo(() => new Set(links.filter((item) => item.status === 'connected').map((item) => item.provider)), [links])
  const crew = useCrew({ orgId, organization: twin.name, members: crewMembers, connected: connectedTools })

  async function act(job: () => Promise<string>): Promise<ControlResult> {
    try {
      const note = await job()
      if (chart) {
        const next = await loadChart(chart.organization.id)
        if (next) await Promise.all([loadOps(next.organization.id), loadTasks(next.organization.id)])
      }
      return { ok: true, note }
    } catch (cause) {
      return { ok: false, note: cause instanceof Error ? cause.message : 'Action impossible.' }
    }
  }

  async function hireAgent(role: string, departmentName: string) {
    const org = chart!
    const department = org.departments.find((item) => item.name.toLowerCase() === departmentName.trim().toLowerCase())?.name
      ?? (departmentName.trim() || org.departments[0]?.name || 'Général')
    const { firstName, lastName } = freshName(org.agents)
    const payload = staffingPayload(org.organization.id, firstName, lastName, role, department)
    const hiredAgent = await call<Agent>('/v1/agents', { method: 'POST', body: JSON.stringify(payload) })
    rememberProfile(hiredAgent.id, {
      objectives: payload.objectives,
      toolIds: payload.toolIds,
      personality: { traits: payload.traits, tone: payload.tone, hours: payload.hours },
      avatar: { appearance: 'portrait', age: null, style: department.toLowerCase(), voiceId: payload.voiceId, face: payload.face },
    })
    return `${firstName} ${lastName} rejoint ${department}, au poste ${role}.`
  }

  async function removeAgent(agent: Agent) {
    await call(`/v1/agents/${agent.id}`, { method: 'DELETE' })
    if (selectedId === agent.id) setSelectedId(null)
    return `${agent.firstName} ${agent.lastName} a quitté l’organisation.`
  }

  async function grantTool(agent: Agent, provider: string, on: boolean) {
    const current = agent.toolIds ?? []
    const toolIds = on ? [...new Set([...current, provider])] : current.filter((item) => item !== provider)
    await call(`/v1/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify({ toolIds }) })
    const profiles = JSON.parse(window.localStorage.getItem('atlas-agent-profiles') || '{}') as Record<string, AgentExtra>
    if (profiles[agent.id]) rememberProfile(agent.id, { ...profiles[agent.id]!, toolIds })
    const label = CONNECTOR_CATALOG.find((item) => item.provider === provider)?.label ?? provider
    const live = links.some((item) => item.provider === provider && item.status === 'connected')
    if (!on) return `${agent.firstName} n’utilise plus ${label}.`
    return live
      ? `${agent.firstName} travaille maintenant avec ${label}, connecté pour de vrai.`
      : `${agent.firstName} a accès à ${label}. Connectez ${label} dans Intégrations pour travailler sur vos vraies données.`
  }

  const agentById = (id: string) => chart?.agents.find((item) => item.id === id) ?? null
  const officeControl: OfficeControl = {
    live: Boolean(chart),
    busy: pending,
    stream,
    departments: (chart?.departments ?? []).map((item) => ({ id: item.id, name: item.name, agents: (chart?.agents ?? []).filter((a) => a.departmentId === item.id).length })),
    delegation: (id) => agentById(id)?.delegation ?? null,
    tools: (id) => {
      const agent = agentById(id)
      if (!agent) return []
      const granted = new Set(agent.toolIds ?? [])
      const connected = new Set(links.filter((item) => item.status === 'connected').map((item) => item.provider))
      return CONNECTOR_CATALOG
        .filter((item) => granted.has(item.provider) || connected.has(item.provider))
        .map((item) => ({ provider: item.provider, label: item.label, granted: granted.has(item.provider), connected: connected.has(item.provider) }))
    },
    work: (id) => {
      const tasks = (liveTasks ?? []).filter((task) => task.agentId === id).map<WorkItem>((task) => ({ id: task.id, agentId: id, title: task.title, status: task.status, source: 'task', taskId: task.id }))
      const asks = decisions.filter((item) => item.requestedByAgentId === id).map<WorkItem>((item) => ({
        id: item.id,
        agentId: id,
        title: item.title,
        status: item.status === 'pending' ? 'pending' : item.status === 'approved' ? 'approved' : 'rejected',
        source: 'decision',
      }))
      const known = new Set([...tasks, ...asks].map((item) => item.title))
      const sent = journal.filter((item) => item.agentId === id && !known.has(item.title))
      const order: Record<string, number> = { doing: 0, pending: 1, sent: 2, todo: 3, approved: 4, done: 5, rejected: 6, denied: 7 }
      return [...tasks, ...asks, ...sent].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).slice(0, 12)
    },
    activity: [...audit].reverse().slice(0, 8).map((entry) => {
      const actor = agentById(entry.actorId)
      return { id: entry.id, at: entry.at, who: actor ? actor.firstName : 'Vous', what: `${AUDIT_LABEL[entry.action.split('.')[0] ?? ''] ?? entry.action} · ${entry.reason}` }
    }),
    mission: (id, text) => act(async () => {
      const agent = agentById(id)
      if (!agent) throw new Error('Agent introuvable.')
      const status = await assign(agent, text)
      return `${agent.firstName} : mission ${status}.`
    }),
    hire: (role, departmentName) => act(() => hireAgent(role, departmentName)),
    move: (id, departmentName) => act(async () => {
      const agent = agentById(id)
      if (!agent) throw new Error('Agent introuvable.')
      await call(`/v1/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify({ departmentName }) })
      return `${agent.firstName} rejoint ${departmentName}.`
    }),
    fire: (id) => act(async () => {
      const agent = agentById(id)
      if (!agent) throw new Error('Agent introuvable.')
      return removeAgent(agent)
    }),
    autonomy: (id, level) => act(async () => {
      const agent = agentById(id)
      if (!agent) throw new Error('Agent introuvable.')
      await call(`/v1/agents/${agent.id}/permissions`, { method: 'PATCH', body: JSON.stringify({ delegation: level, permissions: agent.permissions }) })
      return `${agent.firstName} travaille ${level === 'autonomous' ? 'en autonomie' : 'sous votre accord'}.`
    }),
    addDepartment: (name) => act(async () => {
      await call('/v1/departments', { method: 'POST', body: JSON.stringify({ organizationId: chart!.organization.id, name }) })
      return `Département ${name} ajouté.`
    }),
    removeDepartment: (departmentId) => act(async () => {
      const department = chart?.departments.find((item) => item.id === departmentId)
      await call(`/v1/departments/${departmentId}`, { method: 'DELETE' })
      return `Département ${department?.name ?? ''} supprimé.`
    }),
    grantTool: (id, provider, on) => act(async () => {
      const agent = agentById(id)
      if (!agent) throw new Error('Agent introuvable.')
      return grantTool(agent, provider, on)
    }),
    setTaskStatus: (taskId, status) => act(async () => {
      await call(`/v1/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      return status === 'done' ? 'Tâche terminée.' : 'Tâche mise à jour.'
    }),
    openIntegrations: () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      setView('integrations')
    },
  }
  const [officeFocus, setOfficeFocus] = useState<OfficeFocus | null>(null)
  const [invoiceScope, setInvoiceScope] = useState<InvoiceScope | null>(null)
  const overdueInvoices = officeOrg ? twin.ops.records.filter((record) => record.status === 'overdue').length : 0

  function locateInOffice(target: { agentId?: string | null; roomId?: string | null }) {
    setView('bureau')
    setSelectedId(target.agentId ?? null)
    if (target.agentId) setTab('details')
    setOfficeFocus({ agentId: target.agentId, roomId: target.agentId ? null : target.roomId, nonce: Date.now() })
  }

  /** Applique une commande venue du mobile (assistant ATLAS). */
  function applyStudioRemote(action: import('@/lib/atlas-studio-queue').StudioRemoteAction) {
    if (action.kind === 'ui') {
      if (action.op === 'fullscreen' || action.op === 'overview' || action.op === 'top') setView('bureau')
      window.dispatchEvent(new CustomEvent('atlas-studio-remote', { detail: { op: action.op } }))
      if (action.op === 'fullscreen') speak('Bureau 3D en plein écran.')
      else if (action.op === 'exitFullscreen') speak('Plein écran quitté.')
      else if (action.op === 'top') speak('Vue du dessus.')
      else speak('Vue d’ensemble.')
      return
    }
    if (action.kind === 'navigate') {
      setView(action.view)
      speak(`J’ouvre ${viewLabel(action.view)}.`)
      return
    }
    if (action.kind === 'home') {
      setView('organigramme')
      speak('Retour à l’organigramme.')
      return
    }
    if (action.kind === 'mode') {
      setAdvanced(action.advanced)
      speak(action.advanced ? 'Mode avancé.' : 'Mode simple.')
      return
    }
    if (action.kind === 'room') {
      setView('bureau')
      const rooms = officeOrg?.layout.rooms ?? []
      const hit = rooms.find((room) => room.name.toLowerCase().includes(action.target.toLowerCase().slice(0, 24)))
      if (hit) setOfficeFocus({ roomId: hit.id, nonce: Date.now() })
      speak(hit ? `Salle ${hit.name}.` : `Bureau 3D — salle « ${action.target} ».`)
      return
    }
    if (action.kind === 'tools') {
      if (document.fullscreenElement) void document.exitFullscreen()
      setView('integrations')
      speak('J’ouvre les intégrations.')
      return
    }
    if (action.kind === 'brief' || action.kind === 'team' || action.kind === 'tasks' || action.kind === 'load') {
      const map = { brief: 'observabilite', team: 'employes', tasks: 'missions', load: 'observabilite' } as const
      setView(map[action.kind])
      speak(action.kind === 'team' ? 'Équipe.' : action.kind === 'tasks' ? 'Missions.' : action.kind === 'load' ? 'Observabilité.' : 'Briefing.')
      return
    }
    if (action.kind === 'orchestrate') {
      setView(action.scope === 'relance' || action.scope === 'envoi' ? 'factures' : 'bureau')
      speak('Orchestration ouverte sur le Studio.')
      return
    }
    if (action.kind === 'compose') {
      setView('organigramme')
      void beginCompose(action.text)
      speak('Je compose sur le Studio.')
    }
  }

  function openInvoices(scope: { roomId?: string; agentId?: string }) {
    if (document.fullscreenElement) void document.exitFullscreen()
    setInvoiceScope({ ...scope, nonce: Date.now() })
    setView('factures')
  }

  async function adoptPersonalLinks(orgId: string) {
    const personal = personalWorkspaceId()
    if (!personal || personal === orgId) return
    try {
      const response = await fetch('/api/atlas/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent: 'migrate', organizationId: orgId, from: personal }),
      })
      const body = await response.json() as { links?: PublicLink[] }
      if (body.links) setLinks(body.links)
    } catch { /* ignore */ }
  }

  async function loadChart(id?: string) {
    const next = normalize(await call<Partial<Chart>>(id ? `/v1/organizations/${id}` : '/v1/organizations'))
    if (next) {
      const merged = withProfiles(next)
      merged.organization.name = ZTC_NAME
      rememberName(merged.organization.id, ZTC_NAME)
      setChart(merged)
      const meta = { ...rememberedMeta(merged.organization.id), sector: 'Hébergement web et cloud', businessModel: 'hosting' as const }
      rememberMeta(merged.organization.id, meta)
      setOrgMeta(meta)
      window.localStorage.setItem('atlas-organization', merged.organization.id)
      await adoptPersonalLinks(merged.organization.id)
      return merged
    }
    return null
  }

  async function syncZtcDesks(base: Chart) {
    if (!needsZtcRoster(base, { sector: 'Hébergement web et cloud', businessModel: 'hosting' })) {
      return base
    }
    pushNotice('connect', 'Équipe ZTC', `Installation des ${ZTC_DESKS.length} postes (Radar, Marketing Flare/Clip/Boost/Muse…).`)
    const result = await ensureZtcRoster(base, call, rememberProfile)
    const refreshed = await loadChart(result.chartId)
    if (result.hired.length) {
      pushNotice('tool', 'Postes ZTC', `${result.hired.join(', ')} · ${ZTC_DESKS.length} employés infrastructure prêts.`)
    } else {
      pushNotice('tool', 'Postes ZTC', `${ZTC_DESKS.length} employés déjà alignés sur les départements live.`)
    }
    return refreshed ?? base
  }

  async function loadOps(id: string) {
    const [approvalBody, knowledgeBody, meetingBody, observeBody, connectorBody] = await Promise.all([
      call<{ decisions: Decision[] }>(`/v1/organizations/${id}/approvals`).catch(() => ({ decisions: [] })),
      call<{ documents: Doc[] }>(`/v1/organizations/${id}/knowledge`).catch(() => ({ documents: [] })),
      call<{ meetings: Meeting[] }>(`/v1/organizations/${id}/meetings`).catch(() => ({ meetings: [] })),
      call<{ openTasks: number; pendingDecisions: number; activeAgents: number; recentAudit: Audit[] }>(`/v1/organizations/${id}/observability`).catch(() => null),
      call<{ connectors: Connector[] }>('/v1/connectors').catch(() => ({ connectors: [] })),
    ])
    setDecisions(approvalBody.decisions ?? [])
    setDocuments(knowledgeBody.documents ?? [])
    setMeetings(meetingBody.meetings ?? [])
    setAudit(observeBody?.recentAudit ?? [])
    setCounts(observeBody ? { openTasks: observeBody.openTasks, pendingDecisions: observeBody.pendingDecisions, activeAgents: observeBody.activeAgents } : null)
    setConnectors(CONNECTOR_CATALOG.map((item) => {
      const remote = (connectorBody.connectors ?? []).find((entry) => entry.provider === item.provider)
      return { ...item, ...remote }
    }))
    void fetch(`/api/atlas/connect?organizationId=${encodeURIComponent(id)}`)
      .then((response) => response.json() as Promise<{ links?: PublicLink[] }>)
      .then((body) => setLinks(body.links ?? []))
      .catch(() => {})
  }

  function pushNotice(kind: string, title: string, detail: string) {
    setNotices((current) => {
      const next = [{ id: `${Date.now()}-${kind}`, kind, title, detail, at: new Date().toISOString() }, ...current].slice(0, 40)
      window.localStorage.setItem('atlas-notices', JSON.stringify(next))
      return next
    })
  }

  function linked(provider: string) {
    return links.find((item) => item.provider === provider && item.status === 'connected') ?? null
  }

  function workspaceId() {
    return chart?.organization.id || personalWorkspaceId()
  }

  async function refreshLinks(id?: string) {
    const orgId = id || workspaceId()
    try {
      const response = await fetch(`/api/atlas/connect?organizationId=${encodeURIComponent(orgId)}`)
      const body = await response.json() as { links?: PublicLink[] }
      if (body.links) setLinks(body.links)
      return body.links ?? []
    } catch {
      return [] as PublicLink[]
    }
  }

  async function connectProvider(provider: string) {
    const orgId = workspaceId()
    const response = await fetch('/api/atlas/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'authorize', organizationId: orgId, provider }),
    })
    const body = await response.json() as {
      ok?: boolean
      method?: string
      startUrl?: string
      setup?: string
      hint?: string
      error?: string
      links?: PublicLink[]
    }
    if (body.links) setLinks(body.links)
    if (body.method === 'connected' && body.ok) {
      pushNotice('connect', 'Outil relié', `${connectorLabel(provider)} est connecté.`)
      return { ok: true as const }
    }
    if (body.startUrl) {
      const ok = await openOauthWindow(body.startUrl, provider)
      const nextLinks = await refreshLinks(orgId)
      const linked = nextLinks.some((item) => item.provider === provider && item.status === 'connected')
      pushNotice('connect', linked || ok ? 'Outil relié' : 'Connexion', linked || ok ? `${connectorLabel(provider)} est connecté.` : 'Autorisez l’accès dans la fenêtre, puis revenez.')
      return { ok: linked || ok }
    }
    if (body.method === 'setup') {
      setFocusTool(provider)
      setView('integrations')
      const detail = body.hint || body.error || 'Complétez la clé API, l’URL MCP ou les Client ID / Secret, puis Relier.'
      pushNotice('connect', 'Configuration requise', detail)
      return { ok: false as const, error: detail, setup: true as const }
    }
    pushNotice('connect', 'Connexion', body.error ?? 'La connexion n’a pas abouti.')
    return { ok: false as const, error: body.error }
  }

  function openOauthWindow(startUrl: string, provider: string) {
    return new Promise<boolean>((resolve) => {
      const popup = window.open(startUrl, 'atlas-oauth', 'popup=yes,width=480,height=720')
      if (!popup || popup === window) {
        window.open(startUrl, '_blank', 'noopener')
        resolve(false)
        return
      }
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer)
          window.removeEventListener('message', onMessage)
          resolve(false)
        }
      }, 600)
      function onMessage(event: MessageEvent) {
        const data = event.data as { type?: string; ok?: boolean; provider?: string }
        if (data?.type !== 'atlas-oauth' || data.provider !== provider) return
        window.clearInterval(timer)
        window.removeEventListener('message', onMessage)
        popup.close()
        resolve(Boolean(data.ok))
      }
      window.addEventListener('message', onMessage)
    })
  }

  async function invokeTool(provider: string, tool: string, input: string, confirm = false) {
    const response = await fetch('/api/atlas/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'invoke', organizationId: workspaceId(), provider, tool, input, confirm }),
    })
    const body = await response.json() as { ok?: boolean; error?: string; requiresApproval?: boolean; preview?: string; result?: string; tool?: string; ask?: string }
    if (body.requiresApproval) {
      setToolAsks((current) => [{ id: `${Date.now()}`, provider, tool: body.tool || tool, input, preview: body.preview || tool }, ...current])
      setView('approbations')
      pushNotice('approval', 'Action outil à valider', body.preview || `${provider} · ${tool}`)
      return body
    }
    pushNotice(body.ok ? 'tool' : 'risk', provider, body.result || body.error || '')
    return body
  }

  useEffect(() => {
    const savedLessons = window.localStorage.getItem('atlas-lessons')
    if (savedLessons) setDoneLessons(savedLessons.split('|').filter(Boolean))
    setIdentity({ name: profileName(), company: companyLabel() })
    try {
      const savedNotes = window.localStorage.getItem('atlas-notices')
      if (savedNotes) setNotices(JSON.parse(savedNotes) as Notice[])
    } catch { /* ignore */ }
    try {
      setKnowledgeAccess(knowledgeMap())
    } catch {
      setKnowledgeAccess({})
    }
    void (async () => {
      try {
        const next = await loadChart()
        if (next) {
          const synced = await syncZtcDesks(next)
          await loadOps(synced.organization.id)
        } else await refreshLinks(personalWorkspaceId())
      } catch {
        const saved = window.localStorage.getItem('atlas-organization')
        if (saved) {
          try {
            const next = await loadChart(saved)
            if (next) {
              const synced = await syncZtcDesks(next)
              await loadOps(synced.organization.id)
            } else await refreshLinks(personalWorkspaceId())
          } catch {
            setChart(null)
            await refreshLinks(personalWorkspaceId())
          }
        } else {
          await refreshLinks(personalWorkspaceId())
        }
      } finally {
        setBooting(false)
      }
    })()
    void fetch(`${gatewayUrl}/v1/runtime`, { headers: { 'x-atlas-user': userId() } })
      .then((response) => response.ok ? response.json() as Promise<{ nim?: { model?: string } }> : null)
      .then((body) => { if (body?.nim?.model) setRuntimeModel(body.nim.model) })
      .catch(() => setRuntimeModel(''))
  }, [])

  useEffect(() => {
    const id = chart?.organization.id
    if (!id) {
      setGrants({})
      return
    }
    setGrants(grantStore()[id] ?? {})
  }, [chart?.organization.id])

  const applyStudioRemoteRef = useRef(applyStudioRemote)
  applyStudioRemoteRef.current = applyStudioRemote

  /** Mobile ATLAS → pilotage live de cet onglet Studio. */
  useEffect(() => {
    let cursor = Date.now() - 2000
    let alive = true
    async function pull() {
      try {
        const org = typeof window !== 'undefined' ? window.localStorage.getItem('atlas-organization') : null
        const response = await fetch(
          `/api/atlas/studio-commands?since=${cursor}${org ? `&organizationId=${encodeURIComponent(org)}` : ''}`,
          { headers: { 'x-atlas-user': userId() } },
        )
        if (!response.ok || !alive) return
        const body = await response.json() as {
          commands?: Array<{ at: number; action: import('@/lib/atlas-studio-queue').StudioRemoteAction }>
          cursor?: number
        }
        if (typeof body.cursor === 'number' && body.cursor > cursor) cursor = body.cursor
        for (const command of body.commands ?? []) {
          applyStudioRemoteRef.current(command.action)
        }
      } catch { /* Studio offline / réseau */ }
    }
    const timer = window.setInterval(() => { void pull() }, 500)
    void pull()
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!selected || !chart) return
    const spend = selected.permissions.find((item) => item.action === 'spend')
    setFiche({
      firstName: selected.firstName,
      lastName: selected.lastName,
      role: selected.role,
      mission: selected.mission,
      department: chart.departments.find((item) => item.id === selected.departmentId)?.name ?? '',
      reportsTo: selected.reportsToId ?? '',
      skills: (selected.skills ?? []).join(', '),
      traits: (selected.personality?.traits ?? []).join(', '),
      tone: selected.personality?.tone ?? '',
      hours: selected.personality?.hours ?? '',
      voice: selected.avatar?.voiceId && selected.avatar.voiceId !== 'Ava' ? selected.avatar.voiceId : agentVoice(selected.firstName),
      tools: selected.toolIds ?? [],
      knowledge: documents.filter((item) => readersOf(item, knowledgeAccess).includes(selected.id)).map((item) => item.id),
      delegation: selected.delegation,
      ceiling: spend?.spendLimit ? String(spend.spendLimit) : '',
    })
    if (openedId.current !== selected.id) {
      openedId.current = selected.id
      setTab(wantTab.current ?? 'details')
      wantTab.current = null
    }
    void call<{ messages: ChatMessage[] }>(`/v1/organizations/${chart.organization.id}/agents/${selected.id}/messages`)
      .then((body) => setChat(body.messages ?? []))
      .catch(() => setChat([]))
  }, [selected, chart])

  useEffect(() => {
    if (!selected) return
    const granted = documents.filter((item) => readersOf(item, knowledgeAccess).includes(selected.id)).map((item) => item.id)
    setFiche((current) => current.knowledge.join('|') === granted.join('|') ? current : { ...current, knowledge: granted })
  }, [selected, documents, knowledgeAccess])

  useEffect(() => () => {
    hearing.current = false
    speaking.current = false
    window.clearInterval(pulse.current)
    engine.current?.stop()
    window.speechSynthesis?.cancel()
  }, [])

  useEffect(() => {
    hearing.current = true
    setListening(true)
    const timer = window.setTimeout(() => {
      speak(atlasGreeting(profileName()))
    }, 500)
    return () => window.clearTimeout(timer)
  // Montage uniquement : salutation vocale
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(action: () => Promise<void>) {
    if (pending) return false
    setPending(true)
    setHint('')
    try {
      await action()
      if (chart) {
        const next = await loadChart(chart.organization.id)
        if (next) await loadOps(next.organization.id)
      }
      return true
    } catch (cause) {
      setHint(cause instanceof Error ? cause.message : 'Action impossible.')
      return false
    } finally {
      setPending(false)
    }
  }

  function saveBriefing(value: Intake | null) {
    briefingRef.current = value
    setBriefing(value)
  }

  function pause(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
  }

  function showBuild(patch: Partial<CreationShow> & { tick?: { ok: boolean; text: string } }) {
    setBuild((current) => {
      const base: CreationShow = current ?? {
        beat: '1',
        title: 'Analyse de votre vision',
        line: '',
        log: [],
        percent: 0,
        phase: 'analyze',
        birth: {},
        intel: [],
      }
      return {
        ...base,
        ...patch,
        log: patch.log ?? (patch.tick ? [...base.log, patch.tick].slice(-18) : base.log),
        birth: patch.birth ?? base.birth,
        intel: patch.intel ?? base.intel,
      }
    })
  }

  async function narrate(line: string, patch: Partial<CreationShow> = {}) {
    showBuild({ ...patch, line })
    setSpoken(line)
    setHint('')
    voice(line)
    await pause(Math.min(2400, 650 + line.length * 18))
  }

  async function generate(text?: string) {
    const raw = (text ?? draft).trim()
    if (raw.length < 3 || pending) {
      if (raw.length < 3) setHint('Décrivez d’abord votre intention.')
      return false
    }
    const message = lockToZtc(raw)
    setPending(true)
    setHint('')
    setView('organigramme')
    setSelectedId(null)
    setTab('details')
    setQuery('')
    setFirstAsk('Dresse l’inventaire réel depuis ztchosting.com et /order. Qualifie chaque fait. Aucun SLA inventé.')
    showBuild({
      beat: '1',
      title: 'Analyse de votre vision',
      line: 'Je lis votre intention.',
      log: [{ ok: true, text: 'Description reçue' }],
      percent: 6,
      phase: 'analyze',
      ready: false,
      birth: {},
    })
    try {
      const planPromise = fetch('/api/atlas/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intention: message }),
      }).then(async (response) => (response.ok ? await response.json() as OrganizationDraft : null))
      for (const tick of [
        { ok: false, text: 'Analyse du secteur...' },
        { ok: false, text: 'Identification des fonctions nécessaires...' },
        { ok: false, text: 'Détermination de la structure...' },
        { ok: false, text: 'Définition des départements...' },
      ]) {
        showBuild({ tick, percent: 10 })
        await pause(900)
      }
      showBuild({ tick: { ok: false, text: 'Réflexion en cours...' }, percent: 14, line: 'Je compose l’équipe à partir de votre vision.' })
      const plan = await planPromise
      if (!plan?.roles?.length) throw new Error('L’organigramme n’a pas pu être dessiné.')
      const depts = uniqueNames(plan.roles.map((role) => role.department))
      const model = businessModelLabel(plan.businessModel) || plan.businessModel || 'entreprise'
      const sector = plan.sector || 'votre marché'
      await narrate(
        `Je comprends votre organisation comme une ${model} spécialisée en ${sector}.`,
        { beat: '2', title: 'Analyse de votre vision', percent: 18, tick: { ok: true, text: `Secteur : ${sector}` } },
      )
      await narrate(
        `Je vais construire une structure orientée ${depts.slice(0, 6).join(', ')}.`,
        { percent: 22, tick: { ok: true, text: `Structure : ${depts.join(', ')}` } },
      )
      const created = normalize(await call<Partial<Chart>>('/v1/studio/organizations', {
        method: 'POST',
        body: JSON.stringify({ intention: message }),
      }))
      if (!created) throw new Error('L’organigramme n’a pas pu être dessiné.')
      for (const agent of created.agents) {
        await call(`/v1/agents/${agent.id}`, { method: 'DELETE' }).catch(() => null)
      }
      const wiped = await loadChart(created.organization.id)
      if (wiped) {
        for (const department of wiped.departments) {
          await call(`/v1/departments/${department.id}`, { method: 'DELETE' }).catch(() => null)
        }
      }
      await loadChart(created.organization.id)
      rememberName(created.organization.id, plan.name)
      rememberMeta(created.organization.id, { sector: plan.sector, businessModel: plan.businessModel })
      setOrgMeta({ sector: plan.sector, businessModel: plan.businessModel })
      await narrate('Votre direction est créée.', {
        beat: '3',
        title: 'Direction',
        phase: 'ceo',
        percent: 28,
        tick: { ok: true, text: `${identity.name} — CEO` },
      })
      showBuild({ phase: 'departments', beat: '4', title: 'Départements', percent: 32 })
      for (const [index, name] of depts.entries()) {
        await call('/v1/departments', {
          method: 'POST',
          body: JSON.stringify({ organizationId: created.organization.id, name }),
        }).catch(() => null)
        await loadChart(created.organization.id)
        showBuild({
          tick: { ok: true, text: `${name} créé` },
          percent: 32 + Math.round(((index + 1) / Math.max(depts.length, 1)) * 10),
          line: `${name} se rattache à ${identity.name}.`,
        })
        await pause(750)
      }
      const hired: Agent[] = []
      const birth: Record<string, 'init' | 'ready'> = {}
      showBuild({ phase: 'agents', beat: '5', title: 'Agents', percent: 44 })
      for (const [index, role] of plan.roles.entries()) {
        showBuild({
          line: `${role.firstName} rejoint ${role.department}.`,
          percent: 44 + Math.round((index / Math.max(plan.roles.length, 1)) * 14),
        })
        const hiredAgent = await call<Agent>('/v1/agents', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: created.organization.id,
            departmentName: role.department,
            firstName: role.firstName,
            lastName: role.lastName,
            role: role.role,
            mission: role.mission,
            skills: role.skills,
            traits: role.traits,
            tone: role.tone,
            hours: role.hours,
            objectives: role.objectives,
            toolIds: role.toolIds,
            voiceId: role.voiceId,
            face: role.face || agentFace(role.firstName, role.lastName),
            delegation: role.delegation,
            permissions: role.permissions,
            reportsToId: null,
          }),
        })
        hired.push(hiredAgent)
        birth[hiredAgent.id] = 'init'
        rememberProfile(hiredAgent.id, {
          firstName: role.firstName,
          lastName: role.lastName,
          skills: role.skills,
          objectives: role.objectives,
          toolIds: role.toolIds,
          personality: { traits: role.traits, tone: role.tone, hours: role.hours },
          avatar: {
            appearance: 'portrait',
            age: null,
            style: role.department.toLowerCase(),
            voiceId: role.voiceId ?? 'Ava',
            face: role.face || agentFace(role.firstName, role.lastName),
          },
        })
        await loadChart(created.organization.id)
        setSelectedId(hiredAgent.id)
        setTab('details')
        showBuild({
          birth: { ...birth },
          tick: { ok: true, text: `${role.firstName} — ${role.role}` },
        })
        await pause(500)
        showBuild({
          beat: '6',
          title: `${role.firstName} · configuration`,
          phase: 'configure',
          line: `${role.firstName} : ${role.mission}`,
          tick: { ok: true, text: `${role.firstName} configuré` },
        })
        const skillLine = (role.skills ?? []).slice(0, 4).join(', ') || 'compétences du poste'
        showBuild({ tick: { ok: true, text: `→ Objectifs définis` } })
        showBuild({ tick: { ok: true, text: `→ Compétences : ${skillLine}` } })
        const toolLine = (role.toolIds ?? []).slice(0, 4).map(connectorLabel).join(', ') || 'à choisir'
        showBuild({ tick: { ok: true, text: `→ Outils : ${toolLine}` } })
        const born = await fetch('/api/atlas/birth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            organization: plan.name,
            intention: message,
            agent: {
              firstName: role.firstName,
              lastName: role.lastName,
              role: role.role,
              mission: role.mission,
              skills: role.skills,
              tools: (role.toolIds ?? []).map(connectorLabel),
              department: role.department,
            },
          }),
        }).then(async (response) => (response.ok ? await response.json() as { memory?: string } : { memory: '' })).catch(() => ({ memory: '' }))
        const memory = (born.memory || `${role.firstName} porte ${role.role} au département ${role.department}. Mission : ${role.mission}.`).trim()
        rememberMemory(hiredAgent.id, memory)
        await call(`/v1/organizations/${created.organization.id}/agents/${hiredAgent.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ authorId: hiredAgent.id, body: memory }),
        }).catch(() => null)
        await call('/v1/knowledge', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: created.organization.id,
            name: `Mémoire — ${role.firstName} ${role.role}`,
            mimeType: 'text/plain',
            accessibleTo: [hiredAgent.id],
          }),
        }).catch(() => null)
        await pause(400)
      }
      const byRole = new Map(hired.map((agent) => [agent.role, agent]))
      showBuild({ beat: '7', title: 'Relations', phase: 'relations', percent: 70, line: 'Je relie la hiérarchie et les collaborations.' })
      for (const role of plan.roles) {
        const agent = byRole.get(role.role)
        const manager = role.reportsToRole ? byRole.get(role.reportsToRole) : undefined
        if (!agent || !manager) continue
        await call(`/v1/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify({ reportsToId: manager.id }) })
      }
      const heads: Agent[] = []
      const seenDept = new Set<string>()
      for (const role of plan.roles) {
        const key = role.department.toLowerCase()
        const agent = byRole.get(role.role)
        if (!agent || seenDept.has(key)) continue
        seenDept.add(key)
        heads.push(agent)
      }
      for (let index = 0; index < heads.length - 1; index += 1) {
        await call('/v1/relations', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: created.organization.id,
            fromAgentId: heads[index].id,
            toAgentId: heads[index + 1].id,
          }),
        }).catch(() => null)
      }
      if (heads.length >= 3) {
        await call('/v1/relations', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: created.organization.id,
            fromAgentId: heads[0].id,
            toAgentId: heads[heads.length - 1].id,
          }),
        }).catch(() => null)
      }
      await loadChart(created.organization.id)
      showBuild({ tick: { ok: true, text: 'Hiérarchie créée' } })
      showBuild({ tick: { ok: true, text: 'Relations de collaboration créées' } })
      showBuild({ tick: { ok: true, text: 'Flux de communication configurés' } })
      await pause(700)
      showBuild({ beat: '8', title: 'Permissions', phase: 'permissions', percent: 76, line: 'Configuration des permissions...' })
      for (const role of plan.roles) {
        const granted = (role.permissions ?? []).filter((item) => item.allowed).map((item) => permissionLabel(item.action))
        const blocked = (role.permissions ?? []).some((item) => item.action === 'finance' && item.allowed)
          ? []
          : ['Finance']
        const marks = [
          ...granted.slice(0, 3).map((item) => `✓ ${item}`),
          ...blocked.map((item) => `○ ${item}`),
        ].join(' · ')
        showBuild({ tick: { ok: true, text: `${role.firstName} ${marks}` } })
        await pause(420)
      }
      await narrate('Les permissions ont été configurées selon les responsabilités de chaque agent.', { percent: 80 })
      const intel = ATLAS_INTEL.map((item) => ({ ...item, ok: false }))
      showBuild({ beat: '9', title: 'Intelligence ATLAS', phase: 'memory', percent: 84, line: 'Je construis l’intelligence collective de l’organisation.', intel })
      const allIds = hired.map((agent) => agent.id)
      const knowledgeNames = ['Mémoire organisationnelle', 'Objectifs de l’entreprise', 'Structure', 'Rôles', 'Responsabilités', 'Contexte métier', 'Knowledge Base']
      for (const [index, name] of knowledgeNames.entries()) {
        const doc = await call<{ id?: string }>('/v1/knowledge', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: created.organization.id,
            name,
            mimeType: 'text/plain',
            accessibleTo: allIds,
          }),
        }).catch(() => null)
        if (doc?.id) rememberKnowledge(doc.id, allIds)
        if (intel[index]) intel[index] = { ...intel[index], ok: true }
        showBuild({ intel: intel.map((item) => ({ ...item })) })
        await pause(320)
      }
      for (const id of allIds) birth[id] = 'ready'
      showBuild({ birth: { ...birth }, percent: 88, intel: intel.map((item) => ({ ...item, ok: true })) })
      await loadChart(created.organization.id)
      await loadOps(created.organization.id)
      const fromPlan = uniqueNames(plan.roles.flatMap((role) => role.toolIds ?? []))
      const suggested = uniqueNames([...fromPlan, 'gmail', 'google_calendar', 'slack', 'github', 'google_drive', 'hubspot', 'notion'])
      const preset = fromPlan.length ? fromPlan : suggested.filter((item) => !['hubspot', 'notion'].includes(item))
      setPickedTools(preset)
      showBuild({
        beat: '10',
        title: 'Outils',
        phase: 'tools',
        percent: 90,
        tools: suggested,
        line: 'Cliquez Relier : une fenêtre d’autorisation s’ouvre. Vous n’avez rien à coller.',
      })
      await new Promise<void>((resolve) => {
        connectGate.current = resolve
      })
      connectGate.current = null
      const afterHire = await loadChart(created.organization.id)
      if (afterHire) {
        for (const department of afterHire.departments) {
          const occupied = afterHire.agents.some((agent) => agent.departmentId === department.id)
          if (!occupied) await call(`/v1/departments/${department.id}`, { method: 'DELETE' }).catch(() => null)
        }
      }
      await call(`/v1/organizations/${created.organization.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: plan.name, objective: plan.objective }),
      }).catch(() => null)
      const loaded = await loadChart(created.organization.id)
      if (loaded && loaded.organization.name === 'Nouvelle organisation') {
        loaded.organization.name = plan.name
        loaded.organization.objective = plan.objective
        setChart({ ...loaded })
      }
      setDraft('')
      setSelectedId(null)
      const skillCount = plan.roles.reduce((sum, role) => sum + (role.skills?.length ?? 0), 0)
      const toolCount = uniqueNames(plan.roles.flatMap((role) => role.toolIds ?? [])).length
      await narrate('Votre organisation est opérationnelle.', {
        beat: '11',
        title: plan.name,
        phase: 'ready',
        percent: 100,
        ready: true,
        summary: {
          agents: hired.length,
          depts: depts.length,
          skills: skillCount,
          tools: Math.max(toolCount, chosen.length),
        },
      })
      await new Promise<void>((resolve) => {
        enterGate.current = resolve
      })
      enterGate.current = null
      const sales = hired.find((agent) => /sale|commerc|growth|account/i.test(`${agent.role} ${agent.mission}`)) ?? hired[0]
      const marketing = hired.find((agent) => /market|brand|growth|cmo/i.test(`${agent.role}`)) ?? hired[1] ?? hired[0]
      const offer = sales && marketing && sales.id !== marketing.id
        ? `Votre organisation est opérationnelle. Que voulez-vous lui faire accomplir ? Je peux demander à ${sales.firstName} de commencer l’analyse commerciale. ${marketing.firstName} pourra ensuite préparer une stratégie d’acquisition.`
        : `Votre organisation est opérationnelle. Que voulez-vous lui faire accomplir ?`
      await narrate(offer, {
        beat: '12',
        title: 'Première mission',
        phase: 'ask',
        percent: 100,
        ready: false,
        offer,
      })
      setPending(false)
      return true
    } catch (cause) {
      setDraft(message)
      setHint(cause instanceof Error ? cause.message : 'L’organigramme n’a pas pu être dessiné.')
      setBuild(null)
      setPending(false)
      return false
    }
  }

  async function beginCompose(text: string): Promise<'ask' | boolean> {
    const heard = text.trim()
    if (heard.length < 3) return false
    const slot = nextIntakeSlot(heard)
    if (slot) {
      saveBriefing({ base: heard })
      const question = intakeQuestion(slot)
      setHint(question)
      setSpoken(question)
      voice(question)
      return 'ask'
    }
    saveBriefing(null)
    return generate(heard)
  }

  function spokenVoice(synth: SpeechSynthesis, lang: string, prefer?: string) {
    const prefix = lang.slice(0, 2).toLowerCase()
    const voices = synth.getVoices().filter((item) => item.lang.toLowerCase().startsWith(prefix))
    const wanted = prefer?.toLowerCase()
    if (wanted) {
      const named = voices.find((item) => item.name.toLowerCase().includes(wanted))
      if (named) return named
    }
    const rank = (name: string) => {
      const value = name.toLowerCase()
      if (/natural|neural|online|premium/.test(value)) return 0
      if (/hortense|denise|henri|sylvie|louise|julie|audrey|aria|jenny/.test(value)) return 1
      return 2
    }
    return voices.sort((left, right) => rank(left.name) - rank(right.name))[0]
  }

  function attachEar() {
    const ear = recognizer()
    if (!ear) return null
    ear.lang = 'en-US'
    ear.continuous = true
    ear.interimResults = false
    ear.onstart = () => { earLive.current = true }
    ear.onresult = (event) => {
      const chunks: string[] = []
      for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
        const row = event.results[index]
        if (!row || row.isFinal === false) continue
        const bit = row[0]?.transcript?.trim()
        if (bit) chunks.push(bit)
      }
      const text = chunks.join(' ').trim()
      if (!text || (/comment puis-je vous aider/i.test(text) && text.length < 90)) return
      // Ignore TTS echo picked up by the mic while Atlas speaks
      const echo = spokenLine.current.toLowerCase()
      const heard = text.toLowerCase()
      if (echo && (echo.includes(heard) || heard.includes(echo.slice(0, Math.min(28, echo.length))))) return
      if (speaking.current) interruptSpeech()
      setDraft(text)
      setHint('')
      pilotRef.current(text)
    }
    ear.onerror = (event) => {
      earLive.current = false
      if (event.error === 'network') return
      if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'service-not-allowed') {
        setSpoken("I can't access the microphone. Allow mic access, then click Atlas's face.")
      }
    }
    ear.onend = () => {
      earLive.current = false
      if (!hearing.current) return
      // Keep listening even while Atlas talks — enables barge-in
      window.setTimeout(() => { if (hearing.current) openEar() }, 300)
    }
    engine.current = ear
    return ear
  }

  function openEar() {
    if (!hearing.current) return
    if (earLive.current) return
    try { engine.current?.stop() } catch { /* ancien micro déjà fermé */ }
    const ear = attachEar()
    if (!ear) return
    try { ear.start() } catch { /* nouvel essai au prochain cycle */ }
  }

  function interruptSpeech() {
    voiceGen.current += 1
    speaking.current = false
    voiceBusy.current = false
    voiceQueue.current = []
    nimAudio.current = false
    setVoicePlaying(false)
    setSpeakChunk('')
    stopLipSyncClock(lipClock.current)
    window.speechSynthesis?.cancel()
    try {
      if (mediaRef.current) {
        mediaRef.current.pause()
        mediaRef.current.src = ''
        mediaRef.current = null
      }
    } catch { /* ignore */ }
  }

  function splitSentences(text: string): string[] {
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (!cleaned) return []
    const parts = cleaned.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [cleaned]
    return parts.map((part) => part.trim()).filter((part) => part.length > 0)
  }

  function revealSpoken(prefix: string, chunk: string, upTo: number) {
    const slice = chunk.slice(0, Math.max(0, Math.min(chunk.length, Math.ceil(upTo))))
    const line = prefix ? `${prefix} ${slice}` : slice
    setSpoken(line.trim() || slice)
    spokenLine.current = line
  }

  /** Enqueue text as sentences — display follows TTS, not the full blob at once. */
  function voice(text: string, prefer?: string) {
    const sentences = splitSentences(text)
    if (!sentences.length) return
    const gen = ++voiceGen.current
    nimAudio.current = false
    voicePrefer.current = prefer
    voiceQueue.current = sentences
    voiceBusy.current = false
    spokenDisplay.current = ''
    spokenLine.current = ''
    setSpoken('…')
    setSpeakChunk('')
    setVoicePlaying(false)
    drainVoiceQueue(gen)
  }

  /** Push one more sentence into the live queue (streaming partner replies). */
  function voiceEnqueue(sentence: string, prefer?: string) {
    const bit = sentence.replace(/\s+/g, ' ').trim()
    if (!bit) return
    if (prefer) voicePrefer.current = prefer
    if (!voiceBusy.current && voiceQueue.current.length === 0 && !speaking.current) {
      const gen = ++voiceGen.current
      nimAudio.current = false
      voiceQueue.current = [bit]
      drainVoiceQueue(gen)
      return
    }
    voiceQueue.current.push(bit)
  }

  function drainVoiceQueue(gen: number) {
    if (voiceGen.current !== gen) return
    if (voiceBusy.current) return
    const next = voiceQueue.current.shift()
    if (!next) {
      speaking.current = false
      setVoicePlaying(false)
      setSpeakChunk('')
      stopLipSyncClock(lipClock.current)
      if (spokenDisplay.current) setSpoken(spokenDisplay.current)
      if (hearing.current) openEar()
      return
    }
    voiceBusy.current = true
    speakBrowserChunk(next, voicePrefer.current, gen)
  }

  function speakBrowserChunk(text: string, prefer?: string, gen = voiceGen.current) {
    const prefix = spokenDisplay.current
    const synth = window.speechSynthesis
    if (!synth) {
      voiceBusy.current = false
      if (voiceGen.current === gen) setVoicePlaying(false)
      openEar()
      return
    }
    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = () => {
        synth.onvoiceschanged = null
        speakBrowserChunk(text, prefer, gen)
      }
      return
    }
    speaking.current = true
    // Clip attaché au clock (ref) AVANT le TTS — zéro lag React pour la bouche
    let chunkClip: import('@atlas/voice').MayaAceClip | null = null
    const attachClip = (clip: import('@atlas/voice').MayaAceClip) => {
      if (voiceGen.current !== gen) return
      chunkClip = clip
      lipClock.current.clip = clip
      lipClock.current.text = text
      setA2fClip(clip)
    }
    void import('@atlas/voice').then(({ mayaAceClip }) => {
      attachClip(mayaAceClip(text, prefer || 'Atlas'))
    })
    const utterance = new SpeechSynthesisUtterance(text)
    const lang = speechLang(text)
    utterance.lang = lang
    // Rythme conversationnel — ni trop rapide ni monocorde
    utterance.rate = 0.94
    utterance.pitch = prefer?.toLowerCase().includes('henri') ? 0.92 : 1.02
    const picked = spokenVoice(synth, lang, prefer)
    if (picked) utterance.voice = picked
    const textLen = Math.max(1, text.length)
    // Windows ne fire souvent que des boundaries « word » → on interpolate dans le mot
    let cps = 11 * utterance.rate
    let wordStart = 0
    let wordEnd = wordEndIndex(text, 0)
    let wordStartedAt = 0
    let lastBoundaryAt = 0
    let lastChar = 0
    let startedAt = 0
    let lastRevealAt = 0
    let done = false
    let kick = 0
    let lipRaf = 0
    /** Poids de rythme dans un mot : voyelles plus longues, bilabiales plus courtes (humain). */
    const charWeight = (ch: string) => {
      if (!ch || /\s/.test(ch)) return 0.55
      if (/[mbpMBP]/.test(ch)) return 0.65
      if (/[aeiouyàâäéèêëïîôùûüœAEIOUY]/.test(ch)) return 1.35
      return 0.9
    }
    const wordWeights = () => {
      const weights: number[] = []
      let sum = 0
      for (let i = wordStart; i < wordEnd; i += 1) {
        const w = charWeight(text[i] || ' ')
        weights.push(w)
        sum += w
      }
      return { weights, sum: Math.max(0.001, sum) }
    }
    /** Curseur calé sur le mot TTS, rythme syllabique + anticipation ~90 ms. */
    const cursorAt = (now: number) => {
      let char = lastChar
      if (wordStartedAt > 0 && wordEnd > wordStart) {
        const letters = Math.max(1, wordEnd - wordStart)
        const dur = Math.max(0.08, letters / Math.max(7.2, cps))
        const u = Math.min(1, Math.max(0, (now - wordStartedAt) / 1000 / dur))
        const { weights, sum } = wordWeights()
        let target = u * sum
        let acc = 0
        char = wordEnd - 0.01
        for (let i = 0; i < weights.length; i += 1) {
          const w = weights[i]!
          if (acc + w >= target) {
            char = wordStart + i + (target - acc) / w
            break
          }
          acc += w
        }
      } else if (startedAt > 0) {
        char = ((now - startedAt) / 1000) * cps
      }
      // Anticipation : les lèvres précèdent légèrement le son
      const lead = cps * 0.09
      return Math.min(textLen - 0.01, Math.max(0, char + lead))
    }
    const lipTick = () => {
      if (done || voiceGen.current !== gen || !startedAt) return
      const now = performance.now()
      const char = cursorAt(now)
      setLipSyncProgress(lipClock.current, char / textLen, char)
      const ch = text[Math.floor(char)] || ' '
      const closed = /[mbpMBP]/.test(ch)
      const vow = /[aeiouyàâäéèêëïîôùûü]/i.test(ch)
      setLipSyncAudioLevel(lipClock.current, closed ? 0.02 : vow ? 0.4 : 0.14, 0.014)
      if (now - lastRevealAt > 60) {
        lastRevealAt = now
        // Texte affiché sans anticipation — suit l’oreille, pas la bouche
        const earChar = Math.max(0, char - cps * 0.075)
        revealSpoken(prefix, text, earChar + 1)
      }
      lipRaf = window.requestAnimationFrame(lipTick)
    }
    const finishChunk = () => {
      if (done) return
      done = true
      window.clearInterval(kick)
      window.cancelAnimationFrame(lipRaf)
      stopLipSyncClock(lipClock.current)
      spokenDisplay.current = prefix ? `${prefix} ${text}` : text
      setSpoken(spokenDisplay.current)
      setSpeakChunk('')
      voiceBusy.current = false
      if (voiceGen.current === gen) drainVoiceQueue(gen)
    }
    utterance.onboundary = (event) => {
      if (voiceGen.current !== gen || !startedAt) return
      const idx = typeof event.charIndex === 'number' ? event.charIndex : 0
      const now = performance.now()
      if (lastBoundaryAt > 0 && idx > lastChar) {
        const dt = (now - lastBoundaryAt) / 1000
        if (dt > 0.04) cps = Math.min(15, Math.max(7.5, (idx - lastChar) / dt))
      }
      lastBoundaryAt = now
      lastChar = idx
      wordStart = idx
      // charLength (si présent) = durée du mot en caractères ; sinon jusqu’au prochain séparateur
      const span = typeof event.charLength === 'number' && event.charLength > 1
        ? event.charLength
        : wordEndIndex(text, idx) - idx
      wordEnd = Math.min(textLen, idx + Math.max(1, span))
      wordStartedAt = now
      const char = cursorAt(now)
      setLipSyncProgress(lipClock.current, char / textLen, char)
      const closed = /[mbpMBP]/.test(text[idx] || '')
      const vow = /[aeiouyàâäéèêëïîôùûü]/i.test(text[idx] || '')
      setLipSyncAudioLevel(lipClock.current, closed ? 0.02 : vow ? 0.42 : 0.16, 0.02)
      if (now - lastRevealAt > 30) {
        lastRevealAt = now
        revealSpoken(prefix, text, idx + 1)
      }
    }
    utterance.onstart = () => {
      if (voiceGen.current !== gen) return
      startedAt = performance.now()
      lastBoundaryAt = startedAt
      wordStart = 0
      wordEnd = wordEndIndex(text, 0)
      wordStartedAt = startedAt
      lastChar = 0
      resetLipSyncClock(lipClock.current, textLen, text, chunkClip)
      setSpeakChunk(text)
      setVoicePlaying(true)
      revealSpoken(prefix, text, 1)
      lipRaf = window.requestAnimationFrame(lipTick)
      if (hearing.current && !earLive.current) openEar()
    }
    utterance.onend = () => { finishChunk() }
    utterance.onerror = () => { finishChunk() }
    try {
      synth.resume()
      synth.speak(utterance)
    } catch {
      finishChunk()
    }
    kick = window.setInterval(() => {
      if (voiceGen.current !== gen) {
        window.clearInterval(kick)
        return
      }
      if (synth.speaking || synth.pending) synth.resume()
    }, 400)
    window.setTimeout(() => {
      if (voiceGen.current !== gen || done) return
      if (!synth.speaking && !synth.pending) finishChunk()
    }, Math.min(28000, 1800 + text.length * 95))
  }

  function speak(text: string, prefer?: string) {
    voice(text, prefer)
  }

  function stopVoice() {
    hearing.current = false
    interruptSpeech()
    earLive.current = false
    setTalking(false)
    talkStream.current?.getTracks().forEach((track) => track.stop())
    void talkContext.current?.close()
    talkStream.current = null
    talkContext.current = null
    window.clearInterval(pulse.current)
    try { engine.current?.stop() } catch { /* déjà arrêté */ }
    engine.current = null
    setListening(false)
  }

  function startVoice() {
    hearing.current = true
    setChannel('voix')
    setListening(true)
    setHint('')
    void navigator.mediaDevices?.getUserMedia?.({ audio: true })
      .then((stream) => stream.getTracks().forEach((track) => track.stop()))
      .catch(() => { /* le réacteur redemandera le micro au moment de parler */ })
    // Ne pas appeler stopVoice() ici : ça coupait la synthèse en cours
    speak(atlasGreeting(profileName()))
  }

  async function toggleTalk() {
    if (!talking) {
      setHint('')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const context = new AudioContext()
        const source = context.createMediaStreamSource(stream)
        const gain = context.createGain()
        gain.gain.value = 0
        const processor = context.createScriptProcessor(4096, 1, 1)
        talkChunks.current = []
        processor.onaudioprocess = (event) => {
          talkChunks.current.push(new Float32Array(event.inputBuffer.getChannelData(0)))
        }
        source.connect(processor)
        processor.connect(gain)
        gain.connect(context.destination)
        talkStream.current = stream
        talkContext.current = context
        setTalking(true)
        setSpoken("I'm listening. Click the reactor again when you're done.")
      } catch {
        setSpoken('Microphone blocked. Allow mic access in the browser, then click the face.')
      }
      return
    }
    setTalking(false)
    const chunks = talkChunks.current
    const rate = talkContext.current?.sampleRate || 48000
    talkStream.current?.getTracks().forEach((track) => track.stop())
    void talkContext.current?.close()
    talkStream.current = null
    talkContext.current = null
    if (chunks.length === 0) {
      setSpoken("I didn't catch anything. Try again, or type the command.")
      return
    }
    setSpoken('Transcribing…')
    try {
      const response = await fetch('/api/atlas/hear', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audio: encodeWav(chunks, rate) }),
      })
      const body = await response.json() as { text?: string; error?: string }
      const text = body.text?.trim() ?? ''
      if (text) {
        setDraft(text)
        void pilot(text)
        return
      }
      setSpoken(body.error === 'busy'
        ? localVoiceReply('hello')
        : "I didn't catch that. Click the face and speak again.")
    } catch {
      setSpoken("I couldn't hear you. Click the face and speak again.")
    }
  }

  function chooseChannel(next: 'texte' | 'voix') {
    // Assistance uniquement vocale
    void next
    startVoice()
  }

  async function askJarvis(text: string) {
    return call<{ reply: string; organizationId: string | null }>('/v1/jarvis', {
      method: 'POST',
      body: JSON.stringify({ text, organizationId: chart?.organization.id }),
    })
  }

  function orgStudioPayload() {
    if (!chart) return null
    return buildOrgStudioContext(chart, {
      decisionsPending: decisions.filter((item) => item.status === 'pending').length,
      openTasks: counts?.openTasks,
      journal: journal.map((item) => ({ agentId: item.agentId, title: item.title, status: item.status })),
      liveTasks: (liveTasks ?? []).map((item) => ({ agentId: item.agentId, title: item.title, status: item.status })),
    })
  }

  async function directAtlas(text: string) {
    setSpoken('Thinking…')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 12000)
    try {
      const continuity = sessionBrief(sessionCtx.current)
      const response = await fetch('/api/jarvis', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          memory: [memoryBrief(10), continuity].filter(Boolean).join('\n'),
          // Toujours envoyer le studio ZTC dès qu’il y a une org : ATLAS doit tout savoir.
          studio: orgStudioPayload(),
        }),
      })
      if (!response.ok) return null
      const body = await response.json() as { reply?: string; action?: ReturnType<typeof interpretAtlas> }
      if (!body.action?.kind) return null
      return { reply: body.reply?.trim() ?? '', action: body.action }
    } catch {
      return null
    } finally {
      window.clearTimeout(timer)
    }
  }

  function findAgent(name: string) {
    const wanted = name.trim().toLowerCase()
    return chart?.agents.find((agent) => agent.firstName.toLowerCase() === wanted || `${agent.firstName} ${agent.lastName}`.toLowerCase() === wanted) ?? null
  }

  async function threadOf(agent: Agent) {
    const body = await call<{ messages: ChatMessage[] }>(`/v1/organizations/${agent.organizationId}/agents/${agent.id}/messages`)
    return body.messages ?? []
  }

  async function agentAnswer(agent: Agent, question: string, history: ChatMessage[]) {
    const lines = history.slice(-6).map((message) => `${message.authorId === agent.id ? agent.firstName : 'Dirigeant'} : ${message.body}`)
    const knowledge = documents.filter((item) => readersOf(item, knowledgeAccess).includes(agent.id)).map((item) => item.name)
    try {
      const response = await fetch('/api/atlas/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agent: profileOf(agent, knowledge),
          organization: chart?.organization.name || 'ZtcHosting',
          colleagues: (chart?.agents ?? [])
            .filter((item) => item.id !== agent.id)
            .map((item) => `${item.firstName} (${item.role})`),
          question: question
            ? `[ATLAS orchestre] ${question}`
            : question,
          history: lines,
        }),
      })
      const body = await response.json() as { reply?: string }
      return body.reply?.trim() || ''
    } catch {
      return ''
    }
  }

  async function converse(agent: Agent, question: string) {
    if (question) {
      await call(`/v1/organizations/${agent.organizationId}/agents/${agent.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ authorId: userId(), body: question }),
      })
    }
    const history = await threadOf(agent).catch(() => [] as ChatMessage[])
    const reply = await agentAnswer(agent, question, history)
    if (reply) {
      await call(`/v1/organizations/${agent.organizationId}/agents/${agent.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ authorId: agent.id, body: reply }),
      })
    }
    return reply
  }

  async function assign(agent: Agent, text: string) {
    const result = await call<{ outcome: string; reason: string }>('/v1/commands', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: agent.organizationId,
        agentId: agent.id,
        text,
        action: missionAction(agent),
        kind: 'analyze',
        amount: null,
      }),
    })
    const allowed = result.outcome === 'allowed'
    logWork({
      agentId: agent.id,
      title: text,
      status: allowed ? 'doing' : result.outcome === 'approval_required' ? 'pending' : 'denied',
    })
    if (allowed) {
      await call(`/v1/agents/${agent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ presence: 'working' }),
      }).catch(() => null)
      // Exécution temps réel avec compétences + données produit live
      void (async () => {
        try {
          const response = await fetch('/api/atlas/agent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              execute: true,
              organization: chart?.organization.name || 'ZtcHosting',
              colleagues: (chart?.agents ?? [])
                .filter((item) => item.id !== agent.id)
                .slice(0, 8)
                .map((item) => `${item.firstName} (${item.role})`),
              agent: profileOf(completeAgent(agent, chart?.departments.find((d) => d.id === agent.departmentId)?.name || '')),
              question: text,
            }),
          })
          const body = await response.json() as { reply?: string }
          const reply = body.reply?.trim()
          if (reply) {
            await call(`/v1/organizations/${agent.organizationId}/agents/${agent.id}/messages`, {
              method: 'POST',
              body: JSON.stringify({ authorId: agent.id, body: reply }),
            }).catch(() => null)
            logWork({ agentId: agent.id, title: `${text} · livré`, status: 'done' })
            pushNotice('tool', agent.firstName, reply.slice(0, 160))
          }
        } catch { /* mission déjà journalisée */ }
      })()
    }
    return allowed
      ? 'lancée — exécution en cours'
      : result.outcome === 'approval_required' ? 'en attente de votre accord' : result.reason
  }

  async function waitVoiceIdle(capMs = 48000) {
    const start = Date.now()
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    while (Date.now() - start < capMs) {
      if (!voiceBusy.current && voiceQueue.current.length === 0 && !speaking.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 280))
        if (!voiceBusy.current && voiceQueue.current.length === 0 && !speaking.current) return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 180))
    }
  }

  async function sayPitch(text: string) {
    voice(text)
    await waitVoiceIdle()
  }

  /** Submission / product video: Atlas presents itself, ZTC org, Studio sections, 3D agents, then opens the site. */
  async function runSubmissionPitch() {
    const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
    const focusAgent = (name: string) => {
      const agent = findAgent(name)
      if (!agent) return null
      setView('bureau')
      setSelectedId(agent.id)
      setTab('details')
      setOfficeFocus({ agentId: agent.id, nonce: Date.now() })
      return agent
    }
    const focusRoom = (target: string) => {
      const rooms = twin.layout.rooms
      const room = matchOfficeRoom(rooms, target)
      if (!room) return null
      setView('bureau')
      setOfficeFocus({ roomId: room.id, nonce: Date.now() })
      return room
    }

    setHint('')
    setSpoken('Starting presentation…')
    if (!chart) {
      await sayPitch('Load the ZTC Hosting organization in the Studio first, then ask me to start the submission pitch again.')
      return
    }

    await sayPitch(
      'Hello. I am Atlas, the AI operating system for organizations. I design the company, staff it with AI employees, and orchestrate their work in real time.',
    )

    setView('organigramme')
    await pause(700)
    await sayPitch(
      `${chart.organization.name || 'ZTC Hosting'} is the organization I built: a web hosting company on ztchosting.com — domains, cPanel hosting, email, billing, and AI-hosted products.`,
    )

    setView('employes')
    await pause(600)
    const highlights = ['Nova', 'Devoid', 'Vega', 'Lyra', 'Ledger', 'Radar', 'Swift', 'Funnel', 'Muse']
      .map((name) => chart.agents.find((agent) => agent.firstName.toLowerCase() === name.toLowerCase()))
      .filter(Boolean)
      .slice(0, 8)
    const roster = highlights.length
      ? highlights.map((agent) => `${agent!.firstName}, ${agent!.role}`).join('. ')
      : teamRosterLine(chart.agents, 8)
    await sayPitch(`Here is the core team. ${roster}.`)

    setView('missions')
    await pause(500)
    await sayPitch('Missions and workflows are how I assign real work — support tickets, DNS, hosting, billing, security, and growth.')

    setView('bureau')
    await pause(800)
    await sayPitch('Now the 3D desk — the live twin of ZTC Hosting. Each room is a department. I will open the key ones and show who works there.')

    const rooms: Array<{ target: string; line: string }> = [
      { target: 'Support', line: 'Support: Nova welcomes clients and routes tickets; Devoid operates the chat on ztchosting.com.' },
      { target: 'Hébergement', line: 'Hosting: Vega runs cPanel accounts, quotas, and AutoSSL within the plan sold.' },
      { target: 'Domaines', line: 'Domains and DNS: Lyra handles registration, DNS, and renewals.' },
      { target: 'Sécurité', line: 'Security: Radar scans the public surface; Cipher watches hardening — no exploits, only observed facts.' },
      { target: 'Performance', line: 'Performance: Swift measures TTFB and availability on the live site.' },
      { target: 'Flux visiteurs', line: 'Visitor flow: Funnel qualifies traffic and prospects from real sessions only.' },
    ]
    for (const step of rooms) {
      const room = focusRoom(step.target)
      await pause(room ? 900 : 400)
      await sayPitch(step.line)
    }

    const agents: Array<{ name: string; line: string }> = [
      { name: 'Nova', line: 'Nova — customer success and ticket routing for DEVOID escalations.' },
      { name: 'Vega', line: 'Vega — hosting and WHM, inside the customer plan.' },
      { name: 'Lyra', line: 'Lyra — domains and DNS.' },
      { name: 'Ledger', line: 'Ledger — FOSSBilling invoices and renewals.' },
      { name: 'Funnel', line: 'Funnel — visitor and prospect reports, never invented numbers.' },
    ]
    for (const step of agents) {
      const agent = focusAgent(step.name)
      await pause(agent ? 700 : 300)
      await sayPitch(step.line)
    }

    setView('bureau')
    await pause(500)
    await sayPitch('That is ZTC Hosting under ATLAS: orchestrated AI employees, real tools, and no invented status. Opening the public site now.')
    window.open('https://ztchosting.com/', '_blank', 'noopener,noreferrer')
    setSiri({ kind: 'web', title: 'ZTC Hosting', query: 'ztchosting.com', url: 'https://ztchosting.com/', hits: [], reply: 'Opened ztchosting.com' })
    await sayPitch('Here is ztchosting.com — the live product. Thank you.')
  }

  async function pilot(raw: string) {
    const heardRaw = raw.trim()
    interruptSpeech()
    setDraft(heardRaw)
    pushSessionTurn(sessionCtx.current, 'user', heardRaw)
    // Continuité : « dedans », « le fichier » → dernier fichier / action
    const heard = expandWithSession(heardRaw, sessionCtx.current)
    setSpoken(`Heard: ${heardRaw}`)
    // Onglet Web déjà ouvert → « ouvre dans le navigateur » ouvre vraiment le browser
    if (
      siri?.url
      && /(?:ouvre|ouvrir|lance|affiche).{0,28}(?:dans |sur )?(?:le )?(?:navigateur|chrome|edge|browser|duckduckgo|youtube|web)\b/.test(heard.toLowerCase())
    ) {
      window.open(siri.url, '_blank', 'noopener,noreferrer')
      speak('J’ouvre dans le navigateur.')
      return
    }
    // Salutations : réponse courte immédiate (pas 10 s de réflexion)
    if (/^(?:salut|bonjour|hello|bonsoir|hey|coucou)(?:\s+atlas)?[\s,!.?]*$/i.test(heard)) {
      voice(localVoiceReply(heard))
      return
    }
    const local = interpretAtlas(heard)
    if (briefingRef.current && isIntakeCancel(heard)) {
      saveBriefing(null)
      voice('J’annule le brief.')
      return
    }
    if (briefingRef.current && (local.kind === 'listen' || local.kind === 'compose')) {
      const restated = local.kind === 'compose' ? local.text : heard
      if (!nextIntakeSlot(restated)) {
        saveBriefing(null)
        const created = await generate(restated)
        if (!created) voice('Je n’ai pas pu dessiner l’organisation.')
        return
      }
      const next = absorbAnswer(briefingRef.current, heard)
      const missing = nextIntakeSlot(composeIntention(next))
      saveBriefing(next)
      setDraft(composeIntention(next))
      if (missing) {
        const question = intakeQuestion(missing)
        setHint(question)
        voice(question)
        return
      }
      saveBriefing(null)
      const created = await generate(composeIntention(next))
      if (!created) voice('Je n’ai pas pu dessiner l’organisation.')
      return
    }
    if (local.kind === 'compose') {
      const result = await beginCompose(local.text)
      if (result === 'ask' || result === true) return
      voice('Je n’ai pas pu dessiner l’organisation.')
      return
    }
    if (local.kind === 'pitch') {
      await runSubmissionPitch()
      return
    }
    const consult = shouldConsultLlm(local, heard)
    const directed = consult ? await directAtlas(heard) : null
    let action = resolveAtlasAction(heard, local, directed?.action)
    const question = /[?]|\b(pourquoi|comment|quoi|qui|quel|quelle|what|why|how|who|when|where)\b/i.test(heard)
    if (local.kind === 'listen' && action.kind === 'compose' && (question || heard.trim().length < 24)) {
      action = resolveAtlasAction(heard, local, null)
    }
    let line = consult ? directed?.reply?.trim() || '' : ''
    if (/ne (?:peux|peut) pas r[eé]pondre|extraits (?:fournis|ne contiennent)|aucune information pertinente/i.test(line)) {
      line = ''
      if (action.kind === 'listen' || action.kind === 'answer') action = { kind: 'search', query: webQuery(heard) || heard }
    }
    // Superviseur : jamais laisser le LLM nier l’accès au bureau / aux agents
    if (/ne (?:peux|peut) pas voir|aucun acc[eè]s (?:à |au |a )?(?:ton |votre |l['’])?(?:bureau|agent|[eé]cran|appli)|regarde directement (?:dans |la )?vue 3d/i.test(line)
      || (/bureau|agents?|employ[eé]s?/.test(heard) && /ne (?:peux|peut) pas|pas d['’]acc[eè]s|je n['’]ai pas/i.test(line))) {
      line = ''
      if (chart) action = { kind: 'brief' }
    }
    if ((action.kind === 'listen' || action.kind === 'answer') && chart
      && /que (?:font|fait)|(?:mes|les) agents?|bureau\s*3d|qui travaille|statut.{0,20}agents?/i.test(heard)) {
      action = { kind: 'brief' }
      line = ''
    }
    const asking = /[?]|\b(pourquoi|comment|quoi|quel|quelle|aide|besoin|conseil|id[eé]e|vendre|produit)\b/i.test(heard)
    if ((action.kind === 'listen' || action.kind === 'answer') && !line && asking && heard.trim().length > 12) {
      action = { kind: 'search', query: webQuery(heard) || heard }
    }
    function speak(fallback: string, opts?: { real?: boolean }) {
      // `real` = résultat d’outil / état réel — ne jamais laisser une phrase LLM inventée l’écraser
      const said = opts?.real ? fallback : (line || fallback)
      pushSessionTurn(sessionCtx.current, 'atlas', said)
      voice(said)
    }
    // Dès qu’on a une action exécutable, on ignore les « j’ai déjà fait » hallucinés du LLM
    if (action.kind === 'invoke' || action.kind === 'mail' || action.kind === 'connect' || action.kind === 'install') {
      line = ''
    }
    setHint('')
    if (action.kind === 'listen') {
      speak(line || localVoiceReply(heardRaw))
      return
    }
    if (action.kind === 'clear_org') {
      const had = Boolean(chart)
      setChart(null)
      setSelectedId(null)
      setSteps([])
      setDecisions([])
      setView('organigramme')
      try {
        window.localStorage.removeItem('atlas-organization')
      } catch { /* ignore */ }
      speak(line || (had
        ? 'Organigramme supprimé. On repart de zéro — décrivez la suite quand vous voulez.'
        : 'Il n’y avait pas d’organigramme à supprimer. Dites-moi ce que vous voulez faire.'))
      return
    }
    if (action.kind === 'answer') {
      interruptSpeech()
      spokenDisplay.current = ''
      setSpoken(line || 'Thinking…')
      try {
        const ask = action.text || raw
        // N'injecte le studio que si la demande parle vraiment de l'orga / marque
        const wantsStudio = /\b(?:marque|studio|organi|entreprise|d[eé]partement|employ|agent|bureau|mission|workflow|[eé]quipe|coll[eè]gue|notre\b|nos\b|projet|supervis)\b/i.test(ask)
        const response = await fetch('/api/atlas/partner', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'answer',
            text: ask,
            memory: memoryBrief(8),
            studio: chart && wantsStudio
              ? JSON.stringify(orgStudioPayload())
              : '',
            stream: true,
          }),
        })
        if (!response.ok || !response.body) {
          speak(line || "I'm listening — rephrase what you want.")
          return
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let full = ''
        let heardSentence = false
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const chunks = buf.split('\n')
          buf = chunks.pop() ?? ''
          for (const row of chunks) {
            const trimmed = row.trim()
            if (!trimmed.startsWith('data:')) continue
            try {
              const payload = JSON.parse(trimmed.slice(5).trim()) as {
                delta?: string
                sentence?: string
                done?: boolean
                reply?: string
              }
              if (payload.delta) {
                full += payload.delta
                // Ne pas afficher tout le texte d’un coup — le TTS révèle phrase par phrase
                if (!heardSentence && !voiceBusy.current) setSpoken('Thinking…')
              }
              if (payload.sentence) {
                heardSentence = true
                voiceEnqueue(payload.sentence)
              }
              if (payload.done && payload.reply && !heardSentence) {
                speak(payload.reply.trim() || line || "I'm listening.")
              }
            } catch { /* partial SSE */ }
          }
        }
        if (!heardSentence && !full.trim()) {
          speak(line || "I'm working on your request. Rephrase in one sentence if needed.")
        }
      } catch {
        speak(line || "I'm working on your request. Rephrase in one sentence if needed.")
      }
      return
    }
    if (action.kind === 'remember') {
      const fact = rememberFact({ value: action.text })
      speak(line || `Got it. I'll remember: ${fact.value}`)
      return
    }
    if (action.kind === 'forget') {
      const removed = forgetFact(action.query)
      speak(line || (removed.length
        ? `J’oublie ${removed.length} souvenir${removed.length > 1 ? 's' : ''}.`
        : 'Je ne trouve pas ce souvenir. Précisez la clé ou dites « oublie tout ».'))
      return
    }
    if (action.kind === 'recall') {
      speak(line || memorySpokenSummary())
      return
    }
    if (action.kind === 'correct_memory') {
      correctFact(action.key, action.value)
      speak(line || `Corrigé : ${action.value}`)
      return
    }
    if (action.kind === 'extract' || action.kind === 'transform') {
      const label = action.kind === 'extract' ? 'Extraction' : 'Transformation'
      setSpoken(line || `${label} en cours…`)
      try {
        const fileHint = (action.source || sessionCtx.current.lastFile || '').trim()
        const inline = extractInlineSource(action.ask)
        let sourceText = inline || ''
        let sourceLabel = fileHint || 'texte collé'

        if (fileHint && !inline) {
          let live = linked('filesystem')
          if (!live) {
            const connected = await connectProvider('filesystem')
            if (connected.ok) {
              const nextLinks = await refreshLinks()
              live = nextLinks.find((item) => item.provider === 'filesystem' && item.status === 'connected') ?? null
            }
          }
          if (!live) {
            setView('integrations')
            speak('Reliez l’ordinateur (fichiers) dans Intégrations, puis redemandez l’extraction ou la transformation.')
            return
          }
          const readBody = await invokeTool(
            'filesystem',
            'read_document',
            JSON.stringify({ title: fileHint, folder: sessionCtx.current.lastFolder || 'documents' }),
          )
          if (!readBody.ok || typeof readBody.result !== 'string') {
            speak(readBody.error || `Je n’ai pas trouvé le fichier « ${fileHint} ». Nommez-le ou collez le texte.`)
            return
          }
          try {
            const parsed = JSON.parse(readBody.result) as { text?: string; title?: string; path?: string }
            sourceText = String(parsed.text || '').trim()
            sourceLabel = parsed.title || fileHint
            rememberSessionAction(sessionCtx.current, {
              kind: 'invoke',
              provider: 'filesystem',
              tool: 'read_document',
              input: JSON.stringify({ title: fileHint }),
            }, `Lu ${sourceLabel}`)
          } catch {
            sourceText = readBody.result.trim()
          }
          if (!sourceText) {
            speak(`Le fichier « ${sourceLabel} » est vide.`)
            return
          }
        }

        if (!sourceText.trim()) {
          speak(action.kind === 'extract'
            ? 'Indiquez le fichier source (ex. « extrais les dates du fichier Orelle ») ou collez le texte.'
            : 'Indiquez le fichier à transformer ou collez le texte (ex. « reformule Brief en markdown »).')
          return
        }

        const response = await fetch('/api/atlas/partner', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: action.kind,
            text: action.ask,
            focus: action.kind === 'extract' ? action.focus : undefined,
            op: action.kind === 'transform' ? action.op : undefined,
            source: sourceText,
            memory: memoryBrief(6),
          }),
        })
        const body = await response.json() as { reply?: string }
        const reply = body.reply?.trim() || line || 'Je n’ai rien pu en tirer. Reformulez la demande.'
        setSiri({
          kind: 'web',
          title: `${label} · ${sourceLabel}`,
          query: action.ask,
          url: webSearchUrl(action.ask),
          hits: [],
          reply,
        })

        const saveAs = (action.saveAs || '').trim()
        if (saveAs && reply) {
          const ext = action.kind === 'transform' ? transformFileExt(action.op) : 'txt'
          const title = /\.(txt|md|csv|json|html)$/i.test(saveAs) ? saveAs : `${saveAs}.${ext}`
          let live = linked('filesystem')
          if (!live) {
            const connected = await connectProvider('filesystem')
            if (connected.ok) {
              const nextLinks = await refreshLinks()
              live = nextLinks.find((item) => item.provider === 'filesystem' && item.status === 'connected') ?? null
            }
          }
          if (live) {
            const saved = await invokeTool(
              'filesystem',
              'create_document',
              JSON.stringify({ title, body: reply, open: true, ext }),
            )
            if (saved.ok) {
              rememberSessionAction(sessionCtx.current, {
                kind: 'invoke',
                provider: 'filesystem',
                tool: 'create_document',
                input: JSON.stringify({ title: saveAs.replace(/\.(txt|md|csv|json|html)$/i, ''), body: reply }),
              }, typeof saved.result === 'string' ? saved.result : undefined)
              speak(`${reply.slice(0, 900)}\n\nRésultat enregistré dans « ${title} ».`, { real: true })
              return
            }
          }
        }

        speak(reply, { real: true })
      } catch {
        speak(line || 'Je n’ai pas pu traiter ce document. Réessayez dans un instant.')
      }
      return
    }
    if (action.kind === 'image') {
      setSpoken(line || 'Generating the image…')
      try {
        const response = await fetch('/api/atlas/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'image',
            prompt: action.prompt,
            title: action.title,
            open: true,
          }),
        })
        const body = await response.json() as {
          ok?: boolean
          error?: string
          summary?: string
          title?: string
          preview?: string
          path?: string
        }
        if (!body.ok) {
          speak(body.error || 'Je n’ai pas pu générer l’image. Réessayez.')
          return
        }
        setSiri({
          kind: 'web',
          title: `Image · ${body.title || 'ATLAS'}`,
          query: action.prompt,
          url: body.path || webSearchUrl(action.prompt),
          hits: [],
          reply: body.summary || 'Image prête.',
        })
        rememberSessionAction(sessionCtx.current, {
          kind: 'invoke',
          provider: 'filesystem',
          tool: 'create_document',
          input: JSON.stringify({ title: (body.title || 'atlas-image').replace(/\.png$/i, '') }),
        }, body.summary)
        speak(body.summary || `Image enregistrée : ${body.title}`, { real: true })
      } catch {
        speak(line || 'Génération d’image indisponible pour le moment.')
      }
      return
    }
    if (action.kind === 'film') {
      setSpoken(line || 'Shooting the film…')
      try {
        const response = await fetch('/api/atlas/film', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: action.prompt,
            title: action.title,
            open: true,
          }),
        })
        const body = await response.json() as {
          ok?: boolean
          error?: string
          summary?: string
          title?: string
          path?: string
        }
        if (!body.ok) {
          speak(body.error || 'Je n’ai pas pu tourner le film.')
          return
        }
        setSiri({
          kind: 'web',
          title: `Film · ${body.title || 'ATLAS'}`,
          query: action.prompt,
          url: body.path || webSearchUrl(action.prompt),
          hits: [],
          reply: body.summary || 'Film prêt.',
        })
        speak(body.summary || `Film enregistré : ${body.title}`, { real: true })
      } catch {
        speak(line || 'Génération vidéo indisponible pour le moment.')
      }
      return
    }
    if (action.kind === 'draft' && action.format === 'website') {
      setSpoken(line || 'Building a styled site…')
      try {
        const created = await fetch('/api/atlas/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'website', topic: action.topic, open: true }),
        })
        const site = await created.json() as {
          ok?: boolean
          summary?: string
          title?: string
          brand?: string
          theme?: string
          error?: string
          path?: string
        }
        if (site.ok && site.summary) {
          rememberSessionAction(sessionCtx.current, {
            kind: 'invoke',
            provider: 'filesystem',
            tool: 'create_document',
            input: JSON.stringify({ title: (site.title || site.brand || 'Site').replace(/\.html$/i, '') }),
          }, site.summary)
          setSiri({
            kind: 'web',
            title: site.brand || 'Site web',
            query: action.topic,
            url: site.path ? `file:///${site.path.replace(/\\/g, '/')}` : webSearchUrl(action.topic),
            hits: [],
            reply: site.summary,
          })
          speak(site.summary, { real: true })
          return
        }
        speak(`Je n’ai pas pu générer le site : ${site.error || 'erreur inconnue'}.`)
      } catch {
        speak('Génération du site indisponible pour le moment.')
      }
      return
    }
    if (action.kind === 'teach' || action.kind === 'code' || action.kind === 'draft') {
      setSpoken(line || 'Preparing that…')
      try {
        const response = await fetch('/api/atlas/partner', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: action.kind === 'teach' ? 'teach' : action.kind === 'code' ? 'code' : 'draft',
            text: action.kind === 'teach' ? action.topic : action.kind === 'code' ? action.text : action.topic,
            topic: action.kind === 'teach' || action.kind === 'draft' ? ('topic' in action ? action.topic : undefined) : undefined,
            style: action.kind === 'teach' ? action.style : undefined,
            intent: action.kind === 'code' ? action.intent : undefined,
            format: action.kind === 'draft' ? action.format : undefined,
            memory: memoryBrief(8),
          }),
        })
        const body = await response.json() as { reply?: string }
        const reply = body.reply?.trim() || line || 'Reformulez le sujet, je continue.'
        if (action.kind === 'draft') {
          setSiri({ kind: 'web', title: 'Brouillon', query: action.topic, url: webSearchUrl(action.topic), hits: [], reply })
          if (action.format === 'presentation') {
            try {
              const created = await fetch('/api/atlas/create', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  kind: 'presentation',
                  topic: action.topic,
                  outline: reply,
                  open: true,
                }),
              })
              const pptx = await created.json() as { ok?: boolean; summary?: string; title?: string; error?: string }
              if (pptx.ok && pptx.summary) {
                rememberSessionAction(sessionCtx.current, {
                  kind: 'invoke',
                  provider: 'filesystem',
                  tool: 'create_document',
                  input: JSON.stringify({ title: (pptx.title || 'Presentation').replace(/\.pptx$/i, '') }),
                }, pptx.summary)
                speak(`${reply.replace(/\{[\s\S]*\}/, '').trim().slice(0, 400)}\n\n${pptx.summary}`, { real: true })
                return
              }
              speak(`${reply}\n\n(Fichier PowerPoint : ${pptx.error || 'non créé'})`)
              return
            } catch {
              /* garde le brouillon oral */
            }
          }
        }
        speak(reply)
      } catch {
        speak(line || 'Je n’ai pas pu préparer cette réponse. Réessayez dans un instant.')
      }
      return
    }
    if (action.kind === 'research') {
      const topic = webQuery(action.query).trim() || action.query.trim() || heard
      const mode = action.mode || researchModeOf(topic)
      const url = webSearchUrl(topic)
      setSiri({ kind: 'web', title: `Recherche · ${mode}`, query: topic, url, hits: [], reply: 'Searching…' })
      setSpoken('Searching…')
      try {
        const response = await fetch('/api/atlas/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: topic,
            mode,
            memory: memoryBrief(6),
            organization: chart?.organization.name,
            intention: chart?.organization.intention ?? chart?.organization.objective,
            roles: (chart?.agents ?? []).slice(0, 6).map((agent) => `${agent.role}`),
          }),
        })
        const body = await response.json() as { reply?: string; sources?: Array<{ title: string; extract?: string; url?: string }> }
        const hits = (body.sources ?? []).map((item) => ({
          title: item.title,
          extract: item.extract ?? '',
          url: item.url || webSearchUrl(item.title),
        }))
        const reply = body.reply?.trim() || line || `Voici ce que je retiens pour ${topic}.`
        setSiri({ kind: 'web', title: `Recherche · ${mode}`, query: topic, url, hits, reply })
        speak(reply)
      } catch {
        const fallback = line || `Voici les résultats pour ${topic} dans l’onglet Web. Cliquez Ouvrir pour le navigateur.`
        setSiri({ kind: 'web', title: `Recherche · ${mode}`, query: topic, url, hits: [], reply: fallback })
        speak(fallback)
      }
      return
    }
    if (action.kind === 'mode') {
      setAdvanced(action.advanced)
      speak(action.advanced ? 'Mode avancé activé.' : 'Mode simple activé.')
      return
    }
    if (action.kind === 'home') {
      setChart(null)
      setSelectedId(null)
      setView('organigramme')
      speak('Retour à l’accueil du studio.')
      return
    }
    if (action.kind === 'import') {
      fileRef.current?.click()
      speak('Choisissez le fichier qui décrit l’organisation.')
      return
    }
    if (action.kind === 'orchestrate') {
      if (!officeOrg) {
        speak('Créez d’abord une organisation, je pourrai ensuite orchestrer ses opérations.')
        return
      }
      const wanted = twin.ops.atlas.actions.filter((item: OpsAction) => (action.scope === 'all' || item.kind === action.scope) && !twin.runs[item.id])
      setView(action.scope === 'relance' || action.scope === 'envoi' ? 'factures' : 'bureau')
      const firstRoom = wanted.find((item) => item.roomId)?.roomId
      if (firstRoom) setOfficeFocus({ roomId: firstRoom, nonce: Date.now() })
      if (!wanted.length) {
        // Pas d’actions atlas : mobiliser quand même les agents présents dans le bureau
        const staff = (chart?.agents ?? []).slice(0, 6)
        if (staff.length && action.scope === 'all') {
          const lines: string[] = []
          for (const agent of staff) {
            const status = await assign(agent, `Point de supervision ATLAS : avance sur ton périmètre (${agent.role}) et rapporte les preuves live.`).catch(() => 'non transmise')
            lines.push(`${agent.firstName} : ${status}`)
          }
          speak(`Bureau ouvert. ${lines.join('. ')}.`)
          return
        }
        speak('Tout est déjà pris en charge de ce côté. Ouvrez une salle — dites « ouvre la salle Sécurité ».')
        return
      }
      setSpoken(`J’orchestre ${wanted.length} action${wanted.length > 1 ? 's' : ''} dans le bureau…`)
      const notes = await twin.runMany(wanted)
      speak(`${notes.join('. ')}.`)
      return
    }
    if (action.kind === 'room') {
      if (!officeOrg) {
        speak('Le Bureau 3D n’est pas encore monté. Composez d’abord l’organisation ZTC.')
        return
      }
      setView('bureau')
      const room = matchOfficeRoom(twin.layout.rooms, action.target)
      if (!room) {
        const known = twin.layout.rooms.slice(0, 8).map((item) => item.name).join(', ')
        speak(`Je ne trouve pas la salle « ${action.target} ». Zones : ${known}.`)
        return
      }
      setOfficeFocus({ roomId: room.id, nonce: Date.now() })
      const layoutIds = twin.layout.agents.filter((agent) => agent.roomId === room.id).map((agent) => agent.id)
      const staff = agentsInRoom(chart?.agents ?? [], room, layoutIds)
      if (!staff.length) {
        speak(`${room.name} est ouvert(e), mais aucun agent n’y est posté pour l’instant.`)
        return
      }
      if (action.mission) {
        const lines: string[] = []
        for (const agent of staff) {
          const status = await assign(agent, action.mission).catch(() => 'non transmise')
          lines.push(`${agent.firstName} : ${status}`)
        }
        if (chart) await loadOps(chart.organization.id)
        speak(`${room.name} — j’y pilote ${staff.length} agent${staff.length > 1 ? 's' : ''}. ${lines.join('. ')}.`)
        return
      }
      const workLines = staff.map((agent) => {
        const jobs = officeControl.work(agent.id).slice(0, 2)
        const job = jobs.length ? ` · ${jobs.map((item) => item.title).join(', ')}` : ''
        return `${agent.firstName} (${agent.role})${job}`
      })
      speak(`${room.name} : ${workLines.join('. ')}. Dites « demande à toute la salle ${room.name} de… » pour les faire travailler.`)
      return
    }
    if (action.kind === 'pitch') {
      await runSubmissionPitch()
      return
    }
    if (action.kind === 'navigate') {
      setView(action.view)
      speak(`J’ouvre ${viewLabel(action.view)}.`)
      return
    }
    if (action.kind === 'template') {
      const item = TEMPLATES.find((entry) => entry.title === action.title)
      if (!item) return
      setView('organigramme')
      const created = await generate(item.text)
      if (!created) speak('Le modèle n’a pas pu être activé.')
      return
    }
    if (action.kind === 'compose') {
      const result = await beginCompose(action.text)
      if (result === 'ask' || result === true) return
      speak('Je n’ai pas pu dessiner l’organisation.')
      return
    }
    if (action.kind === 'videos') {
      const topic = action.query.trim() || 'votre recherche'
      const url = youtubeSearchUrl(action.query)
      setSiri({ kind: 'videos', title: 'YouTube', query: topic, url, clips: [] })
      speak(`Voici YouTube pour ${topic}. Cliquez Ouvrir pour le navigateur.`)
      void fetch('/api/atlas/videos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: action.query }),
      })
        .then((response) => response.json() as Promise<{ videos?: Array<{ id: string; title: string; url: string; thumb: string }> }>)
        .then((body) => {
          setSiri((current) => current?.kind === 'videos' ? { ...current, clips: body.videos ?? [] } : current)
        })
        .catch(() => {})
      return
    }
    if (action.kind === 'search') {
      const topic = webQuery(action.query).trim() || action.query.trim() || heard
      const url = webSearchUrl(topic)
      setSiri({ kind: 'web', title: 'Web', query: topic, url, hits: [], reply: 'Searching…' })
      setSpoken('Searching…')
      try {
        const response = await fetch('/api/atlas/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: chart ? `${topic} ${chart.organization.name} ${chart.organization.intention ?? ''}`.trim() : topic,
            organization: chart?.organization.name,
            intention: chart?.organization.intention ?? chart?.organization.objective,
            roles: (chart?.agents ?? []).slice(0, 6).map((agent) => `${agent.role}`),
          }),
        })
        const body = await response.json() as { reply?: string; sources?: Array<{ title: string; extract?: string; url?: string } | string> }
        const hits = (body.sources ?? []).map((item) => typeof item === 'string'
          ? { title: item, extract: '', url: webSearchUrl(item) }
          : { title: item.title, extract: item.extract ?? '', url: item.url || webSearchUrl(item.title) })
          .filter((hit) => !/série télévisée|serie televisee|\bmusicien\b|the office|prince \(musician\)|homonymie/i.test(`${hit.title} ${hit.extract}`))
        const reply = body.reply?.trim() || `Voici ce que je retiens pour ${topic}.`
        setSiri({ kind: 'web', title: 'Web', query: topic, url, hits, reply })
        if (wantsAdoption(heard) && chart) {
          const organizationId = chart.organization.id
          setProcedure(reply)
          setView('workflows')
          setHint('J’adopte l’offre dans un workflow.')
          let stepsLine = ''
          const ok = await run(async () => {
            const swarm = await call<{ steps: Array<{ role: string; task: string }> }>(`/v1/organizations/${organizationId}/swarm`, {
              method: 'POST',
              body: JSON.stringify({ mission: `Adopter l’offre retenue pour ${chart.organization.name}. ${reply.slice(0, 280)}` }),
            })
            setSteps(swarm.steps ?? [])
            stepsLine = (swarm.steps ?? []).slice(0, 3).map((step) => `${step.role} : ${step.task}`).join(' ')
          })
          speak(ok ? `${reply} Je répartis l’adoption dans un workflow. ${stepsLine}` : reply)
        } else {
          speak(reply)
        }
      } catch {
        const fallback = chart
          ? `Pour ${chart.organization.name}, je retiens trois offres : pack d’acquisition, gestion récurrente des canaux, et audit 90 jours.`
          : `Voici les résultats pour ${topic} dans l’onglet Web. Cliquez Ouvrir pour le navigateur.`
        setSiri({ kind: 'web', title: 'Web', query: topic, url, hits: [], reply: fallback })
        if (wantsAdoption(heard) && chart) {
          setProcedure(fallback)
          setView('workflows')
        }
        speak(fallback)
      }
      return
    }
    if (action.kind === 'mail') {
      setFocusTool(action.provider)
      setView('integrations')
      const live = linked(action.provider)
      if (live) {
        const tool = live.tools.find((item) => /list_messages|list|read|search/i.test(item.name))?.name || live.tools[0]?.name || 'list_messages'
        const body = await invokeTool(action.provider, tool, heard, false)
        speak(body.result || body.error || `Je consulte ${action.label}.`)
        return
      }
      setSiri({
        kind: 'mail',
        title: action.label,
        query: action.label,
        url: action.provider === 'outlook' ? 'https://outlook.live.com' : 'https://mail.google.com',
      })
      speak(`${action.label} n’est pas encore relié. Cliquez Relier dans Intégrations, autorisez l’accès, puis revenez. Je n’invente aucun message.`)
      return
    }
    if (action.kind === 'connect') {
      setFocusTool(action.provider)
      setView('integrations')
      const body = await connectProvider(action.provider)
      speak(
        body.ok
          ? `${connectorLabel(action.provider)} est connecté.`
          : ('setup' in body && body.setup)
            ? `Complétez la configuration de ${connectorLabel(action.provider)} dans Intégrations (clé, OAuth ou URL MCP), puis Relier.`
            : 'Cliquez Relier, autorisez l’accès, puis revenez dans ATLAS.',
      )
      return
    }
    if (action.kind === 'invoke') {
      setFocusTool(action.provider)
      let live = linked(action.provider)
      if (!live && (action.provider === 'machine' || action.provider === 'filesystem' || action.provider === 'browser')) {
        const body = await connectProvider(action.provider)
        if (body.ok) {
          const nextLinks = await refreshLinks()
          live = nextLinks.find((item) => item.provider === action.provider && item.status === 'connected') ?? null
        }
      }
      if (!live) {
        setView('integrations')
        speak(`${action.provider === 'machine' || action.provider === 'filesystem' ? 'Ordinateur' : action.provider} n’est pas relié. Cliquez Relier dans Intégrations, ensuite j’exécute l’action.`)
        return
      }
      // Outils disque/PC : forcer le nom exact (évite un vieux catalogue sans write_document)
      const forced = /^(create_document|write_document|read_document|open_file|list_files|open_folder|open_app|control_app|list_apps)$/i.test(action.tool)
        ? action.tool
        : null
      const want = action.tool.toLowerCase()
      const tool = forced
        || live.tools.find((item) => item.name.toLowerCase() === want)?.name
        || live.tools.find((item) => item.name.toLowerCase().includes(want))?.name
        || (/prepare_reply|reply_email|send_email/i.test(action.tool) ? action.tool : null)
        || live.tools[0]?.name
        || action.tool
      const body = await invokeTool(action.provider, tool, action.input)
      if (body.requiresApproval) {
        speak(body.preview
          ? `${body.preview}. Tu confirmes ? Dis « approuve » ou valide dans Approbations.`
          : 'Cette écriture attend votre accord. Dis « approuve » ou ouvre Approbations.', { real: true })
        return
      }
      if (body.ok) {
        rememberSessionAction(sessionCtx.current, {
          kind: 'invoke',
          provider: action.provider,
          tool,
          input: action.input,
        }, typeof body.result === 'string' ? body.result : undefined)
      }
      if (body.ok && /prepare_reply/i.test(tool) && typeof body.result === 'string') {
        try {
          const parsed = JSON.parse(body.result) as {
            from?: string
            subject?: string
            body?: string
            draft?: {
              to?: string
              subject?: string
              body?: string
              threadId?: string
              inReplyTo?: string
              references?: string
              messageId?: string
            }
          }
          if (parsed.draft?.to && parsed.draft.body) {
            const draftInput = JSON.stringify(parsed.draft)
            const preview = `Répondre à ${parsed.draft.to} — « ${parsed.draft.subject || 'Re: …'} »`
            setToolAsks((current) => [{
              id: `${Date.now()}`,
              provider: action.provider,
              tool: 'reply_email',
              input: draftInput,
              preview,
            }, ...current])
            setView('approbations')
            pushNotice('approval', 'Réponse prête à envoyer', preview)
            const excerpt = parsed.draft.body.replace(/\s+/g, ' ').trim().slice(0, 220)
            const who = parsed.from || parsed.draft.to
            speak(
              `J’ai lu le mail${who ? ` de ${who}` : ''}${parsed.subject ? ` — « ${parsed.subject} »` : ''}. `
              + `Voici la réponse proposée : ${excerpt}. `
              + 'Dis « approuve » pour l’envoyer, ou « refuse » pour annuler.',
            )
            return
          }
        } catch {
          /* résultat non JSON : on lit tel quel */
        }
      }
      speak(body.result || body.error || 'Action envoyée.', { real: true })
      return
    }
    if (action.kind === 'install') {
      if (action.provider) {
        setFocusTool(action.provider)
        setView('integrations')
      }
      setSiri({ kind: 'app', title: action.name, query: action.name, url: action.url })
      window.open(action.url, '_blank', 'noopener,noreferrer')
      speak(action.provider
        ? `J’ouvre ${action.name}. L’outil du catalogue n’est pas encore relié à Atlas : je n’installe rien en silence sur Windows.`
        : `J’ouvre la page pour ${action.name}. Je ne l’installe pas toute seule sur votre ordinateur.`)
      return
    }
    if (action.kind === 'tools') {
      setView('integrations')
      const linkedLabels = connectors.slice(0, 4).map((item) => item.label)
      const live = links.filter((item) => item.status === 'connected')
      const line = live.length
        ? `${live.length} outil${live.length > 1 ? 's' : ''} connecté${live.length > 1 ? 's' : ''} : ${live.map((item) => connectorLabel(item.provider)).join(', ')}.`
        : (linkedLabels.length ? `${linkedLabels.join(', ')} sont prêts à relier.` : 'Aucun outil n’est relié.')
      speak(`${line} Cliquez Relier, autorisez, c’est tout.`)
      return
    }
    if (action.kind === 'post') {
      setSiri({ kind: 'post', title: action.channel, query: action.channel, url: webSearchUrl(`${action.channel} ${action.text}`), reply: action.text })
      if (!chart) {
        speak(`Je prépare un post pour ${action.channel}. Dessinez d’abord l’organisation, un employé pourra le porter. ${action.channel} n’est pas relié, je ne publie rien en ligne.`)
        return
      }
      const organizationId = chart.organization.id
      setProcedure(action.text)
      setView('workflows')
      let line = ''
      const ok = await run(async () => {
        const body = await call<{ steps: Array<{ role: string; task: string }> }>(`/v1/organizations/${organizationId}/swarm`, {
          method: 'POST',
          body: JSON.stringify({ mission: `Publier sur ${action.channel} : ${action.text}` }),
        })
        setSteps(body.steps ?? [])
        line = (body.steps ?? []).slice(0, 3).map((step) => `${step.role} : ${step.task}`).join(' ')
      })
      speak(ok
        ? `Le post ${action.channel} est dans un workflow. ${line || ''} ${action.channel} n’est pas relié : rien n’est publié tant que l’outil n’est pas connecté.`
        : `Je garde le texte du post. ${action.channel} n’est pas relié.`)
      return
    }
    if (!chart && action.kind !== 'brief') {
      // Ne bloque plus : toute demande hors studio → réponse partenaire
      setSpoken(line || 'On it…')
      try {
        const response = await fetch('/api/atlas/partner', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'answer',
            text: raw,
            memory: memoryBrief(8),
          }),
        })
        const body = await response.json() as { reply?: string }
        speak(body.reply?.trim() || line || 'Je peux vous aider sans organigramme. Dites ce que vous voulez.')
      } catch {
        speak(line || 'Je peux vous aider sans organigramme. Décrivez votre besoin.')
      }
      return
    }
    if (action.kind === 'brief' || action.kind === 'team' || action.kind === 'tasks' || action.kind === 'load') {
      const wantsBureau = /bureau|3d|salle|agents?.{0,30}(?:font|fait|travaill)/i.test(raw)
      const viewFor: Partial<Record<typeof action.kind, View>> = {
        brief: wantsBureau ? 'bureau' : 'observabilite',
        team: 'employes',
        tasks: 'missions',
        load: 'observabilite',
      }
      setView(viewFor[action.kind] ?? 'organigramme')
      if (action.kind === 'team') {
        speak(teamRosterLine(chart?.agents ?? []), { real: true })
      } else if (action.kind === 'tasks') {
        const open = journal.filter((item) => item.status === 'sent' || item.status === 'doing' || item.status === 'pending')
        const byAgent = open.slice(0, 8).map((item) => {
          const who = chart?.agents.find((agent) => agent.id === item.agentId)
          return `${who?.firstName ?? 'Agent'} : ${item.title}`
        })
        speak(byAgent.length
          ? `${byAgent.join('. ')}.${counts ? ` Total ouvert : ${counts.openTasks}.` : ''}`
          : (counts ? `${counts.openTasks} tâches ouvertes.` : 'Aucune tâche en cours. Je peux en confier une — dites « demande à Nova de… ».'), { real: true })
      } else if (action.kind === 'load') {
        speak('J’ouvre l’observabilité pour surveiller la charge de l’équipe.', { real: true })
      } else if (chart) {
        const pending = decisions.filter((item) => item.status === 'pending')
        speak(buildOrgSupervisorBrief(chart, {
          decisionsPending: pending.length,
          alerts,
          journal: journal.map((item) => ({ agentId: item.agentId, title: item.title, status: item.status })),
          liveTasks: (liveTasks ?? []).map((item) => ({ agentId: item.agentId, title: item.title, status: item.status })),
        }), { real: true })
        if (pending.length && !wantsBureau) setView('approbations')
      } else {
        speak('Aucune organisation n’est encore composée. Dites-moi de monter l’équipe ZTC Hosting.', { real: true })
      }
      return
    }
    if (action.kind === 'knowledge') {
      setView('connaissances')
      const names = documents.map((item) => item.name)
      let closest: string[] = []
      try {
        const ranked = await fetch('/api/atlas/retrieve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: action.question, documents: names }),
        })
        const body = await ranked.json() as { documents?: string[] }
        closest = body.documents ?? []
      } catch { /* le dossier reste lisible sans le retriever */ }
      try {
        const result = await call<{ reply: string }>('/v1/memory/ask', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: chart!.organization.id,
            question: closest.length ? `${action.question}\nDocuments proches : ${closest.join(', ')}` : action.question,
          }),
        })
        speak(result.reply)
      } catch {
        speak(closest.length
          ? `Les documents les plus proches sont ${closest.join(', ')}.`
          : names.length
            ? `Le dossier contient ${names.join(', ')}.`
            : 'Le dossier est encore vide. Déposez un document dans Connaissances.')
      }
      return
    }
    if (action.kind === 'approve' || action.kind === 'reject') {
      const status = action.kind === 'approve' ? 'approved' : 'rejected'
      const toolAsk = toolAsks[0]
      if (toolAsk && action.kind === 'approve') {
        setView('approbations')
        const body = await invokeTool(toolAsk.provider, toolAsk.tool, toolAsk.input, true)
        setToolAsks((current) => current.filter((item) => item.id !== toolAsk.id))
        if (body.ok) {
          rememberSessionAction(sessionCtx.current, {
            kind: 'invoke',
            provider: toolAsk.provider,
            tool: toolAsk.tool,
            input: toolAsk.input,
          }, typeof body.result === 'string' ? body.result : undefined)
        }
        speak(body.result || body.error || 'Action outil exécutée.')
        return
      }
      if (toolAsk && action.kind === 'reject') {
        setToolAsks((current) => current.filter((item) => item.id !== toolAsk.id))
        setView('approbations')
        speak(`Action annulée : ${toolAsk.preview}.`)
        return
      }
      const item = decisions.find((decision) => decision.status === 'pending')
      setView('approbations')
      if (!item || !chart) {
        speak('Aucune décision en attente.')
        return
      }
      const ok = await run(async () => {
        await call(`/v1/approvals/${item.id}`, { method: 'POST', body: JSON.stringify({ status }) })
      })
      speak(ok
        ? (status === 'approved' ? `Décision approuvée : ${item.title}.` : `Décision refusée : ${item.title}.`)
        : 'Je n’ai pas pu traiter cette décision.')
      return
    }
    if (action.kind === 'department') {
      const ok = await run(async () => {
        await call('/v1/departments', {
          method: 'POST',
          body: JSON.stringify({ organizationId: chart!.organization.id, name: action.name }),
        })
      })
      if (ok) setView('organigramme')
      speak(ok ? `Département ${action.name} ajouté.` : 'Je n’ai pas pu ajouter ce département.')
      return
    }
    if (action.kind === 'hire') {
      const wanted = action.department?.toLowerCase() ?? ''
      const department = wanted
        ? chart!.departments.find((item) => item.name.toLowerCase().includes(wanted) || wanted.includes(item.name.toLowerCase()))?.name ?? action.department!
        : chart!.departments[0]?.name || 'Général'
      const result = await act(() => hireAgent(action.role, department))
      if (result.ok) setView(view === 'bureau' ? 'bureau' : 'employes')
      speak(result.ok ? result.note : `Je n’ai pas pu ajouter cet employé. ${result.note}`)
      return
    }
    if (action.kind === 'space') {
      setView('bureau')
      if (action.op === 'add') {
        const name = twin.addSpace(action.target as OfficeSpaceKind, action.name)
        speak(`${name} est ajouté au Bureau 3D.`)
        return
      }
      const target = action.target.toLowerCase()
      const role = target.match(/^poste\s+(?:de |d['’]|du |des )?(.+)$/)?.[1]
      if (role && chart) {
        const holder = chart.agents.find((agent) => agent.role.toLowerCase().includes(role) || role.includes(agent.role.toLowerCase()))
        if (!holder) {
          speak(`Aucun agent n’occupe le poste ${role}.`)
          return
        }
        const result = await act(() => removeAgent(holder))
        speak(result.ok ? `Le poste ${holder.role} est supprimé. ${result.note}` : result.note)
        return
      }
      const deptName = target.match(/^d[ée]partement\s+(?:de |du |des |d['’])?(.+)$/)?.[1]
      const room = deptName ? null : (() => {
        const bare = target.replace(/^(?:salle|zone|pi[eè]ce|espace|bureau)\s+(?:de |du |des |d['’])?/, '')
        const kind = spaceFromText(target)?.kind
        return twin.layout.rooms.find((item) => item.name.toLowerCase() === target || item.name.toLowerCase() === bare)
          ?? twin.layout.rooms.find((item) => bare.length > 2 && item.name.toLowerCase().includes(bare))
          ?? twin.layout.rooms.find((item) => kind && item.kind === kind && !item.departmentId)
          ?? null
      })()
      const department = chart?.departments.find((item) =>
        deptName ? item.name.toLowerCase().includes(deptName) : room?.departmentId === item.id && room.id.endsWith(`-room-${item.id}`))
      if (department && chart) {
        const staff = chart.agents.filter((agent) => agent.departmentId === department.id)
        if (staff.length) {
          speak(`${staff.length} agent${staff.length > 1 ? 's travaillent' : ' travaille'} encore dans ${department.name} : ${staff.map((a) => a.firstName).join(', ')}. Déplacez-les ou retirez-les d’abord.`)
          return
        }
        const result = await act(async () => {
          await call(`/v1/departments/${department.id}`, { method: 'DELETE' })
          return `Département ${department.name} supprimé.`
        })
        speak(result.note)
        return
      }
      if (room && twin.removeSpace(room.id)) {
        speak(`${room.name} est retiré du Bureau 3D.`)
        return
      }
      speak(`Je ne trouve pas « ${action.target} » dans le bureau.`)
      return
    }
    if (action.kind === 'equip') {
      const agent = findAgent(action.name)
      if (!agent) {
        speak(`${action.name} n’est pas dans l’équipe.`)
        return
      }
      const result = await act(() => grantTool(agent, action.provider, action.on))
      speak(result.note)
      return
    }
    if (action.kind === 'crew') {
      setView('bureau')
      void crew.start(action.mission)
      speak('Je fais le plan et je monte l’équipe. Suivez-les dans le Bureau 3D.')
      return
    }
    if (action.kind === 'follow') {
      const agent = findAgent(action.name)
      if (!agent) {
        speak(`${action.name} n’est pas dans l’équipe.`)
        return
      }
      setView('bureau')
      setSelectedId(agent.id)
      setTab('details')
      setOfficeFocus({ agentId: agent.id, nonce: Date.now() })
      const work = officeControl.work(agent.id).slice(0, 3)
      speak(work.length
        ? `${agent.firstName} : ${work.map((item) => `${item.title}, ${WORK_LABEL[item.status].toLowerCase()}`).join('. ')}.`
        : `${agent.firstName} n’a pas encore de mission en cours. Donnez-lui une consigne depuis sa fiche.`)
      return
    }
    if (action.kind === 'move') {
      const agent = findAgent(action.name)
      if (!agent) {
        speak(`${action.name} n’est pas dans l’équipe.`)
        return
      }
      const ok = await run(async () => {
        await call(`/v1/agents/${agent.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ departmentName: action.department }),
        })
      })
      setView('organigramme')
      speak(ok ? `${agent.firstName} rejoint ${action.department}.` : 'Je n’ai pas pu déplacer cet employé.')
      return
    }
    if (action.kind === 'fire') {
      const agent = findAgent(action.name)
      if (!agent) {
        speak(`${action.name} n’est pas dans l’équipe.`)
        return
      }
      const ok = await run(async () => {
        await call(`/v1/agents/${agent.id}`, { method: 'DELETE' })
      })
      if (ok) setSelectedId(null)
      speak(ok ? `${agent.firstName} ${agent.lastName} a quitté l’organisation.` : 'Je n’ai pas pu retirer cet employé.')
      return
    }
    if (action.kind === 'autonomy') {
      const agent = chart!.agents.find((item) => item.firstName.toLowerCase() === action.name.toLowerCase())
      if (!agent) {
        speak(`${action.name} n’est pas dans l’équipe.`)
        return
      }
      const ok = await run(async () => {
        await call(`/v1/agents/${agent.id}/permissions`, {
          method: 'PATCH',
          body: JSON.stringify({ delegation: action.level, permissions: agent.permissions }),
        })
      })
      speak(ok
        ? `${agent.firstName} travaille maintenant ${action.level === 'autonomous' ? 'en autonomie' : 'sous votre accord'}.`
        : 'Je n’ai pas pu changer cette autonomie.')
      return
    }
    if (action.kind === 'collaborate') {
      const people = action.with
        .map((name) => chart!.agents.find((agent) => agent.firstName.toLowerCase() === name.toLowerCase()))
        .filter((agent): agent is Agent => Boolean(agent))
      if (people.length < 2) {
        speak('Je n’ai pas trouvé ces deux employés.')
        return
      }
      const ok = await run(async () => {
        await call('/v1/relations', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: chart!.organization.id,
            fromAgentId: people[0].id,
            toAgentId: people[1].id,
          }),
        })
      })
      speak(ok ? `${people[0].firstName} et ${people[1].firstName} collaborent.` : 'Je n’ai pas pu créer cette collaboration.')
      return
    }
    if (action.kind === 'ask') {
      const agent = findAgent(action.name)
      if (!agent) {
        const answered = await directAtlas(raw)
        speak(answered?.reply || `${action.name} n’est pas dans l’équipe.`)
        return
      }
      setView('organigramme')
      wantTab.current = 'discussion'
      setSelectedId(agent.id)
      setTab('discussion')
      setSpoken(`${agent.firstName} rejoint la conversation.`)
      const reply = await converse(agent, action.question).catch(() => '')
      setChat(await threadOf(agent).catch(() => []))
      speak(reply || `${agent.firstName} est là. Posez-lui votre question.`, agent.avatar?.voiceId)
      return
    }
    if (action.kind === 'plan') {
      setView('missions')
      setSpoken("I'm assigning the mission.")
      const lines: string[] = []
      const missing: string[] = []
      for (const step of action.steps) {
        const agent = findAgent(step.name)
        if (!agent) {
          missing.push(step.name)
          continue
        }
        const status = await assign(agent, step.task).catch(() => 'non transmise')
        lines.push(`${agent.firstName} : ${step.task}, ${status}`)
      }
      if (chart) await loadOps(chart.organization.id)
      const absent = missing.length ? ` ${missing.join(' et ')} ${missing.length > 1 ? 'ne sont' : 'n’est'} pas dans l’équipe.` : ''
      const summary = action.summary && lines.length ? ' Je vous ferai la synthèse quand ils auront rendu leur partie.' : ''
      speak(lines.length ? `${lines.join('. ')}.${absent}${summary}` : `Aucun de ces employés n’est dans l’équipe.${absent}`)
      return
    }
    if (action.kind === 'mission') {
      const agent = pickAgentForMission(chart!.agents, action.text)
      if (!agent) {
        speak('Aucun employé pour porter cette mission.')
        return
      }
      setMission(action.text)
      setMissionAgent(agent.id)
      setView('missions')
      let note = ''
      const ok = await run(async () => {
        const result = await call<{ outcome: string; reason: string }>('/v1/commands', {
          method: 'POST',
          body: JSON.stringify({
            organizationId: chart!.organization.id,
            agentId: agent.id,
            text: action.text,
            action: missionAction(agent),
            kind: 'analyze',
            amount: null,
          }),
        })
        note = result.outcome === 'allowed' ? 'Mission acceptée.' : result.outcome === 'approval_required' ? 'Cette mission attend votre accord.' : result.reason
        setMissionNote(note)
        setMission('')
      })
      speak(ok ? `Mission confiée à ${agent.firstName} ${agent.lastName}. ${note}` : 'Je n’ai pas pu confier cette mission.')
      return
    }
    if (action.kind === 'workflow') {
      const vague = /^(?:crte|cr[eé]e?|lance|fais|faire)\s*[- ]?(?:moi\s+)?(?:un\s+|une\s+)?(?:proc[eé]dure|workflow)\s*$/i.test(action.text.trim())
      const mission = vague
        ? `Mettre en place le workflow de ${chart.organization.name} : qualification, offre, relance, clôture, onboarding.`
        : action.text
      setProcedure(mission)
      setView('workflows')
      let line = ''
      const ok = await run(async () => {
        const body = await call<{ steps: Array<{ role: string; task: string }> }>(`/v1/organizations/${chart.organization.id}/swarm`, {
          method: 'POST',
          body: JSON.stringify({ mission }),
        })
        setSteps(body.steps ?? [])
        line = (body.steps ?? []).slice(0, 3).map((step) => `${step.role} : ${step.task}`).join(' ')
      })
      speak(ok ? (line || 'La procédure est répartie.') : 'Je n’ai pas pu répartir cette procédure.')
      return
    }
    if (action.kind === 'meeting') {
      const starts = new Date()
      starts.setDate(starts.getDate() + 1)
      starts.setHours(9, 0, 0, 0)
      setMeetingTitle(action.title)
      setMeetingWhen(starts.toISOString().slice(0, 16))
      setView('reunions')
      const everyone = (action.with ?? []).some((name) => /[ée]quipe|tout/i.test(name))
      const people = everyone
        ? chart!.agents.slice(0, 6)
        : (action.with ?? [])
          .map((name) => chart!.agents.find((agent) => `${agent.firstName} ${agent.lastName}`.toLowerCase().includes(name.toLowerCase()) || agent.firstName.toLowerCase() === name.toLowerCase()))
          .filter((agent): agent is Agent => Boolean(agent))
      let decision = ''
      let positions: string[] = []
      if (people.length) {
        setSpoken('The meeting is starting.')
        try {
          const response = await fetch('/api/atlas/meeting', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ topic: action.title, organization: chart!.organization.name, people: people.map(profileOf) }),
          })
          const outcome = await response.json() as { positions?: string[]; decision?: string }
          positions = outcome.positions ?? []
          decision = outcome.decision ?? ''
        } catch { /* la réunion est placée même sans compte rendu */ }
      }
      const agenda = [
        ...people.map((agent) => `${agent.firstName} ${agent.lastName}, ${agent.role}`),
        ...positions,
        ...(decision ? [decision] : []),
      ]
      const ok = await run(async () => {
        await call(`/v1/organizations/${chart!.organization.id}/meetings`, {
          method: 'POST',
          body: JSON.stringify({
            organizationId: chart!.organization.id,
            title: action.title,
            startsAt: starts.toISOString(),
            createdByAgentId: people[0]?.id ?? null,
            agenda,
          }),
        })
        setMeetingTitle('')
        setMeetingWhen('')
      })
      const guests = people.length
        ? ` avec ${people.map((agent) => agent.firstName).join(' et ')}`
        : (action.with?.length ? '. Ces prénoms ne sont pas dans l’équipe' : '')
      speak(ok
        ? `Réunion ${action.title} placée demain à 9 heures${guests}.${decision ? ` ${decision}` : ''}`
        : 'Je n’ai pas pu placer cette réunion.')
      return
    }
  }

  function readDescription(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '').replace(/\s+/g, ' ').trim().slice(0, 4000)
      if (text.length < 3) {
        setHint('Ce fichier ne contient pas assez de texte.')
        return
      }
      setDraft(text)
      setView('organigramme')
      setChannel('voix')
      setHint('Description importée. Dites « génère mon organisation », ou cliquez Générer ci-dessous.')
      speak('Description importée. Dites générer mon organisation quand vous voulez.')
    }
    reader.readAsText(file)
  }

  function submitConsole() {
    const text = draft.trim()
    if (text.length < 3) {
      setHint('Décrivez l’organisation, ou donnez un ordre à Atlas.')
      return
    }
    void pilot(text)
  }

  function markLesson(lesson: string) {
    const next = doneLessons.includes(lesson) ? doneLessons.filter((item) => item !== lesson) : [...doneLessons, lesson]
    setDoneLessons(next)
    window.localStorage.setItem('atlas-lessons', next.join('|'))
  }

  function exportJson() {
    if (!chart) return
    const file = new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'atlas-organisation.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const pendingDecisions = decisions.filter((item) => item.status === 'pending')
  const emptyDepartments = chart ? chart.departments.filter((department) => !chart.agents.some((agent) => agent.departmentId === department.id)) : []
  const alerts = chart ? [
    ...(emptyDepartments.length ? [`Département sans employé : ${emptyDepartments.map((item) => item.name).join(', ')}.`] : []),
    ...(counts && chart.agents.length && counts.openTasks > chart.agents.length * 3 ? ['Charge élevée : plus de trois tâches ouvertes par employé.'] : []),
    ...(!chart.agents.some((agent) => /support/i.test(agent.role)) ? ['Aucun support client : les demandes des clients n’ont pas de responsable.'] : []),
    ...(documents.length === 0 ? ['Le dossier est vide : les agents répondent sans document de l’entreprise.'] : []),
    ...(links.some((item) => item.status === 'connected') ? [] : ['Aucun outil relié : cliquez Relier dans Intégrations (Gmail, calendrier, CRM…).']),
  ] : []
  const supportMissing = chart ? !chart.agents.some((agent) => /support/i.test(agent.role)) : false
  pilotRef.current = (text: string) => { void pilot(text) }
  const atlasConsole = (
    <StudioConsole
      draft={draft}
      pending={pending}
      channel={channel}
      listening={listening}
      talking={talking}
      voicePlaying={voicePlaying}
      a2fClip={a2fClip}
      lipClock={lipClock.current}
      advanced={advanced}
      spoken={spoken}
      speakChunk={speakChunk}
      fileRef={fileRef}
      setDraft={setDraft}
      setAdvanced={setAdvanced}
      onChannel={chooseChannel}
      onTalk={() => void toggleTalk()}
      onSubmit={submitConsole}
      onGenerate={() => void generate()}
      onTemplates={() => setView('templates')}
      onFile={readDescription}
    />
  )

  // Mode global : Atlas hors studio (raccourci Windows / Companion)
  if (overlay) {
    return (
      <div className={styles.overlayShell}>
        <header className={styles.overlayBar}>
          <strong>ATLAS</strong>
          <span>Assistant global · Ctrl+Shift+A</span>
          <a className={styles.overlayLink} href="/bureau">Ouvrir le studio</a>
        </header>
        <div className={styles.overlayBody}>
          {atlasConsole}
        </div>
        <p className={styles.overlayHint}>
          Disponible partout sur Windows via le Companion. Parlez ou écrivez — fichiers, apps, mails, recherche…
        </p>
      </div>
    )
  }

  function gate(children: ReactNode) {
    if (booting) return <p className={styles.lead}>Ouverture du studio…</p>
    if (!chart) {
      return (
        <div className={styles.welcome}>
          <h1>Activez d’abord ZTC Hosting.</h1>
          <p className={styles.lead}>ATLAS orchestre uniquement l’agence ZTC. Ouvrez l’organigramme pour monter Nova, Vega, Ledger et le reste du bureau.</p>
          <button className={styles.primary} type="button" onClick={() => setView('organigramme')}>Aller à l’organigramme</button>
        </div>
      )
    }
    return children
  }

  return (
    <div className={styles.studio}>
      <aside className={styles.side}>
        <Link href="/" className={styles.brand} aria-label="ATLAS">
          <Mark />
          <span>ATLAS<small>AI ORGANIZATION OS</small></span>
        </Link>
        <div className={styles.orgChip}>
          <span className={styles.orgMark}><img src={ZTC_MARK} alt="" width={28} height={28} /></span>
          <div>
            <strong>{ZTC_NAME}</strong>
            <span>{chart ? `${chart.agents.length} employés IA` : 'Pas encore dessinée'}</span>
          </div>
          <button type="button" aria-label="Revenir à l’accueil" onClick={() => { setChart(null); setSelectedId(null); setView('organigramme') }}><Icon name="plus" /></button>
        </div>
        <nav>
          <div className={styles.group}>
            <p>ÉQUIPE</p>
            <Nav view={view} id="organigramme" label="Organigramme" onPick={setView} />
            <Nav view={view} id="bureau" label="Bureau 3D" count={officeOrg ? twin.layout.agents.length : undefined} onPick={setView} />
            <Nav view={view} id="employes" label="Employés IA" count={chart?.agents.length} onPick={setView} />
          </div>
          <div className={styles.group}>
            <p>OPÉRATIONS</p>
            <Nav view={view} id="missions" label="Missions" count={counts?.openTasks} onPick={setView} />
            <Nav view={view} id="factures" label="Factures" count={overdueInvoices || undefined} alert onPick={(next) => { setInvoiceScope(null); setView(next) }} />
            <Nav view={view} id="workflows" label="Workflows" onPick={setView} />
            <Nav view={view} id="reunions" label="Réunions" count={meetings.length || undefined} onPick={setView} />
            <Nav view={view} id="approbations" label="Approbations" count={pendingDecisions.length || undefined} alert onPick={setView} />
          </div>
          <div className={styles.group}>
            <p>ACTIFS</p>
            <Nav view={view} id="connaissances" label="Connaissances" count={documents.length || undefined} onPick={setView} />
            <Nav view={view} id="integrations" label="Intégrations" onPick={setView} />
            <Nav view={view} id="observabilite" label="Observabilité" onPick={setView} />
          </div>
          <div className={styles.group}>
            <p>INSPIRE</p>
            <Nav view={view} id="templates" label="Templates" onPick={setView} />
            <Nav view={view} id="tutoriels" label="Tutoriels" onPick={setView} />
          </div>
        </nav>
        <div className={styles.sideFoot}>
          <button className={view === 'compte' ? styles.navOn : styles.navBtn} type="button" onClick={() => setView('compte')}>
            <Icon name="shield" />
            <span>Compte et sécurité</span>
          </button>
          <p>Démonstration · aucun paiement</p>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <label className={styles.searchWrap}>
            <Icon name="search" />
            <input className={styles.search} value={query} placeholder="Rechercher un agent, un département…" aria-label="Recherche" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button className={advanced ? styles.modeOn : styles.mode} type="button" onClick={() => setAdvanced((value) => !value)}>
            <Icon name={advanced ? 'spark' : 'sliders'} />
            {advanced ? 'Mode avancé' : 'Mode simple'}
          </button>
          <button className={styles.zoom} type="button" onClick={() => setZoom((value) => value === 1 ? 0.9 : value === 0.9 ? 1.08 : 1)}>{Math.round(zoom * 100)} %</button>
          <div className={styles.bellWrap}>
            <button className={styles.bell} type="button" aria-label="Notifications" onClick={() => setNotes((open) => !open)}>
              <Icon name="bell" />
              {pendingDecisions.length + alerts.length + toolAsks.length + notices.length ? <em>{pendingDecisions.length + alerts.length + toolAsks.length}</em> : null}
            </button>
            {notes ? (
              <div className={styles.notes}>
                {pendingDecisions.length + alerts.length + notices.length + toolAsks.length === 0 ? <p>Rien en attente.</p> : null}
                {toolAsks.map((item) => <p key={item.id}>Outil · {item.preview}</p>)}
                {pendingDecisions.map((item) => <p key={item.id}>Décision · {item.title}</p>)}
                {notices.slice(0, 6).map((item) => <p key={item.id}>{item.title} · {item.detail}</p>)}
                {alerts.map((item) => <p key={item}>{item}</p>)}
                <button className={styles.ghost} type="button" onClick={() => { setView('approbations'); setNotes(false) }}>Ouvrir les approbations</button>
                <button className={styles.ghost} type="button" onClick={() => { setView('integrations'); setNotes(false) }}>Ouvrir les intégrations</button>
              </div>
            ) : null}
          </div>
          <div className={styles.user}>
            <span className={styles.avatarUser}>{identity.name.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{identity.name}</strong>
              <small>Dirigeant · {identity.company}</small>
            </span>
          </div>
        </header>

        <div className={styles.body}>
          <main
            className={`${styles.main} ${build ? styles.theaterMain : ''}`}
            style={view === 'organigramme' && !build && !chart ? { zoom } : undefined}
          >
            {hint && !build && !briefing ? <p className={styles.banner}>{hint}</p> : null}
            {!build && briefing ? (
              <div className={styles.buildHud} aria-live="polite">
                <em>Brief</em>
                <strong>Je rassemble les informations</strong>
                <p>{intakeQuestion(nextIntakeSlot(composeIntention(briefing)) ?? 'goal')}</p>
              </div>
            ) : null}
            {view !== 'organigramme' && view !== 'bureau' && view !== 'factures' && !booting && !build ? atlasConsole : null}
            {view === 'organigramme' ? (
              booting ? <p className={styles.lead}>Ouverture du studio…</p> : build ? (
                <CreationTheater
                  show={build}
                  ask={firstAsk}
                  setAsk={setFirstAsk}
                  linked={links.filter((item) => item.status === 'connected').map((item) => item.provider)}
                  onPick={(provider) => setPickedTools((current) => current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider])}
                  onLink={(provider) => {
                    void connectProvider(provider).then((body) => {
                      showBuild({
                        tick: {
                          ok: Boolean(body.ok),
                          text: body.ok
                            ? `${connectorLabel(provider)} connecté`
                            : `${connectorLabel(provider)} — autorisez dans la fenêtre, puis revenez`,
                        },
                      })
                    })
                  }}
                  onConnect={() => {
                    if (connectGate.current) {
                      connectGate.current()
                      return
                    }
                    showBuild({
                      beat: '11',
                      title: 'Organisation opérationnelle',
                      phase: 'ready',
                      percent: 100,
                      ready: true,
                      line: 'Votre organisation est opérationnelle.',
                      intel: ATLAS_INTEL.map((item) => ({ ...item, ok: true })),
                      summary: {
                        agents: chart?.agents.length ?? 0,
                        depts: chart?.departments.length ?? 0,
                        skills: (chart?.agents ?? []).reduce((sum, agent) => sum + (agent.skills?.length ?? 0), 0),
                        tools: pickedTools.length,
                      },
                      tick: { ok: true, text: 'Outils prêts à relier' },
                    })
                  }}
                  onEnter={() => {
                    if (enterGate.current) {
                      enterGate.current()
                      return
                    }
                    const offer = 'Votre organisation est opérationnelle. Que voulez-vous lui faire accomplir ?'
                    showBuild({
                      beat: '12',
                      title: 'Première mission',
                      phase: 'ask',
                      percent: 100,
                      ready: false,
                      offer,
                      line: offer,
                    })
                  }}
                  onLaunch={() => {
                    const text = firstAsk.trim()
                    setBuild(null)
                    if (text.length >= 3) void pilot(text)
                  }}
                >
                  {chart ? (
                    <Operating
                      chart={chart}
                      agents={agents}
                      advanced={advanced}
                      supportMissing={false}
                      leader={identity.name}
                      meta={orgMeta}
                      selectedId={selectedId}
                      deptDraft={deptDraft}
                      adding={false}
                      hire={hire}
                      console={null}
                      cinematic
                      birth={build.birth}
                      glow={build.ready}
                      setDeptDraft={setDeptDraft}
                      setAdding={setAdding}
                      setHire={setHire}
                      setSelectedId={setSelectedId}
                      run={run}
                    />
                  ) : (
                    <p className={styles.lead}>Préparation de l’organigramme…</p>
                  )}
                </CreationTheater>
              ) : chart ? (
                <Operating
                  chart={chart}
                  agents={agents}
                  advanced={advanced}
                  supportMissing={supportMissing}
                  leader={identity.name}
                  meta={orgMeta}
                  selectedId={selectedId}
                  deptDraft={deptDraft}
                  adding={adding}
                  hire={hire}
                  console={atlasConsole}
                  setDeptDraft={setDeptDraft}
                  setAdding={setAdding}
                  setHire={setHire}
                  setSelectedId={setSelectedId}
                  run={run}
                />
              ) : (
                <Welcome console={atlasConsole} />
              )
            ) : null}

            {view === 'bureau' ? (
              <section className={`${styles.panel} ${styles.officeStage}`}>
                <h1>Bureau 3D</h1>
                <p className={styles.lead}>
                  Explorez {twin.name} : cliquez un agent pour sa fiche, une pièce pour le tableau de bord du département.
                </p>
                <BureauLive
                  twin={twin}
                  control={officeControl}
                  crew={crew}
                  onOpenMissions={() => setView('missions')}
                  selectedAgentId={selectedId}
                  focus={officeFocus}
                  onSelectAgent={(id) => {
                    setSelectedId(id)
                    if (id) setTab('details')
                  }}
                  onOpenInvoices={openInvoices}
                />
              </section>
            ) : null}

            {view === 'factures' ? (
              <section className={`${styles.panel} ${styles.officeStage}`}>
                <h1>{twin.ops.recordsTitle}</h1>
                <p className={styles.lead}>
                  Facturation de {twin.name} en CHF · chaque document est porté par un agent et localisable dans le Bureau 3D.
                </p>
                <FacturesSection twin={twin} scope={invoiceScope} onLocate={locateInOffice} />
              </section>
            ) : null}

            {view === 'employes' ? gate(
              <section className={styles.panel}>
                <h1>Employés IA</h1>
                <p className={styles.lead}>{agents.length} personne{agents.length > 1 ? 's' : ''} dans cette vue.</p>
                <div className={styles.grid}>
                  {agents.map((agent) => (
                    <button key={agent.id} className={styles.card} type="button" onClick={() => { setSelectedId(agent.id); setView('organigramme') }}>
                      <span className={styles.avatar}>
                        <AceFace
                          seed={`${agent.firstName}-${agent.lastName}`}
                          face={resolveAgentFace(agent.firstName, agent.lastName, agent.avatar?.face)}
                          size="thumb"
                          label={`${agent.firstName} ${agent.lastName}`}
                        />
                      </span>
                      <strong>{agent.firstName} {agent.lastName}</strong>
                      <p>{agent.role} · {delegationLabel(agent.delegation)} · {agent.personality?.tone || 'professionnel'}</p>
                      <p>{agent.mission}</p>
                      {(agent.objectives ?? []).slice(0, 1).map((item) => (
                        <p key={item.id}>{item.label}{item.target ? ` : ${item.target}` : ''}{item.dueAt ? ` d’ici ${item.dueAt}` : ''}</p>
                      ))}
                    </button>
                  ))}
                </div>
              </section>,
            ) : null}

            {view === 'missions' ? <CrewBoard crew={crew} canRun={!booting} /> : null}
            {view === 'missions' ? gate(
              <section className={styles.panel}>
                <h1>Missions</h1>
                <p className={styles.lead}>{counts?.openTasks ?? 0} tâche{counts?.openTasks === 1 ? '' : 's'} ouverte{counts?.openTasks === 1 ? '' : 's'}. Donnez la suite en langage clair.</p>
                <label className={styles.field}>Employé
                  <select value={missionAgent} onChange={(event) => setMissionAgent(event.target.value)}>
                    <option value="">Choisir</option>
                    {chart?.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</option>)}
                  </select>
                </label>
                <label className={styles.field}>Mission
                  <textarea value={mission} placeholder="Prépare le reporting de la semaine." onChange={(event) => setMission(event.target.value)} />
                </label>
                <button className={styles.primary} type="button" disabled={!missionAgent || mission.trim().length < 3 || pending} onClick={() => void run(async () => {
                  const result = await call<{ outcome: string; reason: string }>('/v1/commands', {
                    method: 'POST',
                    body: JSON.stringify({
                      organizationId: chart!.organization.id,
                      agentId: missionAgent,
                      text: mission.trim(),
                      action: missionAction(chart!.agents.find((agent) => agent.id === missionAgent) ?? chart!.agents[0]),
                      kind: 'analyze',
                      amount: null,
                    }),
                  })
                  setMissionNote(result.outcome === 'allowed' ? 'Mission acceptée.' : result.outcome === 'approval_required' ? 'Cette mission attend votre accord.' : result.reason)
                  setMission('')
                })}>Confier</button>
                {missionNote ? <p>{missionNote}</p> : null}
              </section>,
            ) : null}

            {view === 'workflows' ? gate(
              <section className={styles.panel}>
                <h1>Workflows</h1>
                <p className={styles.lead}>Décrivez une procédure. ATLAS la répartit sur les rôles, sans effet extérieur.</p>
                <label className={styles.field}>Procédure
                  <textarea value={procedure} placeholder="Chaque lundi, le commercial relance les comptes silencieux, puis la finance vérifie les devis." onChange={(event) => setProcedure(event.target.value)} />
                </label>
                <button className={styles.primary} type="button" disabled={procedure.trim().length < 3 || pending} onClick={() => void run(async () => {
                  const body = await call<{ steps: Array<{ role: string; task: string }> }>(`/v1/organizations/${chart!.organization.id}/swarm`, {
                    method: 'POST',
                    body: JSON.stringify({ mission: procedure.trim() }),
                  })
                  setSteps(body.steps ?? [])
                })}>Répartir</button>
                <div className={styles.list}>
                  {steps.map((step) => <article key={`${step.role}-${step.task}`} className={styles.auditItem}><strong>{step.role}</strong><p>{step.task}</p></article>)}
                </div>
                {advanced ? <p>Le bac à sable est cette répartition : elle n’envoie rien et n’ouvre aucun outil.</p> : null}
              </section>,
            ) : null}

            {view === 'reunions' ? gate(
              <section className={styles.panel}>
                <h1>Réunions IA</h1>
                <p className={styles.lead}>Agenda, discussion entre employés, décision, puis tâches. Le compte-rendu vous est notifié ici — pas d’e-mail tant que Resend/Gmail n’est pas relié.</p>
                <form className={styles.stack} onSubmit={(event) => {
                  event.preventDefault()
                  if (!meetingTitle.trim() || !meetingWhen) return
                  const title = meetingTitle.trim()
                  void run(async () => {
                    await call(`/v1/organizations/${chart!.organization.id}/meetings`, {
                      method: 'POST',
                      body: JSON.stringify({
                        organizationId: chart!.organization.id,
                        title,
                        startsAt: new Date(meetingWhen).toISOString(),
                        createdByAgentId: null,
                        agenda: [`Point ${title}`, 'Décisions', 'Tâches'],
                      }),
                    })
                    pushNotice('meeting', 'Réunion placée', title)
                    setMeetingTitle('')
                    setMeetingWhen('')
                  })
                }}>
                  <label className={styles.field}>Titre<input value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} /></label>
                  <label className={styles.field}>Moment<input type="datetime-local" value={meetingWhen} onChange={(event) => setMeetingWhen(event.target.value)} /></label>
                  <button className={styles.primary} type="submit" disabled={pending}>Planifier</button>
                </form>
                <div className={styles.list}>
                  {meetings.length === 0 ? <p>Aucune réunion pour l’instant.</p> : meetings.map((item) => (
                    <article key={item.id} className={styles.auditItem}>
                      <strong>{item.title}</strong>
                      <p>{new Date(item.startsAt).toLocaleString('en-US')}</p>
                      {item.agenda?.length ? <p>{item.agenda.join(' · ')}</p> : null}
                    </article>
                  ))}
                </div>
              </section>,
            ) : null}

            {view === 'approbations' ? gate(
              <section className={styles.panel}>
                <h1>Approbations</h1>
                <p className={styles.lead}>Au départ, les actions sensibles — envoi de mail, paiement, code — attendent votre accord.</p>
                <div className={styles.list}>
                  {toolAsks.map((item) => (
                    <article key={item.id} className={styles.auditItem}>
                      <strong>{item.provider}</strong>
                      <p>{item.preview}</p>
                      <div className={styles.choice}>
                        <button type="button" onClick={() => void run(async () => {
                          await invokeTool(item.provider, item.tool, item.input, true)
                          setToolAsks((current) => current.filter((entry) => entry.id !== item.id))
                        })}>Approuver</button>
                        <button type="button" onClick={() => setToolAsks((current) => current.filter((entry) => entry.id !== item.id))}>Rejeter</button>
                      </div>
                    </article>
                  ))}
                  {decisions.length === 0 && toolAsks.length === 0 ? <p>Aucune décision en cours.</p> : decisions.map((item) => (
                    <article key={item.id} className={styles.auditItem}>
                      <strong>{item.title}</strong>
                      <p>{item.summary} · {item.status}{item.amount != null ? ` · ${item.amount} €` : ''}</p>
                      {item.status === 'pending' ? (
                        <div className={styles.choice}>
                          {(['approved', 'rejected', 'discussing'] as const).map((status) => (
                            <button key={status} type="button" onClick={() => void run(async () => {
                              await call(`/v1/approvals/${item.id}`, { method: 'POST', body: JSON.stringify({ status }) })
                            })}>{status === 'approved' ? 'Approuver' : status === 'rejected' ? 'Rejeter' : 'Discuter'}</button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>,
            ) : null}

            {view === 'connaissances' ? gate(
              <section className={styles.panel}>
                <h1>Connaissances</h1>
                <p className={styles.lead}>Déposez un document et choisissez les employés qui peuvent s’en servir.</p>
                <label className={styles.field}>Nom du document<input value={docName} onChange={(event) => setDocName(event.target.value)} placeholder="Procédure de relance" /></label>
                <ul className={styles.perms}>
                  {chart?.agents.map((agent) => (
                    <li key={agent.id}>
                      <label>
                        <input type="checkbox" checked={docAgents.includes(agent.id)} onChange={() => setDocAgents((current) => current.includes(agent.id) ? current.filter((id) => id !== agent.id) : [...current, agent.id])} />
                        {agent.firstName} {agent.lastName}
                      </label>
                    </li>
                  ))}
                </ul>
                <button className={styles.primary} type="button" disabled={docName.trim().length < 2 || pending} onClick={() => void run(async () => {
                  await call('/v1/knowledge', {
                    method: 'POST',
                    body: JSON.stringify({ organizationId: chart!.organization.id, name: docName.trim(), mimeType: 'text/plain', accessibleTo: docAgents }),
                  })
                  setDocName('')
                  setDocAgents([])
                })}>Importer</button>
                <div className={styles.list}>
                  {documents.map((item) => {
                    const readers = readersOf(item, knowledgeAccess)
                    return (
                      <article key={item.id} className={styles.auditItem}>
                        <strong>{item.name}</strong>
                        <ul className={styles.perms}>
                          {chart?.agents.map((agent) => (
                            <li key={agent.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={readers.includes(agent.id)}
                                  onChange={() => {
                                    const next = readers.includes(agent.id)
                                      ? readers.filter((id) => id !== agent.id)
                                      : [...readers, agent.id]
                                    rememberKnowledge(item.id, next)
                                    setKnowledgeAccess((current) => ({ ...current, [item.id]: next }))
                                  }}
                                />
                                {agent.firstName} {agent.lastName}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </article>
                    )
                  })}
                </div>
              </section>,
            ) : null}

            {view === 'integrations' ? (
              booting ? <p className={styles.lead}>Ouverture du studio…</p> : (
              <ConnectPanel
                organizationId={workspaceId()}
                focus={focusTool ?? undefined}
                pending={pending}
                links={links}
                agents={(chart?.agents ?? []).map((agent) => ({ id: agent.id, firstName: agent.firstName, lastName: agent.lastName, role: agent.role }))}
                grants={grants}
                advanced={advanced}
                personal={!chart}
                onLinks={setLinks}
                onLink={(provider) => {
                  void refreshLinks()
                  pushNotice('connect', 'Outil relié', `${connectorLabel(provider)} est connecté.`)
                  voice(`${connectorLabel(provider)} est connecté.`)
                }}
                onUnlink={(provider) => void run(async () => {
                  const response = await fetch('/api/atlas/connect', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ intent: 'unlink', organizationId: workspaceId(), provider }),
                  })
                  const body = await response.json() as { links?: PublicLink[] }
                  setLinks(body.links ?? [])
                  voice(`${connectorLabel(provider)} est détaché.`)
                })}
                onGrant={(provider, agentId, access) => {
                  if (!chart) return
                  const next = { ...grants, [provider]: { ...(grants[provider] ?? {}), [agentId]: access } }
                  setGrants(next)
                  rememberGrants(chart.organization.id, next)
                  const agent = chart.agents.find((item) => item.id === agentId)
                  if (!agent) return
                  const tools = new Set(agent.toolIds ?? [])
                  if (access === 'none') tools.delete(provider)
                  else tools.add(provider)
                  void run(async () => {
                    await call(`/v1/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify({ toolIds: [...tools] }) })
                    rememberProfile(agent.id, {
                      firstName: agent.firstName,
                      lastName: agent.lastName,
                      skills: agent.skills,
                      objectives: agent.objectives,
                      toolIds: [...tools],
                      personality: agent.personality,
                      avatar: agent.avatar,
                    })
                  })
                }}
              />
              )
            ) : null}

            {view === 'observabilite' ? gate(
              <section>
                <h1>Observabilité</h1>
                <div className={styles.kpi}>
                  <div><strong>{chart?.agents.length ?? 0}</strong><span>Employés</span></div>
                  <div><strong>{counts?.activeAgents ?? 0}</strong><span>Actifs</span></div>
                  <div><strong>{counts?.openTasks ?? 0}</strong><span>Tâches ouvertes</span></div>
                  <div><strong>{counts?.pendingDecisions ?? 0}</strong><span>Décisions</span></div>
                </div>
                <p className={styles.lead}>
                  Cette organisation compte {chart?.agents.length ?? 0} employés
                  {counts ? `, ${counts.openTasks} tâche${counts.openTasks > 1 ? 's' : ''} ouverte${counts.openTasks > 1 ? 's' : ''} et ${counts.pendingDecisions} décision${counts.pendingDecisions > 1 ? 's' : ''} en attente` : ''}.
                </p>
                <div className={styles.list}>
                  {audit.length === 0 ? <p>L’historique est encore vide.</p> : audit.slice().reverse().map((item) => (
                    <article key={item.id} className={styles.auditItem}>
                      <strong>{item.action}</strong>
                      <p>{item.reason} · {new Date(item.at).toLocaleString('en-US')}</p>
                    </article>
                  ))}
                </div>
              </section>,
            ) : null}

            {view === 'templates' ? (
              <section className={styles.welcome}>
                <h1>Templates</h1>
                <p className={styles.lead}>ATLAS ne monte plus que l’agence ZTC Hosting. Les autres modèles sont déconnectés.</p>
                <div className={styles.templateRow}>
                  {TEMPLATES.map((item) => (
                    <TemplateCard key={item.title} item={item} onPick={() => { setDraft(item.text); setView('organigramme') }} />
                  ))}
                </div>
              </section>
            ) : null}

            {view === 'tutoriels' ? (
              <section className={styles.panel}>
                <h1>Tutoriels</h1>
                <p className={styles.lead}>Quatre gestes pour prendre le studio en main.</p>
                <ul className={styles.perms}>
                  {LESSONS.map((lesson) => (
                    <li key={lesson}>
                      <label>
                        <input type="checkbox" checked={doneLessons.includes(lesson)} onChange={() => markLesson(lesson)} />
                        {lesson}
                      </label>
                    </li>
                  ))}
                </ul>
                <p><Link href="/architecture">Voir comment ATLAS est construit</Link></p>
              </section>
            ) : null}

            {view === 'compte' ? (
              <section className={styles.panel}>
                <h1>Compte</h1>
                <p className={styles.lead}>{identity.name} · {identity.company}</p>
                <p>Facturation : espace de démonstration. Aucun paiement n’est demandé.</p>
                <p>Sécurité : le mot de passe a été choisi à l’inscription. La double authentification et le SSO ne sont pas encore ouverts.</p>
                <p>Interface language: English.</p>
                <div className={styles.choice}>
                  <button className={styles.ghost} type="button" disabled={!chart} onClick={exportJson}>Exporter l’organisation</button>
                  <button className={styles.ghost} type="button" onClick={() => window.print()}>Imprimer le rapport</button>
                </div>
                {advanced ? <p>L’arrêt d’urgence de toute l’organisation n’est pas encore exposé par le gateway. Vous pouvez retirer un employé depuis sa fiche.</p> : null}
              </section>
            ) : null}
          </main>

          {selected && chart && !build && (view === 'organigramme' || view === 'employes' || view === 'bureau') ? (
            <Inspector
              chart={chart}
              agent={selected}
              advanced={advanced}
              tab={tab}
              fiche={fiche}
              peer={peer}
              chat={chat}
              chatDraft={chatDraft}
              pending={pending}
              runtimeModel={runtimeModel}
              connectors={connectors.length ? connectors : CONNECTOR_CATALOG}
              linkedProviders={links.filter((item) => item.status === 'connected').map((item) => item.provider)}
              onOpenIntegrations={() => setView('integrations')}
              documents={documents}
              knowledgeAccess={knowledgeAccess}
              setTab={setTab}
              setFiche={setFiche}
              setPeer={setPeer}
              setChatDraft={setChatDraft}
              setSelectedId={setSelectedId}
              onKnowledge={(docId, agentIds) => {
                rememberKnowledge(docId, agentIds)
                setKnowledgeAccess((current) => ({ ...current, [docId]: agentIds }))
              }}
              run={run}
              onChat={async () => {
                const body = chatDraft.trim()
                if (body.length < 1 || pending) return
                const agent = selected
                setChatDraft('')
                setPending(true)
                setHint('')
                try {
                  setChat([...chat, { id: `local-${Date.now()}`, authorId: userId(), body }])
                  await converse(agent, body)
                  setChat(await threadOf(agent))
                } catch (cause) {
                  setChatDraft(body)
                  setHint(cause instanceof Error ? cause.message : 'Le message n’est pas parti.')
                } finally {
                  setPending(false)
                }
              }}
            />
          ) : null}
        </div>
      </section>
      {siri ? (
        <div className={styles.siriVeil} role="dialog" aria-modal="true" aria-label={siri.title}>
          <div className={styles.siriSheet}>
            <header className={styles.siriHead}>
              <span className={siri.kind === 'videos' ? styles.siriBrand : styles.siriBrandWeb} aria-hidden="true">{siri.kind === 'videos' ? '▶' : siri.kind === 'mail' ? '@' : siri.kind === 'app' ? '↓' : siri.kind === 'post' ? '✎' : '◉'}</span>
              <div>
                <strong>{siri.title}</strong>
                <span>{siri.query}</span>
              </div>
              <a className={styles.siriOpen} href={siri.url} target="_blank" rel="noreferrer" title="Ouvrir dans le navigateur">Ouvrir</a>
              <button className={styles.siriClose} type="button" aria-label="Fermer" onClick={() => setSiri(null)}>×</button>
            </header>
            {siri.kind === 'videos' && siri.clips?.length ? (
              <div className={styles.siriGrid}>
                {siri.clips.map((clip) => (
                  <a key={clip.id} className={styles.siriClip} href={clip.url} target="_blank" rel="noreferrer">
                    <img src={clip.thumb} alt="" />
                    <span>{clip.title || siri.query}</span>
                  </a>
                ))}
              </div>
            ) : null}
            {siri.kind === 'web' ? (
              <>
                {siri.reply ? <p className={siri.hits?.length ? styles.siriAnswer : styles.siriEmpty}>{siri.reply}</p> : null}
                {siri.hits?.length ? (
                  <div className={styles.siriHits}>
                    {siri.hits.map((hit) => (
                      <a key={hit.url + hit.title} className={styles.siriHit} href={hit.url} target="_blank" rel="noreferrer">
                        <strong>{hit.title}</strong>
                        <span>{hit.extract}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {!siri.reply && !siri.hits?.length ? (
                  <p className={styles.siriEmpty}>La recherche web s’ouvre, comme Siri.</p>
                ) : null}
              </>
            ) : null}
            {siri.kind === 'app' ? (
              <p className={styles.siriEmpty}>La page de {siri.title} s’ouvre. Atlas ne l’installe pas toute seule sur Windows. Si c’est un outil du catalogue, reliez-le ensuite dans Intégrations.</p>
            ) : null}
            {siri.kind === 'mail' ? (
              <p className={styles.siriEmpty}>{siri.title} n’est pas relié. Aucun mail n’est lu tant que vous n’avez pas ouvert la connexion. Atlas n’invente pas de messages.</p>
            ) : null}
            {siri.kind === 'post' ? (
              <p className={styles.siriEmpty}>{siri.reply} — {siri.title} n’est pas relié, rien n’est publié en ligne.</p>
            ) : null}
            {siri.kind === 'videos' && !siri.clips?.length ? (
              <p className={styles.siriEmpty}>YouTube s’ouvre avec cette recherche, comme Siri.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Nav({ view, id, label, count, alert, onPick }: { view: View; id: View; label: string; count?: number; alert?: boolean; onPick: (view: View) => void }) {
  const icons: Record<View, string> = {
    organigramme: 'chart',
    bureau: 'building',
    factures: 'receipt',
    employes: 'users',
    missions: 'flag',
    workflows: 'workflow',
    reunions: 'calendar',
    approbations: 'check',
    connaissances: 'book',
    integrations: 'plug',
    observabilite: 'pulse',
    templates: 'layout',
    tutoriels: 'compass',
    compte: 'shield',
  }
  return (
    <button className={view === id ? styles.navOn : styles.navBtn} type="button" onClick={() => onPick(id)}>
      <Icon name={icons[id]} />
      <span>{label}</span>
      {count ? <em className={alert ? `${styles.badge} ${styles.alertBadge}` : styles.badge}>{count}</em> : null}
    </button>
  )
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string[]> = {
    chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M3 20h18'],
    receipt: ['M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22V3'],
    workflow: ['M6 3v12', 'M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M18 9a9 9 0 0 1-9 9'],
    calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2'],
    check: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
    book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2'],
    plug: ['M9 2v5', 'M15 2v5', 'M7 7h10v4a5 5 0 0 1-10 0V7', 'M12 16v6'],
    pulse: ['M22 12h-4l-3 9L9 3l-3 9H2'],
    layout: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
    compass: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z'],
    shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10'],
    search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16', 'M21 21l-4.3-4.3'],
    bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
    spark: ['M12 3l1.5 4.8L18.5 9.5 13.5 11 12 16l-1.5-5L5.5 9.5 10.5 7.8z', 'M19 15l.5 1.7 1.7.5-1.7.5L19 19.4l-.5-1.7-1.7-.5 1.7-.5z'],
    sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M2 14h4', 'M10 8h4', 'M18 16h4'],
    mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3', 'M8 22h8'],
    plus: ['M12 5v14', 'M5 12h14'],
    layers: ['M12 2l9 5-9 5-9-5 9-5', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
    pen: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
    bag: ['M6 7h12l-1 14H7L6 7', 'M9 7a3 3 0 0 1 6 0'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
    target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M12 12h.01'],
    globe: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20'],
    wallet: ['M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7', 'M3 7l2-3h12', 'M16 13h3'],
    sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10', 'M12 1v2', 'M12 21v2', 'M4.2 4.2l1.4 1.4', 'M18.4 18.4l1.4 1.4', 'M1 12h2', 'M21 12h2', 'M4.2 19.8l1.4-1.4', 'M18.4 5.6l1.4-1.4'],
    building: ['M3 21h18', 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M9 8h2', 'M13 8h2', 'M9 12h2', 'M13 12h2', 'M10 21v-4h4v4'],
    arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
    type: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
    wave: ['M4 10v4', 'M8 6v12', 'M12 3v18', 'M16 6v12', 'M20 10v4'],
    bolt: ['M13 2L3 14h8l-1 8 10-12h-8l1-8'],
    clip: ['M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3l7.8-7.8'],
    chevron: ['M6 9l6 6 6-6'],
    lock: ['M8 11V7a4 4 0 0 1 8 0v4', 'M6 11h12v10H6z'],
    file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
  }
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(paths[name] ?? []).map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

function toneClass(tone: string) {
  if (tone === 'agence') return styles.agence
  if (tone === 'shop') return styles.shop
  if (tone === 'solo') return styles.solo
  return styles.saas
}

function StudioConsole({
  draft, pending, listening, talking, voicePlaying, a2fClip, lipClock, spoken, speakChunk, fileRef,
  setDraft, onTalk, onSubmit, onGenerate, onTemplates, onFile,
}: {
  draft: string
  pending: boolean
  channel: 'texte' | 'voix'
  listening: boolean
  talking: boolean
  voicePlaying: boolean
  a2fClip: import('@atlas/voice').MayaAceClip | null
  lipClock: LipSyncClock
  advanced: boolean
  spoken: string
  speakChunk: string
  fileRef: RefObject<HTMLInputElement | null>
  setDraft: (value: string) => void
  setAdvanced: (value: boolean) => void
  onChannel: (channel: 'texte' | 'voix') => void
  onTalk: () => void
  onSubmit: () => void
  onGenerate: () => void
  onTemplates: () => void
  onFile: (file: File) => void
}) {
  return (
    <div className={styles.voiceStage}>
      <p className={styles.voiceOnlyBadge} aria-label="Voice assistant">
        <Icon name="wave" /> Voice assistant
      </p>
      <div
        className={listening || talking || voicePlaying ? `${styles.reactor} ${styles.reactorLive}` : styles.reactor}
        role="button"
        tabIndex={0}
        aria-label={talking ? 'Send what I just said' : 'Talk to Atlas'}
        onClick={onTalk}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onTalk()
          }
        }}
      >
        <AceFace
          seed="Atlas"
          label="Atlas"
          speaking={voicePlaying}
          listening={listening || talking}
          speech={speakChunk || spoken}
          clip={a2fClip}
          lipClock={lipClock}
          size="hero"
        />
      </div>
      <p className={styles.atlasLine}>
        {listening ? 'Atlas is listening.' : talking ? 'Atlas is recording…' : 'Speak or type a command.'}
        {' '}{spoken}
      </p>
      <form
        className={styles.orderLine}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <input
          value={draft}
          aria-label="Command for Atlas"
          placeholder="Type a command here, or click the face to speak"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={pending || draft.trim().length < 2}>Run</button>
      </form>
      <input
        ref={fileRef}
        className={styles.file}
        type="file"
        accept=".txt,.md,.json,text/plain"
        aria-label="Fichier de description"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
      <div className={styles.voiceBootActions}>
        <button className={styles.quietAction} type="button" disabled={pending} onClick={onGenerate}>
          <Icon name="lock" /> Générer mon organisation
        </button>
        <button className={styles.quietAction} type="button" onClick={() => fileRef.current?.click()}>
          <Icon name="file" /> Importer
        </button>
        <button className={styles.quietAction} type="button" onClick={onTemplates}>
          <Icon name="layout" /> Modèle
        </button>
      </div>
    </div>
  )
}

function TemplateCard({ item, onPick }: { item: (typeof TEMPLATES)[number]; onPick: () => void }) {
  return (
    <button className={styles.template} type="button" onClick={onPick}>
      <span className={`${styles.tile} ${toneClass(item.tone)}`}><Icon name={item.icon} /></span>
      <strong>{item.title}</strong>
      <span>{item.detail}</span>
    </button>
  )
}

function Welcome({ console: panel }: { console: ReactNode }) {
  return (
    <div className={styles.welcome}>
      <p className={styles.kicker}><Icon name="spark" /> Studio</p>
      <h1>Qu’est-ce que tu veux confier à ton organisation ?</h1>
      <p className={styles.lead}>Talk to Atlas to describe the project and drive the studio. Nothing starts until you activate the team.</p>
      {panel}
    </div>
  )
}

function Operating({
  chart, agents, advanced, supportMissing, leader, meta, selectedId, deptDraft, adding, hire, console,
  cinematic, birth, glow, setDeptDraft, setAdding, setHire, setSelectedId, run,
}: {
  chart: Chart
  agents: Agent[]
  advanced: boolean
  supportMissing: boolean
  leader: string
  meta: OrgMeta
  selectedId: string | null
  deptDraft: string
  adding: boolean
  hire: { firstName: string; lastName: string; role: string; department: string }
  console: ReactNode
  cinematic?: boolean
  birth?: Record<string, 'init' | 'ready'>
  glow?: boolean
  setDeptDraft: (value: string) => void
  setAdding: (value: boolean | ((open: boolean) => boolean)) => void
  setHire: (value: { firstName: string; lastName: string; role: string; department: string }) => void
  setSelectedId: (id: string | null) => void
  run: (action: () => Promise<void>) => Promise<boolean>
}) {
  const model = businessModelLabel(meta.businessModel)
  return (
    <div className={`${cinematic ? styles.cinematic : ''} ${glow ? styles.glow : ''}`.trim()}>
      <div className={styles.boardHead}>
        <div>
          <h1>Organigramme</h1>
          <p>Construisez, visualisez et faites évoluer {chart.organization.name}{model ? ` · ${model}` : ''}{meta.sector ? ` · ${meta.sector}` : ''}.</p>
        </div>
        <div className={styles.choice}>
          <button className={styles.ghost} type="button" onClick={() => setAdding(true)}>Ajouter un employé</button>
        </div>
      </div>
      {supportMissing ? (
        <p className={styles.lead}>Suggestion : ajouter un agent support client ? <button className={styles.ghost} type="button" onClick={() => { setAdding(true); setHire({ ...hire, role: 'Support client', department: 'Marketing' }) }}>Préparer le poste</button></p>
      ) : null}
      {console}
      <p className={styles.lead}>{chart.organization.objective || chart.organization.intention || 'Intention enregistrée avec l’organisation.'} Une nouvelle phrase crée une organisation supplémentaire, elle ne réécrit pas celle-ci.</p>
      <div className={styles.ceoRow}><div className={styles.ceo}>{leader} · CEO</div></div>
      <div className={styles.columns}>
        {chart.departments.map((department) => {
          const members = agents.filter((agent) => agent.departmentId === department.id)
          const roots = members.filter((agent) => !agent.reportsToId || !members.some((item) => item.id === agent.reportsToId))
          return (
            <section key={department.id} className={`${styles.column} ${tone(department.name)}`}>
              <header>
                <strong>{department.name}</strong>
                <span>{members.length}</span>
                {members.length === 0 && !cinematic ? (
                  <button className={styles.quiet} type="button" aria-label={`Supprimer ${department.name}`} onClick={() => void run(async () => {
                    await call(`/v1/departments/${department.id}`, { method: 'DELETE' })
                  })}>×</button>
                ) : null}
              </header>
              {roots.map((agent) => (
                <AgentNode key={agent.id} agent={agent} members={members} selectedId={selectedId} depth={0} onSelect={setSelectedId} birth={birth} rich={cinematic} />
              ))}
            </section>
          )
        })}
      </div>
      <form className={styles.guide} onSubmit={(event) => {
        event.preventDefault()
        const name = deptDraft.trim()
        if (!name) return
        void run(async () => {
          await call('/v1/departments', { method: 'POST', body: JSON.stringify({ organizationId: chart.organization.id, name }) })
          setDeptDraft('')
        })
      }}>
        <label>Nouveau département<input value={deptDraft} placeholder="Support" onChange={(event) => setDeptDraft(event.target.value)} /></label>
      </form>
      {adding ? (
        <form className={styles.guide} onSubmit={(event) => {
          event.preventDefault()
          if (!hire.firstName.trim() || !hire.role.trim()) return
          const department = hire.department.trim() || chart.departments[0]?.name || 'Général'
          const firstName = hire.firstName.trim()
          const lastName = hire.lastName.trim() || 'Martin'
          const payload = staffingPayload(chart.organization.id, firstName, lastName, hire.role.trim(), department)
          void run(async () => {
            const hiredAgent = await call<Agent>('/v1/agents', {
              method: 'POST',
              body: JSON.stringify(payload),
            })
            rememberProfile(hiredAgent.id, {
              objectives: payload.objectives,
              toolIds: payload.toolIds,
              personality: { traits: payload.traits, tone: payload.tone, hours: payload.hours },
              avatar: { appearance: 'portrait', age: null, style: department.toLowerCase(), voiceId: payload.voiceId, face: payload.face },
            })
            setHire({ firstName: '', lastName: '', role: '', department: '' })
            setAdding(false)
          })
        }}>
          <h2>Nouvel employé</h2>
          <label>Prénom<input value={hire.firstName} onChange={(event) => setHire({ ...hire, firstName: event.target.value })} /></label>
          <label>Nom<input value={hire.lastName} onChange={(event) => setHire({ ...hire, lastName: event.target.value })} /></label>
          <label>Rôle<input value={hire.role} onChange={(event) => setHire({ ...hire, role: event.target.value })} /></label>
          <label>Département<input value={hire.department} onChange={(event) => setHire({ ...hire, department: event.target.value })} /></label>
          <button className={styles.primary} type="submit">Créer le poste</button>
        </form>
      ) : null}
      {advanced ? <p className={styles.lead}>Le modèle actif de l’organisation reste celui du gateway. Le choix d’un modèle différent par employé n’est pas encore séparé.</p> : null}
    </div>
  )
}

function AgentNode({ agent, members, selectedId, depth, onSelect, birth, rich }: { agent: Agent; members: Agent[]; selectedId: string | null; depth: number; onSelect: (id: string) => void; birth?: Record<string, 'init' | 'ready'>; rich?: boolean }) {
  const children = members.filter((item) => item.reportsToId === agent.id)
  const status = birth?.[agent.id]
  const online = status !== 'init'
  const label = status === 'init' ? 'Initialisation' : status === 'ready' ? 'En ligne' : agent.presence === 'working' ? 'Au travail' : 'En ligne'
  const skills = (agent.skills ?? []).slice(0, 3)
  const traits = (agent.personality?.traits ?? []).slice(0, 2)
  const tools = (agent.toolIds ?? []).slice(0, 3).map(connectorLabel)
  return (
    <div className={depth ? styles.child : undefined}>
      <button className={agent.id === selectedId ? styles.agentOn : styles.agentCard} type="button" onClick={() => onSelect(agent.id)}>
        <span className={`${styles.avatar} ${online ? styles.avatarLive : ''}`}>
          <AceFace
            seed={`${agent.firstName}-${agent.lastName}`}
            face={resolveAgentFace(agent.firstName, agent.lastName, agent.avatar?.face)}
            size="thumb"
            label={`${agent.firstName} ${agent.lastName}`}
          />
        </span>
        <span>
          <strong>{agent.firstName} {agent.lastName}</strong>
          <em>{agent.role}</em>
          <small className={`${styles.agentStatus} ${online ? styles.presenceOn : styles.presenceInit}`}>
            {online ? '🟢' : '⚪'} {label}
          </small>
          {rich ? (
            <span className={styles.agentBits}>
              {skills.map((item) => <span key={item} className={styles.chip}>{item}</span>)}
              {traits.map((item) => <span key={item} className={styles.chip}>{item}</span>)}
              {tools.map((item) => <span key={item} className={styles.chip}>{item}</span>)}
              <span className={styles.chip}>{delegationLabel(agent.delegation)}</span>
            </span>
          ) : null}
        </span>
      </button>
      {children.map((child) => <AgentNode key={child.id} agent={child} members={members} selectedId={selectedId} depth={depth + 1} onSelect={onSelect} birth={birth} rich={rich} />)}
    </div>
  )
}

function Inspector({
  chart, agent, advanced, tab, fiche, peer, chat, chatDraft, pending, runtimeModel, connectors, linkedProviders, documents,
  knowledgeAccess, setTab, setFiche, setPeer, setChatDraft, setSelectedId, onKnowledge, onOpenIntegrations, run, onChat,
}: {
  chart: Chart
  agent: Agent
  advanced: boolean
  tab: 'details' | 'permissions' | 'relations' | 'discussion'
  fiche: Fiche
  peer: string
  chat: ChatMessage[]
  chatDraft: string
  pending: boolean
  runtimeModel: string
  connectors: Connector[]
  linkedProviders: string[]
  documents: Doc[]
  knowledgeAccess: Record<string, string[]>
  setTab: (tab: 'details' | 'permissions' | 'relations' | 'discussion') => void
  setFiche: (value: Fiche) => void
  setPeer: (value: string) => void
  setChatDraft: (value: string) => void
  setSelectedId: (id: string | null) => void
  onKnowledge: (docId: string, agentIds: string[]) => void
  onOpenIntegrations: () => void
  run: (action: () => Promise<void>) => Promise<boolean>
  onChat: () => Promise<void>
}) {
  const tabs = advanced
    ? (['details', 'permissions', 'relations', 'discussion'] as const)
    : (['details', 'discussion'] as const)
  const face = resolveAgentFace(
    fiche.firstName.trim() || agent.firstName,
    fiche.lastName.trim() || agent.lastName,
    agent.avatar?.face,
  )
  const voiceId = fiche.voice.trim() || agentVoice(fiche.firstName.trim() || agent.firstName)
  return (
    <aside className={styles.inspector}>
      <div className={styles.choice}>
        <AceFace
          seed={`${fiche.firstName.trim() || agent.firstName}-${fiche.lastName.trim() || agent.lastName}`}
          face={face}
          size="card"
          label={`${agent.firstName} ${agent.lastName}`}
        />
        <strong>{agent.firstName} {agent.lastName}</strong>
        <button className={styles.quiet} type="button" aria-label="Fermer la fiche" onClick={() => setSelectedId(null)}>×</button>
      </div>
      <p>{agent.role} · {agent.personality?.tone || 'professionnel'} · {agent.avatar?.voiceId || 'Hortense'} · {agent.personality?.hours || '9h–18h'}</p>
      <div className={styles.tabs}>
        {tabs.map((item) => (
          <button key={item} className={tab === item ? styles.tabOn : undefined} type="button" onClick={() => setTab(item)}>
            {item === 'details' ? 'Détails' : item === 'permissions' ? 'Permissions' : item === 'relations' ? 'Relations' : 'Discussion'}
          </button>
        ))}
      </div>
      {tab === 'details' ? (
        <form onSubmit={(event) => {
          event.preventDefault()
          void run(async () => {
            const skills = fiche.skills.split(',').map((item) => item.trim()).filter(Boolean)
            const traits = fiche.traits.split(',').map((item) => item.trim()).filter(Boolean)
            await call(`/v1/agents/${agent.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                firstName: fiche.firstName.trim() || agent.firstName,
                lastName: fiche.lastName.trim() || agent.lastName,
                role: fiche.role,
                mission: fiche.mission,
                departmentName: fiche.department,
                reportsToId: fiche.reportsTo || null,
                skills,
                traits,
                tone: fiche.tone.trim() || undefined,
                hours: fiche.hours.trim() || undefined,
                toolIds: fiche.tools,
                objectives: agent.objectives,
                voiceId,
                face,
              }),
            })
            rememberProfile(agent.id, {
              firstName: fiche.firstName.trim() || agent.firstName,
              lastName: fiche.lastName.trim() || agent.lastName,
              objectives: agent.objectives,
              toolIds: fiche.tools,
              personality: {
                traits,
                tone: fiche.tone.trim() || undefined,
                hours: fiche.hours.trim() || undefined,
              },
              avatar: {
                appearance: agent.avatar?.appearance ?? 'portrait',
                age: agent.avatar?.age ?? null,
                style: agent.avatar?.style ?? 'enterprise',
                voiceId,
                face,
              },
            })
            documents.forEach((item) => {
              const readers = readersOf(item, knowledgeAccess)
              const should = fiche.knowledge.includes(item.id)
              const has = readers.includes(agent.id)
              if (should === has) return
              onKnowledge(item.id, should ? [...readers, agent.id] : readers.filter((id) => id !== agent.id))
            })
            const ceiling = Number(fiche.ceiling)
            const permissions = agent.permissions.filter((item) => item.action !== 'spend')
            if (Number.isFinite(ceiling) && ceiling > 0) {
              permissions.push({ action: 'spend', allowed: true, requiresApproval: true, spendLimit: ceiling })
            }
            await call(`/v1/agents/${agent.id}/permissions`, {
              method: 'PATCH',
              body: JSON.stringify({ delegation: fiche.delegation, permissions }),
            })
          })
        }}>
          <label className={styles.field}>Prénom<input value={fiche.firstName} onChange={(event) => setFiche({ ...fiche, firstName: event.target.value })} /></label>
          <label className={styles.field}>Nom<input value={fiche.lastName} onChange={(event) => setFiche({ ...fiche, lastName: event.target.value })} /></label>
          <label className={styles.field}>Rôle<input value={fiche.role} onChange={(event) => setFiche({ ...fiche, role: event.target.value })} /></label>
          <label className={styles.field}>Mission<textarea value={fiche.mission} onChange={(event) => setFiche({ ...fiche, mission: event.target.value })} /></label>
          {rememberedMemory(agent.id) ? <p className={styles.lead}>Mémoire de poste · {rememberedMemory(agent.id)}</p> : null}
          <label className={styles.field}>Département<input value={fiche.department} onChange={(event) => setFiche({ ...fiche, department: event.target.value })} /></label>
          <label className={styles.field}>Rattaché à
            <select value={fiche.reportsTo} onChange={(event) => setFiche({ ...fiche, reportsTo: event.target.value })}>
              <option value="">Vous</option>
              {chart.agents.filter((item) => item.id !== agent.id).map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
            </select>
          </label>
          <label className={styles.field}>Compétences<input value={fiche.skills} onChange={(event) => setFiche({ ...fiche, skills: event.target.value })} /></label>
          <label className={styles.field}>Personnalité<input value={fiche.traits} onChange={(event) => setFiche({ ...fiche, traits: event.target.value })} placeholder="analytique, créatif, prudent" /></label>
          <label className={styles.field}>Ton
            <select value={fiche.tone} onChange={(event) => setFiche({ ...fiche, tone: event.target.value })}>
              <option value="">Professionnel</option>
              <option value="formel">Formel</option>
              <option value="direct">Direct</option>
              <option value="pédagogique">Pédagogique</option>
              <option value="chaleureux">Chaleureux</option>
            </select>
          </label>
          <label className={styles.field}>Voix
            <select value={fiche.voice} onChange={(event) => setFiche({ ...fiche, voice: event.target.value })}>
              <option value="Hortense">Hortense</option>
              <option value="Henri">Henri</option>
            </select>
          </label>
          <label className={styles.field}>Horaires<input value={fiche.hours} onChange={(event) => setFiche({ ...fiche, hours: event.target.value })} placeholder="9h–18h, lundi–vendredi" /></label>
          <p>Autonomie</p>
          <div className={styles.choice}>
            {(['approval', 'autonomous', 'restricted'] as const).map((level) => (
              <button key={level} className={fiche.delegation === level ? styles.primary : styles.ghost} type="button" onClick={() => setFiche({ ...fiche, delegation: level })}>{delegationLabel(level)}</button>
            ))}
          </div>
          <label className={styles.field}>Budget — ne jamais dépenser plus de (€) sans me demander
            <input value={fiche.ceiling} inputMode="numeric" placeholder="500" onChange={(event) => setFiche({ ...fiche, ceiling: event.target.value })} />
          </label>
          <p>Outils du poste — reliez-les dans Intégrations, puis assignez l’accès à cet agent.</p>
          {linkedProviders.length === 0 ? (
            <p className={styles.lead}>Aucun outil connecté. <button className={styles.ghost} type="button" onClick={onOpenIntegrations}>Ouvrir Intégrations</button></p>
          ) : (
            <ul className={styles.perms}>
              {connectors.filter((item) => linkedProviders.includes(item.provider)).map((item) => {
                const on = fiche.tools.includes(item.provider)
                return (
                  <li key={item.provider}>
                    <label>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setFiche({
                          ...fiche,
                          tools: on ? fiche.tools.filter((tool) => tool !== item.provider) : [...fiche.tools, item.provider],
                        })}
                      />
                      {item.label}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {(agent.objectives ?? []).length ? (
            <div>
              <p>Objectifs</p>
              <ul className={styles.perms}>
                {(agent.objectives ?? []).map((item) => (
                  <li key={item.id}>{item.label}{item.target ? ` · ${item.target}` : ''}{item.metric ? ` ${item.metric}` : ''}{item.dueAt ? ` · ${item.dueAt}` : ''}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>Sources de connaissance</p>
          {documents.length === 0 ? <p className={styles.lead}>Aucun document. Importez-en dans Connaissances.</p> : (
            <ul className={styles.perms}>
              {documents.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={fiche.knowledge.includes(item.id)}
                      onChange={() => setFiche({
                        ...fiche,
                        knowledge: fiche.knowledge.includes(item.id)
                          ? fiche.knowledge.filter((id) => id !== item.id)
                          : [...fiche.knowledge, item.id],
                      })}
                    />
                    {item.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p>Mémoire : conversation individuelle dans Discussion. Dossier partagé : {documents.filter((item) => fiche.knowledge.includes(item.id)).map((item) => item.name).join(', ') || 'aucun document ouvert à cet employé'}.</p>
          <p>Modèle de l’employé : Nemotron (NVIDIA). {runtimeModel ? `Organisation : ${runtimeModel}.` : null}</p>
          <div className={styles.choice}>
            <button className={styles.primary} type="submit" disabled={pending}>Enregistrer</button>
            <button className={styles.danger} type="button" onClick={() => void run(async () => {
              await call(`/v1/agents/${agent.id}`, { method: 'DELETE' })
              setSelectedId(null)
            })}>Retirer</button>
          </div>
        </form>
      ) : null}
      {tab === 'permissions' && advanced ? (
        <ul className={styles.perms}>
          {PERMISSIONS.map((item) => {
            const granted = agent.permissions.some((permission) => permission.action === item.action && permission.allowed)
            return (
              <li key={item.action}>
                <label>
                  <input type="checkbox" checked={granted} onChange={() => void run(async () => {
                    const permissions = granted
                      ? agent.permissions.filter((permission) => permission.action !== item.action)
                      : [...agent.permissions, { action: item.action, allowed: true, requiresApproval: false, spendLimit: null }]
                    await call(`/v1/agents/${agent.id}/permissions`, {
                      method: 'PATCH',
                      body: JSON.stringify({ delegation: agent.delegation, permissions }),
                    })
                  })} />
                  {item.label}
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}
      {tab === 'relations' && advanced ? (
        <div>
          <label className={styles.field}>Collaboration
            <select value={peer} onChange={(event) => setPeer(event.target.value)}>
              <option value="">Choisir un employé</option>
              {chart.agents.filter((item) => item.id !== agent.id).map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
            </select>
          </label>
          <button className={styles.primary} type="button" disabled={!peer || pending} onClick={() => void run(async () => {
            await call('/v1/relations', {
              method: 'POST',
              body: JSON.stringify({ organizationId: chart.organization.id, fromAgentId: agent.id, toAgentId: peer }),
            })
            setPeer('')
          })}>Relier</button>
          <ul className={styles.perms}>
            {chart.relations.filter((relation) => relation.fromAgentId === agent.id || relation.toAgentId === agent.id).map((relation) => {
              const otherId = relation.fromAgentId === agent.id ? relation.toAgentId : relation.fromAgentId
              const other = chart.agents.find((item) => item.id === otherId)
              return (
                <li key={relation.id}>
                  {other ? `${other.firstName} ${other.lastName}` : 'Employé'}
                  <button className={styles.ghost} type="button" onClick={() => void run(async () => {
                    await call(`/v1/relations/${relation.id}`, { method: 'DELETE' })
                  })}>Retirer</button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      {tab === 'discussion' ? (
        <div>
          <div className={styles.thread}>
            {chat.length === 0 ? <p>Aucun message. Écrivez la première demande.</p> : chat.map((message) => (
              <p key={message.id} className={message.authorId === userId() ? styles.mine : styles.theirs}>{message.body}</p>
            ))}
          </div>
          <form className={styles.stack} onSubmit={(event) => { event.preventDefault(); void onChat() }}>
            <label className={styles.field}>Message
              <textarea value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} />
            </label>
            <button className={styles.primary} type="submit" disabled={pending || chatDraft.trim().length < 1}>Envoyer</button>
          </form>
        </div>
      ) : null}
    </aside>
  )
}
