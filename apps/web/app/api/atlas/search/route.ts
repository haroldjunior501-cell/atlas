import { nemotron } from '@/lib/nemotron'
import { researchModeOf, type ResearchMode } from '@atlas/domain'

interface Hit {
  title: string
  extract: string
  url: string
}

const STOP = new Set([
  'les', 'des', 'une', 'que', 'nous', 'vous', 'pour', 'dans', 'avec', 'sur', 'faire', 'fais',
  'allons', 'cette', 'cette', 'sont', 'plus', 'dont', 'aussi', 'comme', 'atlas', 'jarvis',
])

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const MODE_HINT: Record<ResearchMode, string> = {
  general: 'Synthèse claire, sources, prochaine action.',
  compare: 'Compare explicitement les options (tableau mental), critères, recommandation.',
  company: 'Présente l’entreprise : activité, positionnement, signaux utiles.',
  training: 'Formations pertinentes : format, niveau, critères de choix.',
  job: 'Offres / pistes emploi : profils, mots-clés, où postuler.',
  internship: 'Alternances / stages : pistes, mots-clés, conseils candidature.',
  product: 'Compare produits ou offres, pour / contre, reco.',
  event: 'Événements possibles : type, où chercher, critères.',
  ticket: 'Billets / trajets : options typiques et conseils de recherche.',
  hotel: 'Hébergements : critères (quartier, budget), pistes.',
  website: 'Analyse le site ou le sujet web : forces, faiblesses, améliorations.',
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
}

function tokensOf(query: string): string[] {
  return query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3 && !STOP.has(word))
}

