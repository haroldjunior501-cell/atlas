import {
  ZTC_DEVOID_API,
  ZTC_GUEST_API,
  ZTC_SITE,
  ZTC_STORE,
  ztcCompany,
  ztcScopeOf,
  type ZtcCertainty,
  type ZtcCompany,
} from '@atlas/domain'
import { serverEnv } from './server-env'
import { publicUrl } from './web-tools'

export interface ZtcFact {
  label: string
  value: string
  certainty: ZtcCertainty
  source: string
  at: string
}

export interface ZtcConnectorStatus {
  id: string
  label: string
  certainty: ZtcCertainty
  note: string
  ok?: boolean
  latencyMs?: number
}

export interface ZtcLiveProduct {
  id: number
  title: string
  type: string
  categoryId: number
  priceFrom: number | null
  unit: string
  comingSoon: boolean
  description: string
}

export interface ZtcDevoidLive {
  ok: boolean
  status: string
  version?: string
  operator: string
  model?: string
  fossbilling?: boolean
  cloudflare?: boolean
  tools: string[]
  note: string
  certainty: ZtcCertainty
  latencyMs?: number
}

export interface ZtcLiveFeed {
  companyName: string
  signature: string
  www: string
  products: ZtcLiveProduct[]
  tlds: Array<{ tld: string; register: string; renew: string }>
  cart: { items: number; total: number; currency: string; note: string }
  news: Array<{ tag: string; title: string }>
  drift: string[]
  devoid: ZtcDevoidLive
}

export interface ZtcInventory {
  site: string
  at: string
  facts: ZtcFact[]
  connectors: ZtcConnectorStatus[]
  company: ZtcCompany
  live: ZtcLiveFeed
  ops: { scan: ZtcPublicScan; speed: ZtcSpeedPoint[] }
}

const now = () => new Date().toISOString()
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const HEADERS = { accept: 'application/json,text/plain,text/html', 'user-agent': UA, referer: ZTC_SITE, 'accept-language': 'en-US,en;q=0.9' }

function fact(label: string, value: string, certainty: ZtcCertainty, source: string): ZtcFact {
  return { label, value, certainty, source, at: now() }
}

function guestBase() {
  return (serverEnv('ZTC_FOSSBILLING_URL') || ZTC_GUEST_API.replace(/\/api\/guest$/, '')).replace(/\/$/, '')
}

function devoidBase() {
  return (serverEnv('ZTC_DEVOID_URL') || ZTC_DEVOID_API).replace(/\/$/, '')
}

async function jsonGet<T>(raw: string, timeout = 8000): Promise<{ ok: boolean; status: number; latencyMs: number; data: T | null }> {
  const url = publicUrl(raw)
  const started = Date.now()
  if (!url) return { ok: false, status: 0, latencyMs: 0, data: null }
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    })
    const latencyMs = Date.now() - started
    if (!response.ok) return { ok: false, status: response.status, latencyMs, data: null }
    return { ok: true, status: response.status, latencyMs, data: await response.json() as T }
  } catch {
    return { ok: false, status: 0, latencyMs: Date.now() - started, data: null }
  }
}

function numberOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function parseLiveProducts(raw: unknown): ZtcLiveProduct[] {
  const list = Array.isArray((raw as { result?: { list?: unknown } })?.result?.list)
    ? (raw as { result: { list: unknown[] } }).result.list
    : Array.isArray(raw) ? raw : []
  return list.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as {
      id?: unknown
      title?: unknown
      type?: unknown
      product_category_id?: unknown
      price_starting_from?: unknown
      unit?: unknown
      description?: unknown
      pricing?: { type?: unknown; recurrent?: { '1M'?: { price?: unknown } } }
    }
    const id = Number(row.id)
    const title = String(row.title ?? '').trim()
    if (!id || !title) return []
    const month = numberOf(row.pricing?.recurrent?.['1M']?.price)
    const from = numberOf(row.price_starting_from) ?? month
    return [{
      id,
      title,
      type: String(row.type ?? 'custom'),
      categoryId: Number(row.product_category_id) || 0,
      priceFrom: row.pricing?.type === 'free' ? 0 : from,
      unit: String(row.unit ?? 'month'),
      comingSoon: /coming soon|not available/i.test(title),
      description: String(row.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 180),
    }]
  })
}

