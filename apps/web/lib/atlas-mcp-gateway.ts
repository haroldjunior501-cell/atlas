/**
 * Atlas MCP Gateway (couche 1–3)
 *
 * - Tokens OAuth restent ici (jamais renvoyés au LLM / à l’UI).
 * - ATLAS parle MCP (tools/list + tools/call) vers n8n / hub, OU exécute
 *   les APIs natives (Gmail, Calendar…) avec le token stocké.
 * - Couche vocale : ne reçoit que { name, description } + le résultat texte.
 */
import { connectorOf } from '@atlas/domain'
import type { StoredLink } from '@/lib/atlas-mcp-store'
import { findLink, linksFor, saveLink } from '@/lib/atlas-mcp-store'
import { mcpCall, mcpTools, type McpTool } from '@/lib/atlas-mcp'
import { isOauthProvider, oauthCredentials, oauthToolsFor, type OauthProvider } from '@/lib/atlas-oauth'
import { desktopInvoke, DESKTOP_TOOLS, isDesktopProvider } from '@/lib/atlas-desktop'
import { thinkWithLlm } from '@/lib/ace-runtime'
import { readOauthApps } from '@/lib/oauth-apps-store'
import { serverEnv } from '@/lib/server-env'
import { tokenFieldsFor } from '@/lib/atlas-connect-modes'

export interface GatewayTool extends McpTool {
  provider: string
  kind: StoredLink['kind']
}

export interface GatewayInvokeResult {
  ok: boolean
  result?: string
  error?: string
  tool: string
  provider: string
}

interface OauthSecret {
  access: string
  refresh?: string
  grant?: string
}

function parseSecret(raw: string): OauthSecret | null {
  try {
    const parsed = JSON.parse(raw) as OauthSecret
    if (parsed?.access || parsed?.grant) return parsed
  } catch { /* token opaque MCP */ }
  return null
}

/** Tools exposés au LLM vocal (sans secrets). */
export function gatewayToolsForOrg(organizationId: string): GatewayTool[] {
  return linksFor(organizationId)
    .filter((link) => link.status === 'connected')
    .flatMap((link) => link.tools.map((tool) => ({
      ...tool,
      provider: link.provider,
      kind: link.kind,
    })))
}

export const OAUTH_TOOL_CATALOG: Record<string, McpTool[]> = {}

export function oauthToolsCatalog(provider: string): McpTool[] {
  return oauthToolsFor(provider)
}

function asArgs(input: Record<string, unknown> | string | undefined): Record<string, unknown> {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (trimmed.startsWith('{')) {
      try { return JSON.parse(trimmed) as Record<string, unknown> } catch { /* phrase naturelle */ }
    }
    return parseNaturalArgs(trimmed)
  }
  return input ?? {}
}