function focusQuery(query: string, organization?: string, intention?: string, mode?: ResearchMode): string {
  const core = query
    .replace(/\b(atlas|jarvis|faire|fais|faites|peux[- ]tu|recherche|recherches|cherche|google|bing|trouve[- ]moi|adopte|adopter|applique|déploie|deploie)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const modeBoost =
    mode === 'job' ? 'offre emploi'
      : mode === 'internship' ? 'alternance'
        : mode === 'hotel' ? 'hôtel'
          : mode === 'ticket' ? 'billet'
            : mode === 'training' ? 'formation'
              : mode === 'company' ? 'entreprise'
                : ''
  return [core || 'information utile', modeBoost, organization, intention].filter(Boolean).join(' ').slice(0, 160)
}

function noise(hit: Hit): boolean {
  const blob = `${hit.title} ${hit.extract}`.toLowerCase()
  return /série télévisée|serie televisee|\bmusicien\b|\bacteur\b|\bactrice\b|personnage de fiction|épisode de|homonymie|disambiguation|\balbum\b \( |\bfilm\b de |the office|prince \(musician\)|wikipédia:/i.test(blob)
}

function relevant(hit: Hit, query: string): boolean {
  if (noise(hit)) return false
  const tokens = tokensOf(query)
  if (tokens.length === 0) return true
  const blob = `${hit.title} ${hit.extract}`.toLowerCase()
  return tokens.some((token) => blob.includes(token))
}

function commercial(query: string): boolean {
  return /produit|vendre|offre|march[eé]|agence|saas|marketing|prix|client|pack|abonnement/i.test(query)
}

function usable(text: string): boolean {
  return Boolean(text.trim()) && !/ne (?:peux|peut) pas r[eé]pondre|extraits (?:fournis|ne contiennent)|aucune information pertinente|hors sujet/i.test(text)
}

function decodeDuck(href: string): string {
  try {
    const url = new URL(href, 'https://duckduckgo.com')
    const target = url.searchParams.get('uddg')
    if (target) return decodeURIComponent(target)
    if (href.startsWith('http')) return href
    if (href.startsWith('//')) return `https:${href}`
    return href
  } catch {
    return href
  }
}

function wikiUrl(title: string) {
  return `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

function adviceFallback(query: string, mode: ResearchMode, organization?: string, intention?: string, hits: Hit[] = []): string {
  const métier = [organization, intention].filter(Boolean).join(' — ')
  const source = hits[0] ? `Je m’appuie notamment sur « ${hits[0].title} ». ` : ''
  const hint = MODE_HINT[mode]
  const context = métier ? `Contexte : ${métier}. ` : ''
  return `${source}${context}${hint} Demande : ${query.slice(0, 100)}.`
}

async function wikipedia(query: string): Promise<Hit[]> {
  const search = new URL('https://fr.wikipedia.org/w/api.php')
  search.searchParams.set('action', 'query')
  search.searchParams.set('list', 'search')
  search.searchParams.set('srsearch', query)
  search.searchParams.set('srlimit', '5')
  search.searchParams.set('utf8', '1')
  search.searchParams.set('format', 'json')
  const found = await fetch(search, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000) })
  if (!found.ok) return []
  const body = await found.json() as { query?: { search?: { title: string }[] } }
  const titles = (body.query?.search ?? []).map((item) => item.title).slice(0, 4)
  if (titles.length === 0) return []
  const page = new URL('https://fr.wikipedia.org/w/api.php')
  page.searchParams.set('action', 'query')
  page.searchParams.set('prop', 'extracts')
  page.searchParams.set('exintro', '1')
  page.searchParams.set('explaintext', '1')
  page.searchParams.set('titles', titles.join('|'))
  page.searchParams.set('format', 'json')
  const detail = await fetch(page, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000) })
  if (!detail.ok) return titles.map((title) => ({ title, extract: '', url: wikiUrl(title) })).filter((item) => relevant(item, query))
  const pages = await detail.json() as { query?: { pages?: Record<string, { title?: string; extract?: string }> } }
  return Object.values(pages.query?.pages ?? {}).map((item) => ({
    title: item.title ?? '',
    extract: (item.extract ?? '').replace(/\s+/g, ' ').trim().slice(0, 700),
    url: wikiUrl(item.title ?? ''),
  })).filter((item) => item.title && relevant(item, query))
}

async function duckHtml(query: string): Promise<Hit[]> {
  const url = new URL('https://html.duckduckgo.com/html/')
  url.searchParams.set('q', query)
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': UA },
    signal: AbortSignal.timeout(4500),
  })
  if (!response.ok) return []
  const html = await response.text()
  const hits: Hit[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeDuck(match[1] ?? '')
    const title = stripTags(match[2] ?? '')
    if (!title || !href.startsWith('http') || /duckduckgo\.com/i.test(href) || seen.has(href)) continue
    seen.add(href)
    hits.push({ title, extract: '', url: href })
    if (hits.length >= 6) break
  }
  const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|span)>/gi)].map((item) => stripTags(item[1] ?? ''))
  return hits.map((hit, index) => ({ ...hit, extract: (snippets[index] ?? '').slice(0, 280) })).filter((hit) => !noise(hit))
}

async function duckLite(query: string): Promise<Hit[]> {
  const url = new URL('https://lite.duckduckgo.com/lite/')
  url.searchParams.set('q', query)
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': UA },
    signal: AbortSignal.timeout(4500),
  })
  if (!response.ok) return []
  const html = await response.text()
  const hits: Hit[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeDuck(match[1] ?? '')
    const title = stripTags(match[2] ?? '')
    if (!title || title.length < 8 || !href.startsWith('http') || /duckduckgo\.com/i.test(href) || seen.has(href)) continue
    seen.add(href)
    hits.push({ title, extract: '', url: href })
    if (hits.length >= 6) break
  }
  return hits.filter((hit) => !noise(hit))
}

async function duck(query: string): Promise<Hit | null> {
  const url = new URL('https://api.duckduckgo.com/')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('no_html', '1')
  url.searchParams.set('skip_disambig', '1')
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(3500) })
  if (!response.ok) return null
  const body = await response.json() as { Heading?: string; AbstractText?: string }
  const extract = (body.AbstractText ?? '').replace(/\s+/g, ' ').trim().slice(0, 700)
  if (!extract) return null
  const hit = { title: body.Heading || 'Résumé', extract, url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}` }
  return relevant(hit, query) ? hit : null
}

async function summarize(query: string, hits: Hit[], context: string, mode: ResearchMode): Promise<string | null> {
  const dossier = hits.map((hit) => `${hit.title}. ${hit.extract}`.trim()).join('\n')
  return nemotron(
    `Tu es Atlas, partenaire de vie et de travail. Mode recherche : ${mode}. ${MODE_HINT[mode]}
${context}
Primary language: English. Reply in English by default (3–6 concrete sentences); mirror the user if they clearly use another language. If several sources, compare them briefly.
Tu ignores les extraits hors sujet. Si les sources sont pauvres, conseille quand même utilement.
Interdit : « je ne peux pas répondre », « les extraits ne suffisent pas ».
Tu n’inventes ni chiffre d’entreprise connectée ni outil déjà relié.`,
    `Demande : ${query}\nSources :\n${dossier || 'aucune source web utile — réponds utilement quand même.'}`,
    360,
    12000,
  )
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    query?: string
    organization?: string
    intention?: string
    roles?: string[]
    mode?: string
    memory?: string
  } | null
  const query = body?.query?.trim() ?? ''
  if (query.length < 2) return Response.json({ error: 'vide' }, { status: 400 })
  const mode = (body?.mode && body.mode in MODE_HINT ? body.mode as ResearchMode : researchModeOf(query))
  const topic = focusQuery(query, body?.organization, body?.intention, mode)
  const [html, lite, instant] = await Promise.all([
    duckHtml(topic).catch(() => [] as Hit[]),
    duckLite(topic).catch(() => [] as Hit[]),
    duck(topic).catch(() => null),
  ])
  let pages: Hit[] = []
  if (html.length + lite.length < 2 && !commercial(query) && mode === 'general') {
    pages = await wikipedia(topic).catch(() => [] as Hit[])
  }
  const hits = [
    ...(instant ? [instant] : []),
    ...html,
    ...lite,
    ...pages,
  ].filter((hit, index, list) => !noise(hit) && list.findIndex((item) => item.url === hit.url || item.title === hit.title) === index).slice(0, 6)
  const context = [
    body?.organization ? `Entreprise : ${body.organization}.` : '',
    body?.intention ? `Activité : ${body.intention}.` : '',
    body?.roles?.length ? `Équipe : ${body.roles.join(', ')}.` : '',
    body?.memory ? `Mémoire perso : ${body.memory.slice(0, 400)}` : '',
  ].filter(Boolean).join(' ')
  const spoken = await summarize(query, hits, context || 'Contexte personnel ou pro selon la demande.', mode)
  const fallback = adviceFallback(query, mode, body?.organization, body?.intention, hits)
  return Response.json({
    reply: usable(spoken ?? '') ? spoken : fallback,
    mode,
    sources: hits.map((hit) => ({ title: hit.title, extract: hit.extract, url: hit.url })),
  })
}
