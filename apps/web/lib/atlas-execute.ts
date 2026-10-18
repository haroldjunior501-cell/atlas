/**
 * Couche d’exécution : affine toute action pour coller à la demande réelle.
 * Les regex locales sont des raccourcis ; elles ne doivent jamais exécuter
 * à côté de l’intention (mauvais nom de fichier, commande écrite dans le corps, etc.).
 */
import {
  detectExtractFocus,
  detectTransformOp,
  extractSaveAs,
  extractSourceFile,
  isExtractRequest,
  isTransformRequest,
} from '@/lib/atlas-docwork'
import { interpretAtlas, type AtlasAction } from '@/lib/atlas-voice'

function asObject(input: string): Record<string, unknown> | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
}

function looksLikeUserCommand(value: string, heard: string): boolean {
  const a = value.replace(/\s+/g, ' ').trim().toLowerCase()
  const b = heard.replace(/\s+/g, ' ').trim().toLowerCase()
  if (!a) return false
  if (a === b) return true
  if (b.includes(a) && a.length > 12) return true
  if (/(?:cr[eé]e|cr[eé]er|ouvre|ouvrir|envoie|lis|lie|norme|nomme)\b/i.test(a) && a.length < 120) return true
  return false
}

/** Reconstruit les args d’un invoke à partir de la demande, sans y coller la phrase brute. */
export function refineInvokeInput(heard: string, provider: string, tool: string, input: string): string {
  const local = interpretAtlas(heard)
  // Si le routeur local a un invoke plus propre pour la même famille d’outils, on le prend
  if (local.kind === 'invoke' && local.provider === provider) {
    const localTool = local.tool.toLowerCase()
    const want = tool.toLowerCase()
    if (localTool === want || localTool.includes(want) || want.includes(localTool)) {
      return local.input
    }
  }

  const parsed = asObject(input) ?? {}
  const toolL = tool.toLowerCase()

  if (provider === 'filesystem' && /write_document/i.test(toolL)) {
    if (local.kind === 'invoke' && local.tool === 'write_document') {
      return local.input
    }
    const title = String(parsed.title || parsed.name || parsed.filename || '').trim()
    const body = String(parsed.body ?? parsed.content ?? parsed.message ?? '')
    const mode = String(parsed.mode || 'replace')
    return JSON.stringify({
      title: title && !looksLikeUserCommand(title, heard) ? title : 'Note ATLAS',
      body,
      mode,
      open: parsed.open !== false,
    })
  }

  if (provider === 'filesystem' && /create_document/i.test(toolL)) {
    if (local.kind === 'invoke' && local.tool === 'create_document') {
      return local.input
    }
    if (local.kind === 'invoke' && local.tool === 'write_document') {
      return local.input
    }
    const title = String(parsed.title || parsed.name || parsed.filename || '').trim()
    let body = Object.prototype.hasOwnProperty.call(parsed, 'body')
      ? String(parsed.body ?? '')
      : Object.prototype.hasOwnProperty.call(parsed, 'content')
        ? String(parsed.content ?? '')
        : ''
    if (looksLikeUserCommand(body, heard) || looksLikeUserCommand(String(parsed.text || ''), heard)) {
      body = ''
    }
    const safeTitle = title && !looksLikeUserCommand(title, heard) ? title : 'Note ATLAS'
    return JSON.stringify({ title: safeTitle, body, open: parsed.open !== false })
  }

  // Ne jamais passer la phrase utilisateur brute comme seul input JSON-outil
  if (!input.trim().startsWith('{') && looksLikeUserCommand(input, heard)) {
    if (local.kind === 'invoke') return local.input
  }

  if (parsed && looksLikeUserCommand(String(parsed.body || ''), heard)) {
    return JSON.stringify({ ...parsed, body: '' })
  }

  return input
}

/**
 * Affine une action avant exécution.
 * - Réécrit les args invoke (fichiers, etc.)
 * - Remonte une intention locale plus précise si le LLM a renvoyé un answer vague
 */