/** Extrait to/subject/body/summary depuis une phrase vocale française. */
export function parseNaturalArgs(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  const email = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
  const toName = trimmed.match(/(?:à|a|to)\s+([A-Za-zÀ-ÿ][\wÀ-ÿ.'-]*)/i)?.[1] || ''
  const subjectMatch =
    trimmed.match(/(?:sujet|object)\s*[:\-–]\s*[«"]?(.+?)[»"]?(?:\.|$)/i)
    || trimmed.match(/(?:pour|au sujet de|concernant)\s+(.+?)(?:\.|$)/i)
  const subject = subjectMatch?.[1]?.trim() || (email ? 'Message ATLAS' : 'Message ATLAS')
  // Corps = phrase après "dis / message / corps", sinon phrase nettoyée sans le verbe d'envoi
  const bodyMatch = trimmed.match(/(?:corps|message|dis(?:e)?(?:[- ]lui|[- ]leur)?|écris|ecris)\s*[:\-–]\s*(.+)/i)
  let body = bodyMatch?.[1]?.trim() || ''
  if (!body) {
    body = trimmed
      .replace(/^(?:atlas[, ]*)?(?:envoie|envoi|envoyer|réponds|reponds)\s+(?:un |une |le |la |l['’])?(?:mail|e-?mail|courriel)\s*/i, '')
      .replace(/^(?:à|a|to)\s+\S+\s*/i, '')
      .replace(/^(?:pour|au sujet de|concernant)\s+.+?(?:\.|$)\s*/i, '')
      .trim()
    if (!body || body.length < 3) {
      body = subjectMatch?.[1]
        ? `Bonjour,\n\n${subjectMatch[1].trim()}.\n\nCordialement,\nATLAS`
        : 'Bonjour,\n\nMessage envoyé via ATLAS.\n\nCordialement,'
    }
  }
  const summary =
    trimmed.match(/(?:événement|évènement|réunion|meeting)\s+(.+?)(?:\s+(?:demain|aujourd|lundi|mardi)|$)/i)?.[1]?.trim()
    || subjectMatch?.[1]?.trim()
    || 'Réunion ATLAS'
  const when = /demain/i.test(trimmed) ? 'tomorrow' : /aujourd/i.test(trimmed) ? 'today' : 'tomorrow'
  return {
    text: trimmed,
    instruction: trimmed,
    to: email || toName,
    subject: subject.slice(0, 120),
    body,
    summary,
    when,
    channel: trimmed.match(/#([\w-]+)/)?.[1] || 'general',
  }
}

async function googleAccess(link: StoredLink): Promise<string> {
  const secret = parseSecret(link.token)
  if (!secret?.access) throw new Error('Jeton Google manquant. Reconnectez l’outil.')
  if (secret.grant === 'organization') {
    throw new Error('Connexion organisation sans clé fournisseur. Ajoutez GOOGLE_CLIENT_ID / SECRET, puis Relier à nouveau.')
  }
  return secret.access
}

async function refreshGoogleIfNeeded(link: StoredLink): Promise<string> {
  const secret = parseSecret(link.token)
  if (!secret?.access) throw new Error('Jeton Google manquant.')
  if (secret.grant === 'organization') {
    throw new Error('Ajoutez GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, puis Relier Gmail ou Calendar.')
  }
  // Probe token; on 401 refresh
  const probe = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(secret.access), {
    signal: AbortSignal.timeout(6000),
  }).catch(() => null)
  if (probe?.ok) return secret.access
  if (!secret.refresh) return secret.access
  if (!isOauthProvider(link.provider)) return secret.access
  const { id, secret: clientSecret, app } = oauthCredentials(link.provider)
  if (!id || !clientSecret) return secret.access
  const response = await fetch(app.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: clientSecret,
      refresh_token: secret.refresh,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  })
  const payload = await response.json().catch(() => ({})) as { access_token?: string }
  if (!payload.access_token) return secret.access
  saveLink({
    ...link,
    token: JSON.stringify({ access: payload.access_token, refresh: secret.refresh }),
    tools: link.tools.length ? link.tools : oauthToolsFor(link.provider),
  })
  return payload.access_token
}

function tomorrowIso(hour = 10) {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

function todayIso(hour = 15) {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

function headerOf(headers: Array<{ name: string; value: string }> | undefined, name: string) {
  return headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function decodePartData(data?: string) {
  if (!data) return ''
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(normalized, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function extractBody(payload?: {
  mimeType?: string
  body?: { data?: string }
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>
}): string {
  if (!payload) return ''
  if (payload.body?.data) return decodePartData(payload.body.data)
  const parts = payload.parts ?? []
  const plain = parts.find((part) => part.mimeType === 'text/plain')
  if (plain?.body?.data) return decodePartData(plain.body.data)
  const html = parts.find((part) => part.mimeType === 'text/html')
  if (html?.body?.data) {
    return decodePartData(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  for (const part of parts) {
    const nested = extractBody(part as typeof payload)
    if (nested) return nested
  }
  return ''
}

function extractAddress(from: string) {
  const angle = from.match(/<([^>]+)>/)
  if (angle?.[1]) return angle[1].trim()
  const email = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return email?.[0]?.trim() || from.trim()
}

async function fetchGmailMessage(headers: Record<string, string>, id: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers,
    signal: AbortSignal.timeout(12000),
  })
  const mail = await response.json() as {
    id?: string
    threadId?: string
    snippet?: string
    payload?: {
      mimeType?: string
      headers?: Array<{ name: string; value: string }>
      body?: { data?: string }
      parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>
    }
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(mail.error?.message || 'Lecture du message impossible')
  const hdrs = mail.payload?.headers
  return {
    id: mail.id || id,
    threadId: mail.threadId || '',
    from: headerOf(hdrs, 'From'),
    to: headerOf(hdrs, 'To'),
    subject: headerOf(hdrs, 'Subject') || '(sans objet)',
    messageId: headerOf(hdrs, 'Message-ID') || headerOf(hdrs, 'Message-Id'),
    references: headerOf(hdrs, 'References'),
    snippet: mail.snippet || '',
    body: extractBody(mail.payload) || mail.snippet || '',
  }
}

async function latestInboxId(headers: Record<string, string>, query = 'in:inbox') {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(query)}`, {
    headers,
    signal: AbortSignal.timeout(12000),
  })
  const body = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string } }
  if (!response.ok) {
    const raw = body.error?.message || 'Lecture Gmail impossible'
    if (/has not been used|disabled|not been used in project/i.test(raw)) {
      throw new Error(
        'L’API Gmail n’est pas activée sur ton projet Google Cloud. Ouvre https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=27648052527 → Activer, attends 1–2 min, puis réessaie.',
      )
    }
    throw new Error(raw)
  }
  const id = body.messages?.[0]?.id
  if (!id) throw new Error('La boîte de réception est vide.')
  return id
}

function localReplyDraft(from: string, subject: string, body: string, instruction: string) {
  const who = extractAddress(from).split('@')[0] || 'bonjour'
  const topic = subject.replace(/^(re|fwd|tr|fw)\s*:\s*/i, '').trim()
  const ask = /(?:pouvez[- ]vous|peux[- ]tu|merci de|besoin|question|\?)/i.test(body)
  const base = ask
    ? `Bonjour ${who},\n\nMerci pour votre message concernant « ${topic} ». J’ai bien pris connaissance de votre demande et je reviens vers vous rapidement avec une réponse précise.\n\nCordialement`
    : `Bonjour ${who},\n\nMerci pour votre e-mail au sujet de « ${topic} ». Message bien reçu, je m’en occupe.\n\nCordialement`
  if (/refus|décline|pas disponible|annul/i.test(instruction)) {
    return `Bonjour ${who},\n\nMerci pour votre message. Malheureusement je ne pourrai pas donner suite pour le moment.\n\nCordialement`
  }
  if (/accepte|confirm|oui|d['’]accord/i.test(instruction)) {
    return `Bonjour ${who},\n\nMerci pour votre message concernant « ${topic} ». C’est noté, je confirme.\n\nCordialement`
  }
  return base
}

async function runGmail(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const access = await refreshGoogleIfNeeded(link)
  const headers = { authorization: `Bearer ${access}`, 'content-type': 'application/json' }
  if (tool === 'get_profile' || tool === 'status') {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers, signal: AbortSignal.timeout(10000) })
    const body = await response.json() as { emailAddress?: string; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message || 'Gmail profil indisponible')
    return `Gmail connecté : ${body.emailAddress}`
  }
  if (tool === 'list_messages' || tool === 'list' || tool === 'Lire') {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=in:inbox', {
      headers,
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string; status?: string } }
    if (!response.ok) {
      const raw = body.error?.message || 'Lecture Gmail impossible'
      if (/has not been used|disabled|not been used in project/i.test(raw)) {
        throw new Error(
          'L’API Gmail n’est pas activée sur ton projet Google Cloud. Ouvre https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=27648052527 → Activer, attends 1–2 min, puis réessaie.',
        )
      }
      throw new Error(raw)
    }
    const ids = (body.messages ?? []).slice(0, 5)
    if (!ids.length) return 'La boîte de réception est vide.'
    const lines: string[] = []
    for (const item of ids) {
      const mail = await fetchGmailMessage(headers, item.id)
      const preview = mail.body.replace(/\s+/g, ' ').trim().slice(0, 120)
      lines.push(`• ${mail.subject} — ${mail.from}${preview ? `\n  ${preview}` : ''}`)
    }
    return `Derniers messages :\n${lines.join('\n')}`
  }
  if (tool === 'prepare_reply') {
    const instruction = String(args.instruction || args.text || args.body || 'Réponds poliment et utilement.')
    const query = String(args.query || 'in:inbox')
    const id = String(args.messageId || '').trim() || await latestInboxId(headers, query)
    const mail = await fetchGmailMessage(headers, id)
    const system = `Tu rédiges une réponse e-mail en français, professionnelle et humaine.
Réponds UNIQUEMENT avec le corps du mail (pas de sujet, pas de JSON, pas de markdown).
Adapte-toi au contenu reçu. Sois concis (8–12 lignes max). Signe "Cordialement".`
    const user = `Instruction de l’utilisateur : ${instruction}

De : ${mail.from}
Objet : ${mail.subject}
Contenu :
${mail.body.slice(0, 3500)}`
    const drafted = (await thinkWithLlm(system, user, 320, 14000)).trim()
    const draftBody = (drafted
      .replace(/^```[\s\S]*?```$/g, '')
      .replace(/^["«]?Subject:.*$/gim, '')
      .trim() || localReplyDraft(mail.from, mail.subject, mail.body, instruction))
    const replySubject = /^(re|tr|fw|fwd)\s*:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject}`
    const draft = {
      to: extractAddress(mail.from),
      subject: replySubject,
      body: draftBody,
      threadId: mail.threadId,
      inReplyTo: mail.messageId,
      references: [mail.references, mail.messageId].filter(Boolean).join(' ').trim(),
      messageId: mail.id,
    }
    return JSON.stringify({
      ok: true,
      from: mail.from,
      subject: mail.subject,
      body: mail.body.slice(0, 1500),
      draft,
    })
  }
  if (tool === 'reply_email') {
    const to = String(args.to || '').trim()
    if (!to || !to.includes('@')) throw new Error('Destinataire manquant pour la réponse.')
    const subject = String(args.subject || 'Re: Message').replace(/[\r\n]+/g, ' ').trim()
    const bodyText = String(args.body || '').trim()
    if (!bodyText) throw new Error('Le corps de la réponse est vide.')
    const encodedSubject = /[^\x00-\x7F]/.test(subject)
      ? `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
      : subject
    const lines = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ]
    if (args.inReplyTo) lines.push(`In-Reply-To: ${String(args.inReplyTo)}`)
    if (args.references) lines.push(`References: ${String(args.references)}`)
    lines.push('', Buffer.from(bodyText, 'utf8').toString('base64'))
    const encoded = Buffer.from(lines.join('\r\n')).toString('base64url')
    const payload: Record<string, unknown> = { raw: encoded }
    if (args.threadId) payload.threadId = String(args.threadId)
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(14000),
    })
    const body = await response.json() as { id?: string; error?: { message?: string } }
    if (!response.ok) {
      const rawErr = body.error?.message || 'Réponse Gmail refusée'
      if (/insufficient|scope|forbidden|401|403/i.test(rawErr)) {
        throw new Error('Permission d’envoi manquante. Détache Gmail, Relier à nouveau, accepte l’envoi.')
      }
      throw new Error(rawErr)
    }
    return `Réponse envoyée à ${to} — « ${subject} ».`
  }
  if (tool === 'send_email' || tool === 'send') {
    const to = String(args.to || '').trim()
    if (!to || !to.includes('@')) {
      throw new Error(
        'Pour envoyer, indique une adresse complète. Exemple : « Envoie un mail à sarah@entreprise.com sujet : Confirmation, message : On se voit demain. »',
      )
    }
    const subject = String(args.subject || 'Message ATLAS').replace(/[\r\n]+/g, ' ').trim()
    const bodyText = String(args.body || args.text || 'Message envoyé via ATLAS.').trim()
    const encodedSubject = /[^\x00-\x7F]/.test(subject)
      ? `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
      : subject
    const raw = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(bodyText, 'utf8').toString('base64'),
    ].join('\r\n')
    const encoded = Buffer.from(raw).toString('base64url')
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers,
      body: JSON.stringify({ raw: encoded }),
      signal: AbortSignal.timeout(14000),
    })
    const body = await response.json() as { id?: string; error?: { message?: string } }
    if (!response.ok) {
      const rawErr = body.error?.message || 'Envoi Gmail refusé'
      if (/insufficient|scope|forbidden|401|403/i.test(rawErr)) {
        throw new Error('Permission d’envoi manquante. Détache Gmail, reclique Relier, et accepte bien l’accès à envoyer des e-mails.')
      }
      if (/has not been used|disabled/i.test(rawErr)) {
        throw new Error('Active l’API Gmail sur Google Cloud, puis réessaie.')
      }
      throw new Error(rawErr)
    }
    return `C’est envoyé. Mail à ${to} — sujet : « ${subject} ».`
  }
  throw new Error(`Outil Gmail inconnu : ${tool}`)
}

async function runCalendar(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const access = await refreshGoogleIfNeeded(link)
  const headers = { authorization: `Bearer ${access}`, 'content-type': 'application/json' }
  if (tool === 'list_events' || tool === 'list' || tool === 'Lire') {
    const timeMin = new Date().toISOString()
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json() as { items?: Array<{ summary?: string; start?: { dateTime?: string; date?: string } }>; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message || 'Lecture Calendar impossible')
    const items = body.items ?? []
    if (!items.length) return 'Aucun événement à venir.'
    return `À venir :\n${items.map((item) => `• ${item.summary ?? 'Sans titre'} — ${item.start?.dateTime || item.start?.date || ''}`).join('\n')}`
  }
  if (tool === 'create_event' || tool === 'create') {
    const summary = String(args.summary || args.subject || 'Réunion ATLAS')
    const start = String(args.start || (args.when === 'today' ? todayIso() : tomorrowIso()))
    const endDate = new Date(start)
    endDate.setHours(endDate.getHours() + 1)
    const end = String(args.end || endDate.toISOString())
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        summary,
        start: { dateTime: start },
        end: { dateTime: end },
      }),
      signal: AbortSignal.timeout(14000),
    })
    const body = await response.json() as { htmlLink?: string; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message || 'Création événement refusée')
    return `Événement « ${summary} » créé${body.htmlLink ? `. Lien : ${body.htmlLink}` : '.'}`
  }
  throw new Error(`Outil Calendar inconnu : ${tool}`)
}

async function runDrive(link: StoredLink, tool: string): Promise<string> {
  const access = await refreshGoogleIfNeeded(link)
  const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=5&fields=files(id,name)', {
    headers: { authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(12000),
  })
  const body = await response.json() as { files?: Array<{ name?: string }>; error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message || 'Drive indisponible')
  const files = body.files ?? []
  if (!files.length) return 'Aucun fichier récent.'
  return `Fichiers :\n${files.map((file) => `• ${file.name}`).join('\n')}`
}

async function runSlack(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const secret = parseSecret(link.token)
  const token = secret?.access || link.token
  if (!token || secret?.grant === 'organization') throw new Error('Reconnectez Slack avec SLACK_CLIENT_ID / SECRET.')
  if (tool === 'list_channels' || tool === 'list') {
    const response = await fetch('https://slack.com/api/conversations.list?limit=10', {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json() as { ok?: boolean; channels?: Array<{ name?: string }>; error?: string }
    if (!body.ok) throw new Error(body.error || 'Slack conversations.list')
    return `Canaux : ${(body.channels ?? []).map((c) => `#${c.name}`).join(', ') || 'aucun'}`
  }
  if (tool === 'post_message' || tool === 'send' || tool === 'post') {
    const channel = String(args.channel || 'general')
    const text = String(args.text || args.body || '')
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ channel, text }),
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json() as { ok?: boolean; error?: string }
    if (!body.ok) throw new Error(body.error || 'Slack chat.postMessage')
    return `Message posté sur #${channel}.`
  }
  throw new Error(`Outil Slack inconnu : ${tool}`)
}

async function runGithub(link: StoredLink): Promise<string> {
  const secret = parseSecret(link.token)
  const token = secret?.access || link.token
  if (!token || secret?.grant === 'organization') throw new Error('Reconnectez GitHub avec les clés OAuth.')
  const response = await fetch('https://api.github.com/user/repos?per_page=5&sort=updated', {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(10000),
  })
  const body = await response.json() as Array<{ full_name?: string }> | { message?: string }
  if (!response.ok || !Array.isArray(body)) throw new Error((body as { message?: string }).message || 'GitHub')
  return `Dépôts :\n${body.map((repo) => `• ${repo.full_name}`).join('\n')}`
}

async function runNotion(link: StoredLink, args: Record<string, unknown>): Promise<string> {
  const secret = parseSecret(link.token)
  const token = secret?.access || link.token
  if (!token || secret?.grant === 'organization') throw new Error('Reconnectez Notion.')
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ query: String(args.text || args.query || ''), page_size: 5 }),
    signal: AbortSignal.timeout(12000),
  })
  const body = await response.json() as { results?: Array<{ id?: string }>; message?: string }
  if (!response.ok) throw new Error(body.message || 'Notion search')
  return `${body.results?.length ?? 0} résultat(s) Notion.`
}

