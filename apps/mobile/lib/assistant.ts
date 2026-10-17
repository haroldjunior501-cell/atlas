import { speechLang } from '@atlas/domain'
import { askCloud, studioUp, type CloudPack } from './speech-cloud'
import { webOrigin } from './config'
import { needsComputer, offlinePcReply, rememberPcOrder, restorePcOrders, takePcOrders } from './pc-queue'
import { currentUserId } from './session'
import { boardFromReply, guessSkill, type AgentStep, type SkillBoard, type SkillKind } from './skills'

export type PilotResult = {
  ok: boolean
  reply: string
  source?: string
  action?: { kind: string; provider?: string; tool?: string }
  board?: SkillBoard
  pack?: CloudPack
}

type Turn = { role: 'user' | 'atlas'; text: string }
const thread: Turn[] = []

/** Fil de la conversation, comme sur le Studio. */
export function noteTurn(role: Turn['role'], text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  if (!line || line === 'Je réfléchis.') return
  thread.push({ role, text: line.slice(0, 2200) })
  if (thread.length > 24) thread.splice(0, thread.length - 24)
}

function threadMemory() {
  if (!thread.length) return ''
  return `Fil de conversation — continue ce fil, ne le coupe pas, réponds à la dernière phrase en tenant compte de tout ce qui précède :\n${thread.map((turn) => `${turn.role}: ${turn.text}`).join('\n')}`
}

async function pilotOnStudio(
  text: string,
  organizationId?: string | null,
  name?: string,
  memory?: string,
): Promise<PilotResult | null> {
  const userId = await currentUserId()
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
    signal: AbortSignal.timeout(16000),
  })
  const body = (await response.json().catch(() => ({}))) as PilotResult & { error?: string }
  if (!body.reply) return null
  return { ok: Boolean(body.ok), reply: body.reply, action: body.action, source: body.source }
}

let flushing = false

/** Exécute les ordres PC gardés pendant qu'il était éteint. */
export async function flushPcOrders(name?: string): Promise<string | null> {
  if (flushing) return null
  flushing = true
  try {
    if (!(await studioUp())) return null
    const orders = await takePcOrders()
    if (!orders.length) return null
    const replies: string[] = []
    const failed: string[] = []
    for (const order of orders) {
      try {
        const result = await pilotOnStudio(order, null, name, threadMemory())
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
 * Pilote la machine hôte quand elle est allumée.
 * Un PC sans courant ne peut rien exécuter : l'ordre est gardé, puis lancé au rallumage.
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
  const caughtUp = await flushPcOrders(name)
  const kind = extras?.skill || guessSkill(userOnly, Boolean(extras?.image))

  const onComputer = needsComputer(userOnly) && !extras?.image
  const wantDepth = kind === 'lesson' || kind === 'document' || kind === 'code' || kind === 'search' || kind === 'scan' || kind === 'plan' || kind === 'voice'
  let studioReply = ''
  if (!extras?.image && await studioUp()) {
    try {
      const result = await pilotOnStudio(userOnly, organizationId, name, memory)
      if (result && !isShrug(result.reply) && !wantDepth) {
        if (caughtUp) result.reply = `${caughtUp} ${result.reply}`
        noteTurn('atlas', result.reply)
        return {
          ...result,
          board: boardFromReply(kind || 'document', titleFor(kind), result.reply),
        }
      }
      studioReply = result?.reply || ''
    } catch { /* le téléphone répond seul */ }
  }

  if (onComputer) await rememberPcOrder(userOnly)

  const pack = await askCloud(userOnly, name, memory, extras?.image)
  const cloudReply = pack.reply && !isShrug(pack.reply) && !isLeaked(pack.reply) ? pack.reply : ''
  const spoken = cloudReply
    || helloReply(userOnly, extras?.skill)
    || introReply(userOnly)
    || (studioReply && !isShrug(studioReply) && !isLeaked(studioReply) ? studioReply : '')
    || (onComputer ? offlinePcReply(userOnly) : '')
    || caughtUp
    || (extras?.skill === 'lesson'
      ? 'Salut. Envoie-moi ton cours ou un exercice, je te l’explique clairement, étape par étape.'
      : 'Je suis là. Dis-moi ce que tu veux, je te réponds.')
  const written = pack.board?.body && !isLeaked(pack.board.body) && pack.board.body.length > spoken.length ? pack.board.body : spoken
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
  return { ok: true, reply: spoken, board, pack }
}

function titleFor(kind?: SkillKind | null) {
  if (kind === 'lesson') return 'Cours'
  if (kind === 'day') return 'Ta journée'
  if (kind === 'scan') return 'Analyse visuelle'
  if (kind === 'code') return 'Code'
  if (kind === 'search') return 'Recherche'
  if (kind === 'plan') return 'Plan d’actions'
  if (kind === 'voice') return 'Note vocale'
  return 'Document'
}

function isShrug(reply: string) {
  return /je t['’]écoute|i am listening|estoy escuchando|ich höre zu/i.test(reply)
}

function isLeaked(reply: string) {
  return /section actuelle|l['’]élève t['’]envoie|professeur exigeant|le pc est éteint.{0,40}l['’]utilisateur s['’]appelle|message :/i.test(reply)
}

function helloReply(text: string, skill?: SkillKind | null) {
  if (!/^(salut|bonjour|hello|hey|coucou|bonsoir)\b/i.test(text.trim())) return ''
  if (skill === 'lesson') return 'Salut ! Envoie-moi ton cours, un énoncé ou une question, je t’explique clairement.'
  if (skill === 'code') return 'Salut ! Colle le code ou décris le projet, je m’en occupe.'
  if (skill === 'day') return 'Salut ! Dis-moi ta journée, je t’aide à l’organiser.'
  return 'Salut ! Dis-moi ce que tu veux faire.'
}

function introReply(text: string) {
  if (!/pr[eé]sente[- ]?toi|te pr[eé]senter|qui es[- ]tu|tu es qui|who are you|introduce yourself|pres[eé]ntate|ton nom/i.test(text)) {
    return ''
  }
  if (speechLang(text).startsWith('en')) {
    return 'I am Atlas, your partner. I answer you, and I act on your computer when it is on. Tell me what you need.'
  }
  return 'Je suis Atlas, ton partenaire de vie et de travail. Je te réponds, et j’agis sur ton ordinateur quand il est allumé. Dis-moi ce que tu veux.'
}

export function atlasFaceEmbedUrl() {
  return `${webOrigin}/embed/atlas-face`
}
