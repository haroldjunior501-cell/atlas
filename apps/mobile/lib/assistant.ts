import { speechLang } from '@atlas/domain'
import { askCloud, studioUp, type CloudPack } from './speech-cloud'
import { webOrigin } from './config'
import { needsComputer, offlinePcReply, rememberPcOrder, restorePcOrders, takePcOrders } from './pc-queue'
import { currentUserId } from './session'
import { fetchOrgBrief } from './api'
import { boardFromReply, guessSkill, type AgentStep, type SkillBoard, type SkillKind } from './skills'

export type PilotResult = {
  ok: boolean
  reply: string
  source?: string
  studio?: boolean
  action?: { kind: string; provider?: string; tool?: string; view?: string; op?: string }
  board?: SkillBoard
  pack?: CloudPack
}

type Turn = { role: 'user' | 'atlas'; text: string }
const thread: Turn[] = []

/** Fil de la conversation, comme sur le Studio. */
export function noteTurn(role: Turn['role'], text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  if (!line || line === 'Thinking…') return
  thread.push({ role, text: line.slice(0, 1400) })
  if (thread.length > 18) thread.splice(0, thread.length - 18)
}

function threadMemory() {
  if (!thread.length) return ''
  return `Fil de conversation — continue ce fil, réponds à la dernière demande en tenant compte du contexte :\n${thread.map((turn) => `${turn.role}: ${turn.text}`).join('\n')}`
}