async function runHubspot(link: StoredLink): Promise<string> {
  const secret = parseSecret(link.token)
  const token = secret?.access || link.token
  if (!token || secret?.grant === 'organization') throw new Error('Reconnectez HubSpot.')
  const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=5', {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  })
  const body = await response.json() as { results?: unknown[]; message?: string }
  if (!response.ok) throw new Error(body.message || 'HubSpot')
  return `${body.results?.length ?? 0} contact(s) HubSpot.`
}

function envSecret(key: string): string {
  return (serverEnv(key) || readOauthApps()[key] || '').trim()
}

function tokenSecretsFor(provider: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of tokenFieldsFor(provider)) {
    const value = envSecret(field.key)
    if (value) out[field.key] = value
  }
  return out
}

async function refreshMicrosoftIfNeeded(link: StoredLink): Promise<string> {
  const secret = parseSecret(link.token)
  if (!secret?.access) throw new Error('Jeton Microsoft manquant. Reliez Outlook / Teams à nouveau.')
  if (secret.grant === 'organization' || secret.grant === 'api_key') {
    throw new Error('Ajoutez MICROSOFT_CLIENT_ID / SECRET, puis Relier via OAuth Microsoft.')
  }
  const probe = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { authorization: `Bearer ${secret.access}` },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null)
  if (probe?.ok) return secret.access
  if (!secret.refresh || !isOauthProvider(link.provider)) return secret.access
  const { id, secret: clientSecret, app } = oauthCredentials(link.provider)
  if (!id || !clientSecret) return secret.access
  const response = await fetch(app.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: clientSecret,
      refresh_token: secret.refresh,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  })
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string }
  if (!payload.access_token) return secret.access
  saveLink({
    ...link,
    token: JSON.stringify({ access: payload.access_token, refresh: payload.refresh_token || secret.refresh }),
    tools: link.tools.length ? link.tools : oauthToolsFor(link.provider),
  })
  return payload.access_token
}

