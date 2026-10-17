/**
 * Continuité de conversation — garde le fil entre les demandes
 * (dernier fichier, dernière app, dernières actions).
 */

export type SessionTurn = {
  role: 'user' | 'atlas'
  text: string
  at: number
}

export type SessionContext = {
  lastFile?: string
  lastFolder?: 'documents' | 'desktop' | 'downloads'
  lastApp?: string
  lastProvider?: string
  lastTool?: string
  lastTitle?: string
  turns: SessionTurn[]
}

export function createSessionContext(): SessionContext {
  return { turns: [] }
}

export function pushSessionTurn(ctx: SessionContext, role: SessionTurn['role'], text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  if (!line) return
  ctx.turns = [...ctx.turns.slice(-11), { role, text: line.slice(0, 400), at: Date.now() }]
}

/** Enregistre le résultat d’une action pour les suites (« écris dedans », « le fichier », …). */
export function rememberSessionAction(
  ctx: SessionContext,
  action: { kind: string; provider?: string; tool?: string; input?: string; label?: string },
  result?: string,
) {
  if (action.kind === 'invoke' && action.provider && action.tool) {
    ctx.lastProvider = action.provider
    ctx.lastTool = action.tool
    const parsed = safeJson(action.input)
    const title = String(parsed?.title || parsed?.name || parsed?.filename || '').trim()
    if (title) {
      ctx.lastFile = title.replace(/\.(txt|md)$/i, '')
      ctx.lastTitle = ctx.lastFile
      ctx.lastFolder = 'documents'
    }
    if (action.tool === 'open_app' && action.input) {
      ctx.lastApp = action.input.trim()
    }
    if (parsed?.folder && typeof parsed.folder === 'string') {
      const folder = parsed.folder.toLowerCase()
      if (folder === 'desktop' || folder === 'downloads' || folder === 'documents') {
        ctx.lastFolder = folder
      }
    }
  }
  if (action.kind === 'mail') {
    ctx.lastProvider = action.provider || 'gmail'
    ctx.lastTool = 'mail'
  }
  if (result?.trim()) pushSessionTurn(ctx, 'atlas', result.trim().slice(0, 400))
}

/**
 * Réécrit une phrase elliptique avec le contexte
 * (« écris dedans … », « dans le fichier », « ouvre-le »).
 */
export function expandWithSession(heard: string, ctx: SessionContext): string {
  let text = heard.replace(/\s+/g, ' ').trim()
  if (!text) return text
  const file = ctx.lastFile

  if (file) {
    // « écris / ajoute / mets dedans … » — pas de \b avant accents (é ≠ word char en JS)
    text = text.replace(
      /((?:[eé]cris|ecris|ajoute|mets|insc?ris))\s+dedans\b/gi,
      `$1 dans le fichier ${file}`,
    )
    text = text.replace(
      /\b(?:dans|sur)\s+(?:le |la |l['’])?(?:ce |cette )?(?:fichier|document|note)\b(?!\s+[A-Za-zÀ-ÿ0-9])/gi,
      `dans le fichier ${file}`,
    )
    text = text.replace(
      /\b((?:ouvre|ouvrir|lis|lie|lit|lire|modifie|supprime))\s+(?:le |la |l['’])?(?:fichier|document|note)\b(?!\s+[A-Za-zÀ-ÿ0-9])/gi,
      `$1 le fichier ${file}`,
    )
    text = text.replace(
      /((?:extrais|extraire|extrait|transforme|reformule|convertis|corrig(?:e|er)|simplifie|formalise|traduis))\s+(?:[cç]a|ceci)\b/gi,
      `$1 le fichier ${file}`,
    )
    text = text.replace(
      /((?:extrais|extraire|transforme|reformule|convertis))\s+(?:du |de (?:le |la |l['’])?)?(?:fichier|document|note)\b(?!\s+[A-Za-zÀ-ÿ0-9])/gi,
      `$1 le fichier ${file}`,
    )
  }

  return text
}

export function sessionBrief(ctx: SessionContext): string {
  const bits: string[] = []
  if (ctx.lastFile) bits.push(`dernier fichier : ${ctx.lastFile}`)
  if (ctx.lastApp) bits.push(`dernière app : ${ctx.lastApp}`)
  if (ctx.lastTool) bits.push(`dernier outil : ${ctx.lastProvider || '?'}/${ctx.lastTool}`)
  const recent = ctx.turns.slice(-4).map((t) => `${t.role}: ${t.text}`).join(' | ')
  if (recent) bits.push(`fil : ${recent}`)
  return bits.join('\n')
}

function safeJson(input?: string): Record<string, unknown> | null {
  if (!input?.trim().startsWith('{')) return null
  try {
    return JSON.parse(input) as Record<string, unknown>
  } catch {
    return null
  }
}