export function parseDevoidHealth(raw: unknown, latencyMs?: number): ZtcDevoidLive {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const tools = Array.isArray(body.tools) ? body.tools.filter((item): item is string => typeof item === 'string') : []
  const ok = body.status === 'ok'
  return {
    ok,
    status: String(body.status ?? 'unknown'),
    version: typeof body.version === 'string' ? body.version : undefined,
    operator: typeof body.operator === 'string' ? body.operator : 'DEVOID',
    model: typeof body.model === 'string' ? body.model : undefined,
    fossbilling: body.fossbilling === true,
    cloudflare: body.cloudflare === true,
    tools,
    latencyMs,
    certainty: ok ? 'observed' : 'to_confirm',
    note: ok
      ? `DEVOID ${body.version ?? ''} en ligne. ATLAS orchestre ; le chat client reste sur le site.`
      : 'DEVOID injoignable. ATLAS ne simule pas un agent en ligne.',
  }
}

function priceLabel(product: ZtcLiveProduct) {
  if (product.comingSoon) return 'coming soon'
  if (product.priceFrom === 0) return 'gratuit'
  if (product.priceFrom == null) return 'prix à confirmer'
  return `$${product.priceFrom}/${product.unit === 'mailbox' ? 'boîte' : product.unit === 'year' ? 'an' : 'mo'}`
}

export async function ztcLiveFeed(): Promise<ZtcLiveFeed> {
  const shop = guestBase()
  const [productsRes, companyRes, homeRes, tldRes, cartRes, devoidRes] = await Promise.all([
    jsonGet<{ result?: { list?: unknown[] } }>(`${shop}/api/guest/product/get_list`),
    jsonGet<{ result?: { name?: string; signature?: string; www?: string } }>(`${shop}/api/guest/system/company`),
    jsonGet<{ result?: { news?: { cards?: Array<{ tag?: string; title?: string }> }; plans?: { cards?: Array<{ name?: string; price?: string }> } } }>(`${shop}/api/guest/cpanelmanager/homepage`),
    jsonGet<{ result?: Array<{ tld?: string; price_registration?: string; price_renew?: string }> }>(`${shop}/api/guest/servicedomain/tlds`),
    jsonGet<{ result?: { items?: unknown[]; total?: number; currency?: { symbol?: string; code?: string } } }>(`${shop}/api/guest/cart/get`),
    jsonGet<Record<string, unknown>>(`${devoidBase()}/health`),
  ])
  const products = parseLiveProducts(productsRes.data)
  const company = companyRes.data?.result ?? {}
  const news = (homeRes.data?.result?.news?.cards ?? []).map((card) => ({ tag: String(card.tag ?? ''), title: String(card.title ?? '') })).filter((item) => item.title)
  const cmsPlans = homeRes.data?.result?.plans?.cards ?? []
  const drift = cmsPlans.flatMap((card) => {
    const name = String(card.name ?? '')
    const cms = String(card.price ?? '')
    const live = products.find((item) => item.title.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(item.title.split(' ')[0]!.toLowerCase()))
    if (!live || !cms) return []
    const catalog = priceLabel(live)
    if (cms.replace(/\s/g, '') && !cms.includes(String(live.priceFrom ?? ''))) {
      return [`Accueil « ${name} ${cms} » ≠ boutique ${catalog}. Catalogue FOSSBilling maître.`]
    }
    return []
  })
  const tlds = (tldRes.data?.result ?? []).flatMap((row) => {
    const tld = String(row.tld ?? '')
    if (!tld) return []
    return [{ tld, register: String(row.price_registration ?? ''), renew: String(row.price_renew ?? '') }]
  })
  const cartItems = Array.isArray(cartRes.data?.result?.items) ? cartRes.data.result.items.length : 0
  return {
    companyName: company.name || 'ZtcHosting',
    signature: company.signature || '',
    www: company.www || ZTC_SITE,
    products,
    tlds,
    cart: {
      items: cartItems,
      total: numberOf(cartRes.data?.result?.total) ?? 0,
      currency: cartRes.data?.result?.currency?.symbol || cartRes.data?.result?.currency?.code || '$',
      note: 'Panier de la session ATLAS (guest), pas le panier d’un client.',
    },
    news,
    drift,
    devoid: parseDevoidHealth(devoidRes.data, devoidRes.latencyMs),
  }
}