async function runOutlook(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const access = await refreshMicrosoftIfNeeded(link)
  const headers = { authorization: `Bearer ${access}`, 'content-type': 'application/json' }
  if (tool === 'get_profile' || tool === 'status') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', { headers, signal: AbortSignal.timeout(10000) })
    const body = await response.json() as { mail?: string; userPrincipalName?: string; displayName?: string; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message || 'Profil Microsoft indisponible')
    return `Outlook connecté : ${body.mail || body.userPrincipalName || body.displayName}`
  }
  if (tool === 'list_messages' || tool === 'list' || tool === 'Lire') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=subject,from,bodyPreview,receivedDateTime', {
      headers,
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json() as {
      value?: Array<{ subject?: string; from?: { emailAddress?: { name?: string; address?: string } }; bodyPreview?: string }>
      error?: { message?: string }
    }
    if (!response.ok) throw new Error(body.error?.message || 'Lecture Outlook impossible')
    const items = body.value ?? []
    if (!items.length) return 'La boîte Outlook est vide.'
    return `Derniers messages Outlook :\n${items.map((item) => {
      const from = item.from?.emailAddress?.name || item.from?.emailAddress?.address || '?'
      return `• ${item.subject || '(sans objet)'} — ${from}${item.bodyPreview ? `\n  ${item.bodyPreview.slice(0, 120)}` : ''}`
    }).join('\n')}`
  }
  if (tool === 'send_email' || tool === 'send') {
    const to = String(args.to || '').trim()
    if (!to || !to.includes('@')) throw new Error('Indiquez une adresse e-mail complète pour Outlook.')
    const subject = String(args.subject || 'Message ATLAS').trim()
    const bodyText = String(args.body || args.text || 'Message envoyé via ATLAS.').trim()
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: bodyText },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(14000),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message || 'Envoi Outlook refusé')
    }
    return `C’est envoyé via Outlook à ${to} — « ${subject} ».`
  }
  throw new Error(`Outil Outlook inconnu : ${tool}`)
}

