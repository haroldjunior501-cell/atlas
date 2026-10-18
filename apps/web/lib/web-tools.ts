const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export interface WebHit {
  title: string
  url: string
  snippet: string
}

export interface WebPage {
  url: string
  title: string
  text: string
  ok: boolean
  status: number
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&rsquo;/g, '’')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
}

function strip(html: string) {
  return decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function target(href: string) {
  try {
    const url = new URL(href, 'https://duckduckgo.com')
    const real = url.searchParams.get('uddg')
    if (real) return decodeURIComponent(real)
    return href.startsWith('//') ? `https:${href}` : href
  } catch {
    return href
  }
}

/** WebSearch : vraie recherche (DuckDuckGo HTML, puis Lite en secours). */
export async function webSearch(query: string, limit = 6): Promise<WebHit[]> {
  const hits: WebHit[] = []
  const seen = new Set<string>()
  const push = (href: string, title: string, snippet = '') => {
    const url = target(href)
    if (!title || !/^https?:/i.test(url) || /duckduckgo\.com|\/y\.js/i.test(url) || seen.has(url)) return
    seen.add(url)
    hits.push({ title, url, snippet })
  }
  try {
    const url = new URL('https://html.duckduckgo.com/html/')
    url.searchParams.set('q', query)
    url.searchParams.set('kl', 'us-en')
    const response = await fetch(url, { headers: { accept: 'text/html', 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(6000) })
    if (response.ok) {
      const html = await response.text()
      const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|span)>/gi)].map((match) => strip(match[1] ?? ''))
      let index = 0
      for (const match of html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        push(match[1] ?? '', strip(match[2] ?? ''), (snippets[index] ?? '').slice(0, 300))
        index += 1
      }
    }
  } catch { /* la version Lite prend le relais */ }
  if (hits.length < 2) {
    try {
      const url = new URL('https://lite.duckduckgo.com/lite/')
      url.searchParams.set('q', query)
      const response = await fetch(url, { headers: { accept: 'text/html', 'user-agent': UA }, signal: AbortSignal.timeout(6000) })
      if (response.ok) {
        const html = await response.text()
        for (const match of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi)) push(match[1] ?? '', strip(match[2] ?? ''))
        if (hits.length < 2) for (const match of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
          const title = strip(match[2] ?? '')
          if (title.length >= 8) push(match[1] ?? '', title)
        }
      }
    } catch { /* Bing prend le relais */ }
  }
  const short = query.split(/\s+/).slice(0, 3).join(' ')
  for (const text of short === query ? [query] : [query, short]) {
    if (hits.length >= 2) break
    try {
      const url = new URL('https://www.bing.com/search')
      url.searchParams.set('format', 'rss')
      url.searchParams.set('q', text)
      const response = await fetch(url, { headers: { accept: 'application/rss+xml,text/xml', 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) })
      if (!response.ok) continue
      const xml = await response.text()
      for (const match of xml.matchAll(/<item><title>([\s\S]*?)<\/title><link>([\s\S]*?)<\/link>(?:<description>([\s\S]*?)<\/description>)?/gi)) {
        push(decode(match[2] ?? ''), strip(match[1] ?? ''), strip(match[3] ?? '').slice(0, 300))
      }
    } catch { /* aucun résultat */ }
  }
  return hits.slice(0, limit)
}

/** Refuse les adresses locales ou internes : l’agent ne lit que le web public. */
export function publicUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host === '0.0.0.0' || host.includes(':')
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) return null
  return url
}

/** WebFetch : lit une vraie page et en garde le texte utile. */
export async function webFetch(raw: string, max = 7000): Promise<WebPage> {
  const url = publicUrl(raw)
  if (!url) return { url: raw, title: '', text: '', ok: false, status: 0 }
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    const type = response.headers.get('content-type') ?? ''
    if (!response.ok || !/text\/html|xhtml|text\/plain/i.test(type)) return { url: url.href, title: '', text: '', ok: false, status: response.status }
    const html = (await response.text()).slice(0, 1_500_000)
    const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 140)
    const description = decode(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] ?? '')
    const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((match) => (match[1] ?? '').match(/"(?:name|price|priceCurrency|unitText|unitCode|billingDuration|billingIncrement|ratingValue|reviewCount|weight)"\s*:\s*"?[^",}]+/g)?.join(' ') ?? '')
      .join(' ')
      .slice(0, 1500)
    const body = html
      .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    const text = [description, ld, strip(body)].filter(Boolean).join(' · ').slice(0, max)
    return { url: response.url || url.href, title, text, ok: text.length > 80, status: response.status }
  } catch {
    return { url: url.href, title: '', text: '', ok: false, status: 0 }
  }
}

export function hostOf(raw: string) {
  try {
    return new URL(raw).hostname.replace(/^www\./, '')
  } catch {
    return raw
  }
}