export function factsFromLive(live: ZtcLiveFeed): ZtcFact[] {
  const facts: ZtcFact[] = [
    fact('Marque', `${live.companyName} — ${live.www}`, 'observed', `${guestBase()}/api/guest/system/company`),
    fact('Catalogue', `${live.products.length} SKU lus en live via FOSSBilling guest`, live.products.length ? 'observed' : 'to_confirm', `${guestBase()}/api/guest/product/get_list`),
  ]
  for (const product of live.products.slice(0, 16)) {
    facts.push(fact(product.title, `${priceLabel(product)}${product.comingSoon ? '' : product.description ? ` · ${product.description}` : ''}`, product.comingSoon ? 'to_confirm' : 'observed', `${ZTC_STORE}`))
  }
  if (live.devoid.ok) {
    facts.push(fact('DEVOID', `${live.devoid.operator} ${live.devoid.version ?? ''} · ${live.devoid.model ?? 'modèle'} · FOSSBilling ${live.devoid.fossbilling ? 'relié' : 'non'} · ${live.devoid.tools.length} outils`, 'observed', `${devoidBase()}/health`))
  } else {
    facts.push(fact('DEVOID', live.devoid.note, 'to_confirm', `${devoidBase()}/health`))
  }
  for (const item of live.drift) facts.push(fact('Écart accueil / boutique', item, 'to_confirm', `${guestBase()}/api/guest/cpanelmanager/homepage`))
  return facts
}

export async function ztcPublicCatalog(): Promise<ZtcFact[]> {
  return factsFromLive(await ztcLiveFeed())
}

async function probe(id: string, label: string, raw: string, path = ''): Promise<ZtcConnectorStatus> {
  if (!raw) return { id, label, certainty: 'unconfigured', note: 'URL absente de l’environnement. Aucun secret demandé dans le chat.' }
  const url = publicUrl(raw.endsWith('/') ? `${raw}${path.replace(/^\//, '')}` : path ? `${raw.replace(/\/$/, '')}${path}` : raw)
  if (!url) return { id, label, certainty: 'unconfigured', note: 'URL interne ou invalide : ATLAS ne sonde que le web public.' }
  const started = Date.now()
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000), redirect: 'follow' })
    return {
      id, label,
      certainty: response.ok ? 'observed' : 'to_confirm',
      ok: response.ok,
      latencyMs: Date.now() - started,
      note: `${url.host} a répondu ${response.status}. Lecture seule, aucune écriture.`,
    }
  } catch {
    return { id, label, certainty: 'to_confirm', ok: false, latencyMs: Date.now() - started, note: `${url.host} injoignable depuis ATLAS.` }
  }
}

export async function ztcInventory(): Promise<ZtcInventory> {
  const shop = guestBase()
  const [live, connectors] = await Promise.all([
    ztcLiveFeed(),
    Promise.all([
      probe('site', 'Site public', ZTC_SITE),
      probe('fossbilling', 'FOSSBilling guest', `${shop}/api/guest/product/get_list`),
      probe('devoid', 'DEVOID /health', devoidBase(), '/health'),
      probe('ztc_core', 'Portail / API métier ZTC', serverEnv('ZTC_CORE_API')),
      probe('whm', 'WHM / cPanel Azure', serverEnv('ZTC_WHM_URL')),
    ]),
  ])
  const ops = await ztcPublicOps()
  return { site: ZTC_SITE, at: now(), facts: factsFromLive(live), connectors, company: ztcCompany(), live, ops }
}

export interface ZtcSpeedPoint {
  path: string
  status: number
  ttfbMs: number
  bytes: number
  cache: string
  ok: boolean
}

export interface ZtcPublicScan {
  url: string
  at: string
  status: number
  server: string
  headers: Record<string, string>
  missing: string[]
  notes: string[]
}

export function liveForDesk(feed: ZtcLiveFeed, desk: string) {
  const scope = ztcScopeOf(desk)
  const allow = new Set(scope.datasets)
  return {
    desk,
    firstName: scope.firstName,
    datasets: scope.datasets,
    company: allow.has('company') ? { name: feed.companyName, signature: feed.signature, www: feed.www } : null,
    products: allow.has('catalog') ? feed.products : [],
    tlds: allow.has('tlds') ? feed.tlds : [],
    news: allow.has('homepage') ? feed.news : [],
    drift: allow.has('homepage') ? feed.drift : [],
    devoid: allow.has('devoid') ? feed.devoid : { ok: false, operator: '', tools: [] as string[], note: 'Hors périmètre de ce bureau.' },
    cart: allow.has('catalog') ? feed.cart : { items: 0, total: 0, currency: 'USD', note: 'Hors périmètre.' },
  }
}

function pickHeader(headers: Headers, name: string) {
  return headers.get(name) || headers.get(name.toLowerCase()) || ''
}