async function runOutlookCalendar(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const access = await refreshMicrosoftIfNeeded(link)
  const headers = { authorization: `Bearer ${access}`, 'content-type': 'application/json' }
  if (tool === 'list_events' || tool === 'list' || tool === 'Lire') {
    const start = new Date().toISOString()
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(tomorrowIso(23))}&$top=5&$orderby=start/dateTime`,
      { headers, signal: AbortSignal.timeout(12000) },
    )
    const body = await response.json() as {
      value?: Array<{ subject?: string; start?: { dateTime?: string } }>
      error?: { message?: string }
    }
    if (!response.ok) throw new Error(body.error?.message || 'Lecture calendrier Outlook impossible')
    const items = body.value ?? []
    if (!items.length) return 'Aucun événement Outlook à venir.'
    return `À venir (Outlook) :\n${items.map((item) => `• ${item.subject ?? 'Sans titre'} — ${item.start?.dateTime || ''}`).join('\n')}`
  }
  if (tool === 'create_event' || tool === 'create') {
    const summary = String(args.summary || args.subject || 'Réunion ATLAS')
    const start = String(args.start || (args.when === 'today' ? todayIso() : tomorrowIso()))
    const endDate = new Date(start)
    endDate.setHours(endDate.getHours() + 1)
    const end = String(args.end || endDate.toISOString())
    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject: summary,
        start: { dateTime: start.replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
        end: { dateTime: end.replace(/\.\d{3}Z$/, ''), timeZone: 'UTC' },
      }),
      signal: AbortSignal.timeout(14000),
    })
    const body = await response.json() as { webLink?: string; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message || 'Création événement Outlook refusée')
    return `Événement Outlook « ${summary} » créé${body.webLink ? `. Lien : ${body.webLink}` : '.'}`
  }
  throw new Error(`Outil Outlook Calendar inconnu : ${tool}`)
}

async function runTeams(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const access = await refreshMicrosoftIfNeeded(link)
  const headers = { authorization: `Bearer ${access}`, 'content-type': 'application/json' }
  if (tool === 'list_chats' || tool === 'list' || tool === 'Lire') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/chats?$top=5', {
      headers,
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json() as { value?: Array<{ id?: string; topic?: string }>; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message || 'Lecture Teams impossible')
    const items = body.value ?? []
    if (!items.length) return 'Aucun chat Teams récent.'
    return `Chats Teams :\n${items.map((item) => `• ${item.topic || item.id}`).join('\n')}`
  }
  if (tool === 'send_chat' || tool === 'send' || tool === 'post') {
    const chatId = String(args.chatId || args.channel || '').trim()
    const text = String(args.text || args.body || '').trim()
    if (!chatId) throw new Error('Indiquez un chatId Teams.')
    if (!text) throw new Error('Message Teams vide.')
    const response = await fetch(`https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: { content: text } }),
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message || 'Envoi Teams refusé')
    }
    return 'Message Teams envoyé.'
  }
  throw new Error(`Outil Teams inconnu : ${tool}`)
}

async function runOneDrive(link: StoredLink, tool: string): Promise<string> {
  const access = await refreshMicrosoftIfNeeded(link)
  if (tool !== 'list_files' && tool !== 'list' && tool !== 'Lire') {
    throw new Error(`Outil OneDrive inconnu : ${tool}`)
  }
  const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=8&$select=name,size,lastModifiedDateTime', {
    headers: { authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(12000),
  })
  const body = await response.json() as { value?: Array<{ name?: string }>; error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message || 'OneDrive indisponible')
  const files = body.value ?? []
  if (!files.length) return 'Aucun fichier OneDrive à la racine.'
  return `OneDrive :\n${files.map((file) => `• ${file.name}`).join('\n')}`
}