export function refineAtlasAction(heard: string, action: AtlasAction): AtlasAction {
  const text = heard.trim()
  if (!text) return action

  const local = interpretAtlas(text)

  // LLM / fallback « answer » alors que le local sait exécuter → on exécute
  if (action.kind === 'answer' || action.kind === 'listen') {
    if (local.kind !== 'answer' && local.kind !== 'listen' && local.kind !== 'compose') {
      return refineAtlasAction(text, local)
    }
  }

  if (action.kind === 'invoke') {
    return {
      ...action,
      input: refineInvokeInput(text, action.provider, action.tool, action.input),
    }
  }

  // Remonter extract/transform si le LLM a raté l’intent documentaire
  if ((action.kind === 'draft' || action.kind === 'code' || action.kind === 'answer')
    && (isExtractRequest(text) || isTransformRequest(text))) {
    if (local.kind === 'extract' || local.kind === 'transform') return local
  }

  // Site web : prioriser le parseur local (format website)
  if ((action.kind === 'answer' || action.kind === 'draft')
    && local.kind === 'draft' && local.format === 'website') {
    return local
  }

  if (action.kind === 'extract') {
    return {
      kind: 'extract',
      focus: action.focus || detectExtractFocus(text),
      ask: action.ask || text,
      source: action.source || extractSourceFile(text) || undefined,
      saveAs: action.saveAs || extractSaveAs(text) || undefined,
    }
  }
  if (action.kind === 'transform') {
    return {
      kind: 'transform',
      op: action.op || detectTransformOp(text),
      ask: action.ask || text,
      source: action.source || extractSourceFile(text) || undefined,
      saveAs: action.saveAs || extractSaveAs(text) || undefined,
    }
  }

  return action
}

/**
 * Fusionne routeur local + directive LLM.
 * Règle : l’intention exécutable précise gagne ; le studio/compose ne vole pas une action outil.
 */
export function resolveAtlasAction(
  heard: string,
  local: AtlasAction,
  directed: AtlasAction | null | undefined,
): AtlasAction {
  const llm = directed ?? null

  // Actions « dures » locales : on ne laisse pas le LLM les écraser
  if (
    local.kind === 'compose'
    || local.kind === 'clear_org'
    || local.kind === 'approve'
    || local.kind === 'reject'
    || local.kind === 'mode'
    || local.kind === 'navigate'
    || local.kind === 'orchestrate'
    || local.kind === 'space'
    || local.kind === 'room'
    || local.kind === 'equip'
    || local.kind === 'follow'
    || local.kind === 'crew'
    || local.kind === 'home'
    || local.kind === 'brief'
    || local.kind === 'team'
    || local.kind === 'tasks'
    || local.kind === 'pitch'
  ) {
    return refineAtlasAction(heard, local)
  }

  // Local sait exécuter (mail, invoke, search…) → base locale, affinable
  if (local.kind !== 'listen' && local.kind !== 'answer') {
    // LLM propose la même famille avec de meilleurs args JSON → préférer LLM puis refine
    if (
      llm
      && llm.kind === local.kind
      && (llm.kind !== 'invoke' || (llm.kind === 'invoke' && local.kind === 'invoke'
        && llm.provider === local.provider))
    ) {
      return refineAtlasAction(heard, llm)
    }
    return refineAtlasAction(heard, local)
  }

  // Local indécis → LLM, sinon answer
  if (llm && llm.kind !== 'listen') {
    // Empêcher le LLM de recréer une orga quand l’utilisateur demande un outil
    if (llm.kind === 'compose' && /fichier|mail|calendrier|ouvre|lance|note|document/i.test(heard)) {
      const again = interpretAtlas(heard)
      if (again.kind !== 'compose' && again.kind !== 'listen') return refineAtlasAction(heard, again)
    }
    return refineAtlasAction(heard, llm)
  }

  return refineAtlasAction(heard, local.kind === 'listen' ? { kind: 'answer', text: heard } : local)
}

/** True si on doit interroger le LLM (pas seulement les regex). */
export function shouldConsultLlm(local: AtlasAction, heard: string): boolean {
  if (local.kind === 'listen' || local.kind === 'answer') return true
  // Invoke avec input non-JSON ou corps = commande → laisser une chance au LLM
  if (local.kind === 'invoke') {
    const raw = local.input.trim()
    if (!raw.startsWith('{')) return true
    try {
      const parsed = JSON.parse(raw) as { body?: string; title?: string }
      if (parsed.body && looksLikeUserCommand(String(parsed.body), heard)) return true
      if (parsed.title === 'Note ATLAS' && /nomm|norme|appel/i.test(heard)) return true
    } catch {
      return true
    }
  }
  // Questions ouvertes même si un motif faible a matché
  if (/[?]/.test(heard) && (local.kind === 'compose' || local.kind === 'mission')) return true
  return false
}
