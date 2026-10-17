import { desktopInvoke, desktopLinkFields, isDesktopProvider } from '@/lib/atlas-desktop'
import { filmReadiness, generateAtlasFilm } from '@/lib/atlas-film'
import { consultJarvis } from '@/lib/atlas-jarvis'
import { gatewayInvoke } from '@/lib/atlas-mcp-gateway'
import { findLink, saveLink } from '@/lib/atlas-mcp-store'
import { filmAction, localVoiceReply, type AtlasAction } from '@/lib/atlas-voice'

export const runtime = 'nodejs'

/**
 * Point d’entrée mobile : même Atlas que le Studio, exécute sur la machine
 * où tourne le serveur Web (ordinateur de l’utilisateur).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    text?: string
    organizationId?: string | null
    name?: string
    memory?: string
  } | null

  const text = body?.text?.trim() ?? ''
  if (text.length < 2) {
    return Response.json({ error: 'Ordre trop court.' }, { status: 400 })
  }

  const brain = await consultJarvis(text, {
    name: body?.name,
    memory: body?.memory,
    timeoutMs: 28000,
    tokens: 900,
    maxChars: 1600,
  })
  let action: AtlasAction = brain.action
  let reply = brain.reply
  if (asksToIntroduce(text) && action.kind !== 'answer' && action.kind !== 'listen') {
    action = { kind: 'answer', text }
  }

  const film = filmAction(text)
  if (film) {
    const gate = await filmReadiness()
    if (!gate.ready) {
      return Response.json({ ok: false, reply: gate.detail, action: film, source: brain.source })
    }
    void generateAtlasFilm({ prompt: film.prompt, title: film.title, open: true }).catch(() => undefined)
    return Response.json({
      ok: true,
      reply: speakBoth(gate.detail, reply),
      action: film,
      source: brain.source,
    })
  }

  const organizationId = body?.organizationId?.trim() || 'mobile-workspace'

  if (action.kind === 'invoke' && isDesktopProvider(action.provider)) {
    ensureDesktopLink(organizationId, action.provider)
    const args = asArgs(action.input)
    try {
      // Exécution locale sur le PC hôte du Studio
      const result = await desktopInvoke(action.tool, args)
      const done = typeof result === 'string' ? result : 'C’est fait.'
      return Response.json({
        ok: true,
        reply: speakBoth(done, reply),
        action,
        result,
        source: brain.source,
      })
    } catch (error) {
      const viaGateway = await gatewayInvoke(organizationId, action.provider, action.tool, action.input)
      if (viaGateway.ok) {
        return Response.json({
          ok: true,
          reply: speakBoth(String(viaGateway.result || 'C’est fait.'), reply),
          action,
          result: viaGateway.result,
          source: brain.source,
        })
      }
      const failed = viaGateway.error || (error instanceof Error ? error.message : 'Échec ordinateur.')
      return Response.json({
        ok: false,
        reply: speakBoth(failed, reply),
        action,
        source: brain.source,
      })
    }
  }

  if (action.kind === 'compose') {
    return Response.json({
      ok: true,
      reply: reply || `Je peux dessiner « ${action.text} » dans le Studio. Décris l’organisation, puis Générer.`,
      action,
      source: brain.source,
    })
  }

  return Response.json({
    ok: true,
    reply: reply || localVoiceReply(text),
    action,
    source: brain.source,
  })
}

function asksToIntroduce(text: string) {
  return /pr[eé]sente[- ]?toi|te pr[eé]senter|qui es[- ]tu|tu es qui|who are you|introduce yourself|pres[eé]ntate/i.test(text)
}

function speakBoth(done: string, model: string) {
  const status = done.replace(/\s+/g, ' ').trim()
  const said = model.replace(/\s+/g, ' ').trim()
  if (!said) return status || 'C’est fait.'
  if (!status) return said
  const a = status.toLowerCase()
  const b = said.toLowerCase()
  if (a.includes(b) || b.includes(a)) return status.length >= said.length ? status : said
  return `${status} ${said}`
}

function ensureDesktopLink(organizationId: string, provider: string) {
  const existing = findLink(organizationId, provider)
  if (existing?.status === 'connected') return
  const fields = desktopLinkFields(provider)
  saveLink({
    organizationId,
    provider,
    ...fields,
  })
}

function asArgs(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch { /* plain text */ }
    return { text: input, command: input }
  }
  return {}
}