async function runTokenProvider(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const secrets = tokenSecretsFor(link.provider)
  const provider = link.provider

  if (provider === 'resend') {
    const key = secrets.RESEND_API_KEY
    if (!key) throw new Error('Clé Resend manquante. Reliez Resend et collez RESEND_API_KEY.')
    if (tool !== 'send_email' && tool !== 'send') throw new Error(`Outil Resend inconnu : ${tool}`)
    const to = String(args.to || '').trim()
    if (!to.includes('@')) throw new Error('Destinataire Resend manquant.')
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: String(args.from || envSecret('RESEND_FROM') || 'Atlas <onboarding@resend.dev>'),
        to: [to],
        subject: String(args.subject || 'Message ATLAS'),
        text: String(args.body || args.text || 'Message envoyé via ATLAS.'),
      }),
      signal: AbortSignal.timeout(14000),
    })
    const body = await response.json().catch(() => ({})) as { id?: string; message?: string }
    if (!response.ok) throw new Error(body.message || 'Envoi Resend refusé')
    return `E-mail Resend envoyé à ${to}${body.id ? ` (${body.id})` : ''}.`
  }

  if (provider === 'telegram') {
    const key = secrets.TELEGRAM_BOT_TOKEN
    if (!key) throw new Error('Token Telegram manquant.')
    if (tool === 'get_me' || tool === 'status') {
      const response = await fetch(`https://api.telegram.org/bot${key}/getMe`, { signal: AbortSignal.timeout(10000) })
      const body = await response.json() as { ok?: boolean; result?: { username?: string }; description?: string }
      if (!body.ok) throw new Error(body.description || 'Telegram getMe')
      return `Bot Telegram : @${body.result?.username || '?'}`
    }
    if (tool === 'send_message' || tool === 'send') {
      const chatId = String(args.chatId || args.channel || args.to || '').trim()
      const text = String(args.text || args.body || '').trim()
      if (!chatId || !text) throw new Error('chatId et texte requis pour Telegram.')
      const response = await fetch(`https://api.telegram.org/bot${key}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(12000),
      })
      const body = await response.json() as { ok?: boolean; description?: string }
      if (!body.ok) throw new Error(body.description || 'Telegram sendMessage')
      return 'Message Telegram envoyé.'
    }
    throw new Error(`Outil Telegram inconnu : ${tool}`)
  }

  if (provider === 'discord') {
    const key = secrets.DISCORD_BOT_TOKEN
    if (!key) throw new Error('Bot token Discord manquant.')
    if (tool === 'list_guilds' || tool === 'list') {
      const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { authorization: `Bot ${key}` },
        signal: AbortSignal.timeout(10000),
      })
      const body = await response.json() as Array<{ name?: string }> | { message?: string }
      if (!response.ok || !Array.isArray(body)) throw new Error((body as { message?: string }).message || 'Discord guilds')
      return `Serveurs Discord : ${body.map((g) => g.name).filter(Boolean).join(', ') || 'aucun'}`
    }
    if (tool === 'send_message' || tool === 'send') {
      const channelId = String(args.channelId || args.channel || '').trim()
      const text = String(args.text || args.body || '').trim()
      if (!channelId || !text) throw new Error('channelId et texte requis pour Discord.')
      const response = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
        method: 'POST',
        headers: { authorization: `Bot ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: text }),
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message || 'Discord send')
      }
      return 'Message Discord envoyé.'
    }
    throw new Error(`Outil Discord inconnu : ${tool}`)
  }

  if (provider === 'stripe') {
    const key = secrets.STRIPE_SECRET_KEY
    if (!key) throw new Error('Clé Stripe manquante.')
    if (tool === 'status') return 'Stripe connecté (écritures soumises à approbation).'
    const response = await fetch('https://api.stripe.com/v1/customers?limit=5', {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json() as { data?: Array<{ email?: string; name?: string }>; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message || 'Stripe')
    return `Clients Stripe : ${(body.data ?? []).map((c) => c.email || c.name || '?').join(', ') || 'aucun'}`
  }

  if (provider === 'figma') {
    const key = secrets.FIGMA_ACCESS_TOKEN
    if (!key) throw new Error('Token Figma manquant.')
    const response = await fetch('https://api.figma.com/v1/me', {
      headers: { 'X-Figma-Token': key },
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json() as { email?: string; handle?: string; err?: string; message?: string }
    if (!response.ok) throw new Error(body.err || body.message || 'Figma')
    return `Figma connecté : ${body.handle || body.email || 'OK'}`
  }

  if (provider === 'linear') {
    const key = secrets.LINEAR_API_KEY
    if (!key) throw new Error('Clé Linear manquante.')
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { authorization: key, 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ issues(first: 5) { nodes { identifier title } } }' }),
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json() as { data?: { issues?: { nodes?: Array<{ identifier?: string; title?: string }> } }; errors?: Array<{ message?: string }> }
    if (body.errors?.length) throw new Error(body.errors[0]?.message || 'Linear')
    const nodes = body.data?.issues?.nodes ?? []
    return nodes.length
      ? `Issues Linear :\n${nodes.map((n) => `• ${n.identifier} ${n.title}`).join('\n')}`
      : 'Aucune issue Linear récente.'
  }

  if (provider === 'gitlab') {
    const key = secrets.GITLAB_TOKEN
    if (!key) throw new Error('Token GitLab manquant.')
    const response = await fetch('https://gitlab.com/api/v4/projects?membership=true&per_page=5&order_by=last_activity_at', {
      headers: { 'PRIVATE-TOKEN': key },
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json() as Array<{ path_with_namespace?: string }> | { message?: string }
    if (!response.ok || !Array.isArray(body)) throw new Error((body as { message?: string }).message || 'GitLab')
    return `Projets GitLab :\n${body.map((p) => `• ${p.path_with_namespace}`).join('\n')}`
  }

  if (provider === 'shopify') {
    const shop = secrets.SHOPIFY_SHOP?.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const key = secrets.SHOPIFY_ADMIN_TOKEN
    if (!shop || !key) throw new Error('SHOPIFY_SHOP et SHOPIFY_ADMIN_TOKEN requis.')
    const response = await fetch(`https://${shop}/admin/api/2024-10/products.json?limit=5`, {
      headers: { 'X-Shopify-Access-Token': key },
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json() as { products?: Array<{ title?: string }>; errors?: string }
    if (!response.ok) throw new Error(body.errors || 'Shopify')
    return `Produits Shopify : ${(body.products ?? []).map((p) => p.title).join(', ') || 'aucun'}`
  }

  if (provider === 'x') {
    const key = secrets.X_BEARER_TOKEN
    if (!key) throw new Error('Bearer token X manquant.')
    if (tool === 'me' || tool === 'status' || tool === 'list') {
      const response = await fetch('https://api.x.com/2/users/me', {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      })
      const body = await response.json() as { data?: { username?: string }; detail?: string; title?: string }
      if (!response.ok) throw new Error(body.detail || body.title || 'X API')
      return `Compte X : @${body.data?.username || '?'}`
    }
    if (tool === 'post' || tool === 'send') {
      const text = String(args.text || args.body || '').trim()
      if (!text) throw new Error('Texte du post X manquant.')
      const response = await fetch('https://api.x.com/2/tweets', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { detail?: string; title?: string }
        throw new Error(err.detail || err.title || 'Publication X refusée')
      }
      return 'Post X publié.'
    }
    throw new Error(`Outil X inconnu : ${tool}`)
  }

  if (provider === 'dropbox') {
    const key = secrets.DROPBOX_ACCESS_TOKEN
    if (!key) throw new Error('Token Dropbox manquant.')
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ path: '', limit: 8 }),
      signal: AbortSignal.timeout(12000),
    })
    const body = await response.json() as { entries?: Array<{ name?: string }>; error_summary?: string }
    if (!response.ok) throw new Error(body.error_summary || 'Dropbox')
    return `Dropbox :\n${(body.entries ?? []).map((e) => `• ${e.name}`).join('\n') || 'dossier vide'}`
  }

  if (provider === 'pipedrive') {
    const key = secrets.PIPEDRIVE_API_TOKEN
    if (!key) throw new Error('Token Pipedrive manquant.')
    const response = await fetch(`https://api.pipedrive.com/v1/deals?limit=5&api_token=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json() as { data?: Array<{ title?: string }>; error?: string }
    if (!response.ok) throw new Error(body.error || 'Pipedrive')
    return `Deals Pipedrive : ${(body.data ?? []).map((d) => d.title).join(', ') || 'aucun'}`
  }

  if (provider === 'mootion') {
    const key = secrets.MOOTION_API_TOKEN || envSecret('MOOTION_API_TOKEN')
    if (!key) throw new Error('Token Mootion manquant dans l’environnement.')
    return 'Mootion prêt (clé présente). Utilisez la génération vidéo depuis le studio.'
  }

  if (provider === 'canva') {
    const key = secrets.CANVA_API_TOKEN
    if (!key) throw new Error('Token Canva manquant.')
    return 'Canva relié. Publication bloquée tant que l’API métier n’est pas appelée.'
  }

  return `${connectorOf(provider)?.label ?? provider} est relié (clé API). Outil « ${tool} » pas encore mappé.`
}

function isTokenLink(link: StoredLink): boolean {
  if (link.url.startsWith('token://')) return true
  const secret = parseSecret(link.token)
  return secret?.grant === 'api_key'
}

async function executeOauth(link: StoredLink, tool: string, args: Record<string, unknown>): Promise<string> {
  const provider = link.provider as OauthProvider | string
  if (isTokenLink(link)) return runTokenProvider(link, tool, args)
  if (provider === 'gmail') return runGmail(link, tool, args)
  if (provider === 'google_calendar') return runCalendar(link, tool, args)
  if (provider === 'google_drive') return runDrive(link, tool)
  if (provider === 'slack') return runSlack(link, tool, args)
  if (provider === 'github') return runGithub(link)
  if (provider === 'notion') return runNotion(link, args)
  if (provider === 'hubspot') return runHubspot(link)
  if (provider === 'outlook') return runOutlook(link, tool, args)
  if (provider === 'outlook_calendar') return runOutlookCalendar(link, tool, args)
  if (provider === 'teams') return runTeams(link, tool, args)
  if (provider === 'onedrive') return runOneDrive(link, tool)
  if (provider === 'dropbox') {
    // OAuth Dropbox stocke access dans link.token
    const secret = parseSecret(link.token)
    if (secret?.access) {
      const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: { authorization: `Bearer ${secret.access}`, 'content-type': 'application/json' },
        body: JSON.stringify({ path: '', limit: 8 }),
        signal: AbortSignal.timeout(12000),
      })
      const body = await response.json() as { entries?: Array<{ name?: string }>; error_summary?: string }
      if (!response.ok) throw new Error(body.error_summary || 'Dropbox')
      return `Dropbox :\n${(body.entries ?? []).map((e) => `• ${e.name}`).join('\n') || 'dossier vide'}`
    }
  }
  await googleAccess(link).catch(() => undefined)
  return `${connectorOf(provider)?.label ?? provider} est relié. Outil « ${tool} » pas encore mappé côté Gateway.`
}

function resolveToolName(link: StoredLink, requested: string): string {
  const want = requested.trim().toLowerCase()
  const exact = link.tools.find((item) => item.name.toLowerCase() === want)
  if (exact) return exact.name
  // Outils desktop connus : nom exact avant alias flous (évite read_document → create_document)
  if (isDesktopProvider(link.provider) && DESKTOP_TOOLS.some((tool) => tool.name === want)) {
    return want
  }
  const partial = link.tools.find((item) => item.name.toLowerCase().includes(want) || want.includes(item.name.toLowerCase()))
  if (partial) return partial.name
  const aliases: Record<string, string[]> = {
    prepare_reply: ['prepare', 'draft', 'répond', 'repond'],
    reply_email: ['reply'],
    send_email: ['send', 'mail', 'email'],
    list_messages: ['list', 'lire', 'read'],
    create_event: ['create', 'event'],
    list_events: ['list', 'lire', 'read'],
    post_message: ['post', 'send'],
    open_app: ['open', 'ouvre', 'lance', 'exec', 'launch'],
    control_app: ['control', 'play', 'joue', 'drive', 'run_in'],
    list_apps: ['apps', 'applications', 'logiciels', 'programmes'],
    list_files: ['list', 'lister', 'lire'],
    read_document: ['read_doc', 'lire_document', 'lire_fichier'],
    create_document: ['create_doc', 'note'],
    write_document: ['write', 'écrire', 'ecrire'],
    open_folder: ['folder', 'dossier', 'explorer'],
  }
  for (const [canonical, names] of Object.entries(aliases)) {
    // Exact / préfixe sûr — évite que « create » capture « create_document »
    const hitAlias = want === canonical
      || names.some((name) => want === name || want.startsWith(`${name}_`) || want.endsWith(`_${name}`))
    if (!hitAlias) continue
    const hit = link.tools.find((item) => item.name === canonical) || oauthToolsFor(link.provider).find((item) => item.name === canonical)
    if (hit) return hit.name
    if (isDesktopProvider(link.provider) && DESKTOP_TOOLS.some((tool) => tool.name === canonical)) return canonical
  }
  if (isDesktopProvider(link.provider) && DESKTOP_TOOLS.some((tool) => tool.name === want)) return want
  return link.tools[0]?.name || requested
}

/** Point d’entrée unique : MCP / n8n / OAuth natif. */
export async function gatewayInvoke(
  organizationId: string,
  provider: string,
  tool: string,
  input?: Record<string, unknown> | string,
): Promise<GatewayInvokeResult> {
  const link = findLink(organizationId, provider)
  if (!link || link.status !== 'connected') {
    return {
      ok: false,
      error: `${connectorOf(provider)?.label ?? 'Cet outil'} n’est pas encore relié. Cliquez sur Relier.`,
      tool,
      provider,
    }
  }
  const toolName = resolveToolName(link, tool)
  const args = asArgs(input)

  try {
    if (link.kind === 'oauth') {
      const result = await executeOauth(link, toolName, args)
      return { ok: true, result, tool: toolName, provider }
    }
    // Built-in Windows desktop agent (no external MCP required)
    if (link.url === 'local://desktop' || (isDesktopProvider(provider) && (!link.url || link.url.startsWith('local://')))) {
      const result = await desktopInvoke(toolName, args)
      return { ok: true, result, tool: toolName, provider }
    }
    // Prefer hub URL on the link; MCP token stays server-side
    if (!link.url) {
      return { ok: false, error: 'Aucune URL MCP configurée pour cet outil.', tool: toolName, provider }
    }
    // Refresh tool list opportunistically
    if (!link.tools.length) {
      const discovered = await mcpTools(link.url, link.token || undefined)
      if (discovered.length) saveLink({ ...link, tools: discovered })
    }
    const result = await mcpCall(link.url, toolName, args, link.token || undefined)
    return { ok: true, result: result.content, tool: toolName, provider }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'L’action n’a pas abouti.'
    return { ok: false, error: message, tool: toolName, provider }
  }
}

export function previewSensitiveAction(provider: string, tool: string, input?: Record<string, unknown> | string): string {
  const args = asArgs(input)
  const label = connectorOf(provider)?.label ?? provider
  if (/reply_email/i.test(tool) || (/reply/i.test(tool) && !/prepare/i.test(tool))) {
    const to = args.to ? ` à ${args.to}` : ''
    const subject = args.subject ? ` — « ${args.subject} »` : ''
    const excerpt = typeof args.body === 'string' && args.body.trim()
      ? ` · ${args.body.replace(/\s+/g, ' ').trim().slice(0, 90)}`
      : ''
    return `Envoyer la réponse${to} via ${label}${subject}${excerpt}`
  }
  if (/send_email|send/i.test(tool)) {
    const to = args.to ? ` à ${args.to}` : ''
    const subject = args.subject ? ` — « ${args.subject} »` : ''
    return `Envoyer un e-mail${to} via ${label}${subject}`
  }
  if (/write_document/i.test(tool)) {
    const title = String(args.title || args.name || 'fichier')
    const mode = String(args.mode || 'replace') === 'append' ? 'ajouter dans' : 'écrire dans'
    return `${mode} « ${title} » sur ${label}`
  }
  if (/create_document/i.test(tool)) {
    const title = String(args.title || args.name || args.filename || 'Note ATLAS')
    return `Créer le fichier « ${title} » sur ${label}`
  }
  if (/create_event/i.test(tool) || (/^create$/i.test(tool) && (args.summary || args.start))) {
    return `Créer l’événement « ${args.summary || 'Réunion'} » sur ${label}`
  }
  if (/post_message|post/i.test(tool)) {
    return `Poster sur ${label}${args.channel ? ` #${args.channel}` : ''}`
  }
  return `Appel ${tool} sur ${label}`
}