export async function scanPublicHeaders(target = ZTC_SITE): Promise<ZtcPublicScan> {
  const url = publicUrl(target) ?? new URL(ZTC_SITE)
  const wanted = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy']
  const started = Date.now()
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000), redirect: 'follow' })
    const headers: Record<string, string> = {}
    for (const key of ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'server', 'cf-ray', 'nel']) {
      const value = pickHeader(response.headers, key)
      if (value) headers[key] = value.slice(0, 280)
    }
    const missing = wanted.filter((key) => !headers[key])
    return {
      url: url.href,
      at: now(),
      status: response.status,
      server: headers.server || 'non annoncé',
      headers,
      missing,
      notes: [
        `Lecture publique ${url.href} en ${Date.now() - started} ms · HTTP ${response.status}.`,
        'Radar / Aegis : surface et écarts de durcissement seulement. Aucun exploit, aucun PoC, aucun scan agressif.',
        headers.server ? `Serveur annoncé : ${headers.server}.` : 'Le serveur n’annonce pas son nom.',
      ],
    }
  } catch {
    return {
      url: url.href,
      at: now(),
      status: 0,
      server: 'injoignable',
      headers: {},
      missing: wanted,
      notes: [`Scan public injoignable depuis ATLAS (${Date.now() - started} ms).`],
    }
  }
}

export async function measurePublicSpeed(): Promise<ZtcSpeedPoint[]> {
  const paths = ['/', '/order', '/login', '/api/guest/system/company', '/devoid-api/health']
  return Promise.all(paths.map(async (path) => {
    const url = `${ZTC_SITE}${path === '/' ? '' : path}`
    const started = Date.now()
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000), redirect: 'follow' })
      const body = await response.arrayBuffer()
      return {
        path,
        status: response.status,
        ttfbMs: Date.now() - started,
        bytes: body.byteLength,
        cache: pickHeader(response.headers, 'cf-cache-status') || pickHeader(response.headers, 'cache-control') || 'none',
        ok: response.ok,
      }
    } catch {
      return { path, status: 0, ttfbMs: Date.now() - started, bytes: 0, cache: 'none', ok: false }
    }
  }))
}

let opsCache: { at: number; scan: ZtcPublicScan; speed: ZtcSpeedPoint[] } | null = null

export async function ztcPublicOps() {
  if (opsCache && Date.now() - opsCache.at < 30_000) return opsCache
  const [scan, speed] = await Promise.all([scanPublicHeaders(), measurePublicSpeed()])
  opsCache = { at: Date.now(), scan, speed }
  return opsCache
}

export async function deskSnapshot(desk: string) {
  const [feed, ops] = await Promise.all([ztcLiveFeed(), ztcPublicOps()])
  const scoped = liveForDesk(feed, desk)
  const scope = ztcScopeOf(desk)
  return {
    desk,
    firstName: scope.firstName,
    datasets: scope.datasets,
    scoped,
    scan: scope.datasets.includes('headers') ? ops.scan : null,
    speed: scope.datasets.includes('speed') ? ops.speed : null,
  }
}

export function formatDeskPrompt(snap: Awaited<ReturnType<typeof deskSnapshot>>) {
  const lines = [
    `BUREAU LIVE · ${snap.firstName} · jeux : ${snap.datasets.join(', ')}`,
    'N’invente rien. Ce qui n’est pas dans ce périmètre est absent, pas à déduire.',
  ]
  if (snap.scoped.company) lines.push(`Société : ${snap.scoped.company.name} · ${snap.scoped.company.www}`)
  if (snap.scoped.products.length) {
    lines.push('Catalogue FOSSBilling (observé) :')
    for (const product of snap.scoped.products.slice(0, 16)) {
      const price = product.comingSoon ? 'coming soon' : product.priceFrom === 0 ? 'gratuit' : product.priceFrom != null ? `$${product.priceFrom}` : '—'
      lines.push(`- ${product.title} · ${price}`)
    }
  }
  if (snap.scoped.devoid.ok) {
    lines.push(`DEVOID : ${snap.scoped.devoid.operator} ${snap.scoped.devoid.version ?? ''} · ${snap.scoped.devoid.tools.length} outils`)
  } else if (snap.scoped.devoid.note) {
    lines.push(`DEVOID : ${snap.scoped.devoid.note}`)
  }
  if (snap.scan) {
    lines.push(`Scan public ${snap.scan.url} · HTTP ${snap.scan.status} · serveur ${snap.scan.server}`)
    lines.push(`En-têtes : ${Object.keys(snap.scan.headers).join(', ') || 'aucun'}`)
    if (snap.scan.missing.length) lines.push(`Manquants : ${snap.scan.missing.join(', ')}`)
  }
  if (snap.speed?.length) {
    lines.push('Rapidité observée :')
    for (const point of snap.speed) lines.push(`- ${point.path} · ${point.ttfbMs} ms · HTTP ${point.status} · ${point.bytes} o`)
  }
  return lines.join('\n')
}
