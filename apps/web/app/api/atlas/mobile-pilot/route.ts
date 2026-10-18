import { desktopInvoke, desktopLinkFields, isDesktopProvider } from '@/lib/atlas-desktop'
import { filmReadiness, generateAtlasFilm } from '@/lib/atlas-film'
import { consultJarvis } from '@/lib/atlas-jarvis'
import { gatewayInvoke } from '@/lib/atlas-mcp-gateway'
import { findLink, saveLink } from '@/lib/atlas-mcp-store'
import {
  enqueueStudioCommand,
  interpretStudioRemote,
  isStudioUiAction,
  speakStudioRemote,
} from '@/lib/atlas-studio-queue'
import { interpretZtcSiteOpen } from '@/lib/atlas-ztc-open'
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

  const origin = new URL(request.url).origin
  const userHeader = request.headers.get('x-atlas-user') || 'harold'

  // Présentation / briefing org — avant site, UI et Jarvis (conversation, pas commande)
  if (wantsOrgBrief(text)) {
    try {
      const brief = await fetch(`${origin}/api/atlas/mobile-org`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-atlas-user': userHeader },
        body: JSON.stringify({ op: 'brief' }),
        signal: AbortSignal.timeout(10000),
      })
      const payload = await brief.json() as { reply?: string }
      if (payload.reply) {
        return Response.json({
          ok: true,
          reply: payload.reply,
          action: { kind: 'answer', text },
          source: 'mobile-org',
        })
      }
    } catch { /* fallback local ci-dessous */ }
    return Response.json({
      ok: true,
      reply: [
        'Voici ton organisation ZtcHosting : hébergement web, domaines, facturation et équipe d’employés IA.',
        'Ouvre Organisation sur mobile pour parler aux agents, ou le Studio PC pour le Bureau 3D et les factures.',
        'Dis « ouvre le site » pour ztchosting.com sur ton ordinateur.',
      ].join(' '),
      action: { kind: 'answer', text },
      source: 'mobile-org',
    })
  }

  // Site ZtcHosting → navigateur du PC (avant UI Studio)
  const site = interpretZtcSiteOpen(text)
  if (site) {
    try {
      const done = await desktopInvoke('open_url', { url: site.url })
      return Response.json({
        ok: true,
        reply: `C’est fait. J’ouvre ${site.label} dans le navigateur de ton PC.`,
        action: { kind: 'invoke', provider: 'browser', tool: 'open_url', input: site.url },
        result: done,
        source: 'desktop-site',
      })
    } catch (error) {
      const failed = error instanceof Error ? error.message : 'Navigateur indisponible.'
      return Response.json({
        ok: false,
        reply: `Je n’ai pas pu ouvrir ${site.label} sur le PC. ${failed}`,
        action: { kind: 'invoke', provider: 'browser', tool: 'open_url', input: site.url },
        source: 'desktop-site',
      })
    }
  }

  // Pilotage UI Studio (instantané — pas d’attente org/LLM)
  const remoteUi = interpretStudioRemote(text)
  if (remoteUi && isStudioUiAction(remoteUi)) {
    enqueueStudioCommand({
      userId: userHeader,
      organizationId: body?.organizationId,
      action: remoteUi,
      source: 'mobile-pilot',
    })
    return Response.json({
      ok: true,
      reply: speakStudioRemote(remoteUi),
      action: remoteUi,
      studio: true,
      source: 'studio-remote',
    })
  }

  // Contexte org seulement si on a vraiment besoin de Jarvis / délégation
  let studio: unknown = null
  if (body?.organizationId) {
    try {
      const org = await fetch(`${origin}/api/atlas/mobile-org`, {
        headers: { 'x-atlas-user': userHeader },
        signal: AbortSignal.timeout(4000),
      })
      if (org.ok) studio = await org.json()
    } catch { /* studio optionnel */ }
  }

  // Délégation / chat / rapport via ATLAS : « demande à Swift… », « rapport de Nova… »
  if (/demande [àa] |dis [àa] |confie [àa] |mission (?:pour|à) |parle [àa] |rapport (?:de |d['’])|ask /i.test(text)) {
    try {
      const wantsReport = /rapport/i.test(text)
      const delegated = await fetch(`${origin}/api/atlas/mobile-org`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-atlas-user': userHeader,
        },
        body: JSON.stringify({ op: wantsReport ? 'report' : 'delegate', text }),
        signal: AbortSignal.timeout(55000),
      })
      const payload = await delegated.json() as { reply?: string; agent?: { firstName?: string } }
      if (payload.reply) {
        return Response.json({
          ok: true,
          reply: payload.reply,
          action: { kind: 'mission', text, name: payload.agent?.firstName },
          source: 'mobile-org',
        })
      }
    } catch { /* tombe sur Jarvis */ }
  }

  const brain = await consultJarvis(text, {
    name: body?.name,
    memory: body?.memory,
    studio,
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
    enqueueStudioCommand({
      userId: userHeader,
      organizationId: body?.organizationId || organizationId,
      action,
      source: 'mobile-jarvis',
    })
    return Response.json({
      ok: true,
      reply: reply || `Je lance la composition « ${action.text} » sur ton Studio.`,
      action,
      studio: true,
      source: brain.source,
    })
  }

  // Toute action UI Studio renvoyée par Jarvis → file vers l’onglet /bureau
  if (isStudioUiAction(action)) {
    enqueueStudioCommand({
      userId: userHeader,
      organizationId: body?.organizationId || organizationId,
      action,
      source: 'mobile-jarvis',
    })
    return Response.json({
      ok: true,
      reply: speakBoth(speakStudioRemote(action), reply || localVoiceReply(text)),
      action,
      studio: true,
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

function wantsOrgBrief(text: string) {
  return /brief(?:ing)?|qui (?:travaille|est en poste)|[eé]tat (?:de )?(?:l['’])?organisation|point (?:ztc|produit)|pulse ztc/i.test(text)
    || /pr[eé]sente(?:[- ]moi)?(?:\s+(?:mon|notre|l['’])?)?\s*(?:organisation|org|ztc|ztchosting|[eé]quipe)/i.test(text)
    || /(?:parle[- ]moi|explique|d[eé]cris|r[eé]sume|montre[- ]moi).{0,40}(?:organisation|ztc|ztchosting|[eé]quipe)/i.test(text)
    || /(?:organisation|ztchosting|[eé]quipe).{0,24}(?:c['’]est quoi|pr[eé]sente)/i.test(text)
}

function asksToIntroduce(text: string) {
  if (wantsOrgBrief(text)) return false
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