/** Uniquement les ordres d’exécution UI/PC (pas la conversation). */
export function isExecAction(text: string) {
  const heard = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/plein\s*ecran|fullscreen|bureau\s*3d|jumeau\s*3d/.test(heard)) return true
  if (/(ouvre|ouvrir|lance|bascule|va sur|passe (?:sur|en)|quitte|ferme).{0,40}(bureau|organigramme|factur|mission|employ|integration|observ|reunion|approbation|studio|site|ztchosting|boutique|espace client|navigateur|chrome|edge)/.test(heard)) {
    return true
  }
  if (/sur (le |l')?(pc|ordinateur).{0,30}(ouvre|lance|ferme)/.test(heard)) return true
  return false
}

export function wantsOrgBrief(text: string) {
  const heard = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  return /(presente|presenter|presente[- ]moi|montre[- ]moi|parle[- ]moi|explique|decrit|resume|brief|bilan|etat|point).{0,40}(organisation|org\b|ztc|ztchosting|equipe|agents?|employes?)/.test(heard)
    || /(organisation|ztchosting|equipe).{0,20}(c'?est quoi|qui (?:est|sont)|comment)/.test(heard)
    || /qui (?:travaille|est en poste)/.test(heard)
}

async function pilotOnStudio(
  text: string,
  organizationId?: string | null,
  name?: string,
  memory?: string,
  timeoutMs = 18000,
): Promise<PilotResult | null> {
  const userId = await currentUserId()
  try {
    const response = await fetch(`${webOrigin}/api/atlas/mobile-pilot`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(userId ? { 'x-atlas-user': userId } : {}),
      },
      body: JSON.stringify({
        text,
        organizationId: organizationId || null,
        name: name || '',
        memory: memory || '',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = (await response.json().catch(() => ({}))) as PilotResult & { error?: string }
    if (!body.reply?.trim()) return null
    return {
      ok: Boolean(body.ok ?? true),
      reply: body.reply.trim(),
      action: body.action,
      source: body.source,
      studio: Boolean(body.studio) || body.source === 'studio-remote',
    }
  } catch {
    return null
  }
}

let flushing = false

export async function flushPcOrders(name?: string): Promise<string | null> {
  if (flushing) return null
  flushing = true
  try {
    const orders = await takePcOrders()
    if (!orders.length) return null
    if (!(await studioUp())) {
      await restorePcOrders(orders)
      return null
    }
    const replies: string[] = []
    const failed: string[] = []
    for (const order of orders) {
      try {
        const result = await pilotOnStudio(order, null, name, threadMemory(), 20000)
        if (result?.reply) replies.push(result.reply)
        else failed.push(order)
      } catch {
        failed.push(order)
      }
    }
    if (failed.length) await restorePcOrders(failed)
    return replies.join(' ') || null
  } finally {
    flushing = false
  }
}

/**
 * Atlas mobile : répond toujours clairement.
 * 1) Exécute les actions Studio/PC si demandé
 * 2) Brief org ZtcHosting
 * 3) Conversation intelligente (cloud) sinon
 */
export async function askAtlas(
  message: string,
  organizationId?: string | null,
  name?: string,
  extras?: { image?: string; skill?: SkillKind | null; context?: string },
): Promise<PilotResult> {
  const trimmed = message.trim()
  if (trimmed.length < 2) throw new Error('Écris un ordre pour Atlas.')

  const memory = [extras?.context, threadMemory()].filter(Boolean).join('\n')
  const userOnly = trimmed.split('\n\nMessage :').pop()?.trim() || trimmed
  noteTurn('user', userOnly)

  // Ne pas laisser un ancien skill « voice » pourrir le routage
  const kind = (extras?.skill === 'voice' ? null : extras?.skill) || guessSkill(userOnly, Boolean(extras?.image))
  const exec = isExecAction(userOnly) && !extras?.image
  const orgBrief = wantsOrgBrief(userOnly)

  const hello = helloReply(userOnly)
  if (hello) {
    noteTurn('atlas', hello)
    return { ok: true, reply: hello, board: boardFromReply('document', 'Salut', hello), source: 'local' }
  }
  const intro = introReply(userOnly)
  if (intro) {
    noteTurn('atlas', intro)
    return { ok: true, reply: intro, board: boardFromReply('document', 'Atlas', intro), source: 'local' }
  }

  // Brief org en premier — sans attendre le pilot / Studio (rapide + cohérent)
  if (orgBrief && !extras?.image) {
    try {
      const brief = await fetchOrgBrief()
      if (brief?.trim()) {
        noteTurn('atlas', brief.trim())
        return {
          ok: true,
          reply: brief.trim(),
          source: 'mobile-org',
          action: { kind: 'answer' },
          board: boardFromReply('document', 'Organisation ZtcHosting', brief.trim()),
        }
      }
    } catch { /* fallback local / cloud */ }
    const offline = ztcOrgFallback()
    noteTurn('atlas', offline)
    return {
      ok: true,
      reply: offline,
      source: 'local',
      action: { kind: 'answer' },
      board: boardFromReply('document', 'Organisation ZtcHosting', offline),
    }
  }

  // File PC en arrière-plan (ne bloque pas la conversation)
  const caughtUpPromise = flushPcOrders(name)
  const onComputer = needsComputer(userOnly) && !extras?.image
  const needsPilot = (exec || onComputer) && !extras?.image

  let studioResult: PilotResult | null = null
  if (needsPilot && await studioUp()) {
    studioResult = await pilotOnStudio(userOnly, organizationId, name, '', 14000)
    if (studioResult?.reply && !isShrug(studioResult.reply) && !isLeaked(studioResult.reply)) {
      const done =
        studioResult.studio
        || studioResult.source === 'studio-remote'
        || studioResult.source === 'desktop-site'
        || studioResult.source === 'mobile-org'
        || studioResult.ok
      if (done) {
        const caughtUp = await caughtUpPromise
        const reply = caughtUp ? `${caughtUp} ${studioResult.reply}` : studioResult.reply
        noteTurn('atlas', reply)
        return {
          ...studioResult,
          reply,
          board: boardFromReply(kind || 'document', titleFor(kind), reply),
        }
      }
    }
    if (onComputer && !studioResult?.ok) await rememberPcOrder(userOnly)
  } else if (onComputer) {
    await rememberPcOrder(userOnly)
  }

  // Conversation libre : cloud seulement (pas Jarvis / pilot — trop lent et confus)
  const pack = await askCloud(userOnly, name, memory, extras?.image).catch(() => ({ reply: '' } as CloudPack))
  const caughtUp = await caughtUpPromise

  const cloudReply = pack.reply && !isShrug(pack.reply) && !isLeaked(pack.reply) ? pack.reply.trim() : ''
  const spoken = cloudReply
    || (onComputer ? offlinePcReply(userOnly) : '')
    || caughtUp
    || localFallback(userOnly, kind)

  const written = pack.board?.body && !isLeaked(pack.board.body) && pack.board.body.length > spoken.length
    ? pack.board.body.trim()
    : spoken

  noteTurn('atlas', written)
  const boardKind = (pack.board?.kind as SkillKind | undefined) || kind || 'document'
  const steps: AgentStep[] | undefined = pack.steps
    ?.filter((step) => step.label)
    .map((step) => ({
      label: String(step.label),
      status: step.status === 'ok' ? 'ok' : step.status === 'err' ? 'err' : 'run',
      detail: step.detail,
    }))
  const board = pack.board?.body
    ? boardFromReply(boardKind, pack.board.title || titleFor(boardKind), pack.board.body, steps)
    : boardFromReply(boardKind, titleFor(boardKind), spoken, steps)

  return {
    ok: true,
    reply: spoken,
    board,
    pack,
    action: studioResult?.action,
    studio: studioResult?.studio,
    source: cloudReply ? 'cloud' : (studioResult?.source || 'local'),
  }
}

function titleFor(kind?: SkillKind | null) {
  if (kind === 'lesson') return 'Cours'
  if (kind === 'day') return 'Ta journée'
  if (kind === 'scan') return 'Analyse visuelle'
  if (kind === 'code') return 'Code'
  if (kind === 'search') return 'Recherche'
  if (kind === 'plan') return 'Plan d’actions'
  return 'Réponse'
}

function isShrug(reply: string) {
  return /^(je t['’]écoute\.?|i am listening\.?|d['’]accord\.?|ok\.?)$/i.test(reply.trim())
    || /je t['’]écoute\.?\s*$/i.test(reply.trim())
}

function isLeaked(reply: string) {
  return /section actuelle|l['’]élève t['’]envoie|professeur exigeant|le pc est éteint.{0,40}l['’]utilisateur s['’]appelle|board\.kind|CLOUD_SYSTEM/i.test(reply)
}

function helloReply(text: string) {
  if (!/^(salut|bonjour|hello|hey|coucou|bonsoir|hi)([ !?.]|$)/i.test(text.trim())) return ''
  if (speechLang(text).startsWith('fr')) {
    return 'Salut. Je suis Atlas. Dis-moi ce que tu veux — je réponds clairement et j’exécute sur ton Studio et ton PC.'
  }
  return "Hi. I'm Atlas. Tell me what you need — I'll answer clearly and run it on your Studio and PC."
}

function introReply(text: string) {
  if (!/^(pr[eé]sente[- ]?toi|te pr[eé]senter|qui es[- ]tu|tu es qui|who are you|introduce yourself)([ !?.]|$)/i.test(text.trim())
    && !/\b(pr[eé]sente[- ]?toi|qui es[- ]tu)\b/i.test(text)) {
    // Ne pas confondre avec « présente mon organisation »
    if (/pr[eé]sente.{0,12}(mon |notre |l['’])?(organisation|equipe|ztc)/i.test(text)) return ''
    if (!/\b(qui es[- ]tu|tu es qui|who are you|pr[eé]sente[- ]toi)\b/i.test(text)) return ''
  }
  if (/pr[eé]sente.{0,12}(mon |notre |l['’])?(organisation|equipe|ztc)/i.test(text)) return ''
  if (speechLang(text).startsWith('fr')) {
    return 'Je suis Atlas, ton assistante ATLAS. Je réponds clairement, et je pilote ton Studio et ton ordinateur quand ils sont allumés.'
  }
  return 'I am Atlas, your ATLAS assistant. I answer clearly and I control your Studio and computer when they are on.'
}

function ztcOrgFallback() {
  return [
    'Here is your ZtcHosting organization: web hosting, domains, billing, and a team of AI employees.',
    'On mobile, open Organization to see the agents and talk to them.',
    'On the PC Studio: 3D Desk, invoices, missions. Say "open the site" to open ztchosting.com on your computer.',
  ].join(' ')
}

function localFallback(text: string, kind?: SkillKind | null) {
  if (wantsOrgBrief(text)) return ztcOrgFallback()
  if (kind === 'lesson') return 'Send me your lesson or an exercise — I’ll explain it clearly, step by step.'
  if (isExecAction(text)) {
    return "I couldn't reach the Studio to run that. Start the Studio on the PC, then try again."
  }
  return "I'm here. Rephrase your request in one clear sentence — I'll answer right away."
}

export function atlasFaceEmbedUrl() {
  return `${webOrigin}/embed/atlas-face`
}
