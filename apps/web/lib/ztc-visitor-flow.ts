import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Département Flux visiteurs (Funnel) — ztchosting.com
 * Visiteurs observés → prospects → rapports détaillés.
 */

export type VisitorHit = {
  id: string
  sessionId: string
  path: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  country?: string
  userAgent?: string
  at: string
}

export type Prospect = {
  id: string
  sessionId: string
  email?: string
  name?: string
  interest?: string
  score: number
  source: string
  pages: string[]
  hits: number
  createdAt: string
  updatedAt: string
  status: 'new' | 'warm' | 'contacted' | 'qualified' | 'won' | 'lost'
}

type Store = {
  visits: VisitorHit[]
  prospects: Prospect[]
}

function storePath() {
  const override = process.env.ZTC_VISITOR_FLOW_PATH?.trim()
  if (override) return override
  const candidates = [
    join(process.cwd(), 'data', 'ztc-visitor-flow.json'),
    join(process.cwd(), '..', '..', 'data', 'ztc-visitor-flow.json'),
  ]
  return candidates.find((item) => existsSync(dirname(item))) ?? candidates[0]!
}

function readStore(): Store {
  const path = storePath()
  if (!existsSync(path)) return { visits: [], prospects: [] }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<Store>
    return {
      visits: Array.isArray(raw.visits) ? raw.visits : [],
      prospects: Array.isArray(raw.prospects) ? raw.prospects : [],
    }
  } catch {
    return { visits: [], prospects: [] }
  }
}

function writeStore(store: Store) {
  const path = storePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({
    visits: store.visits.slice(-5000),
    prospects: store.prospects.slice(-1000),
  }, null, 2))
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function scoreSession(hits: VisitorHit[]) {
  let score = Math.min(40, hits.length * 8)
  const paths = hits.map((hit) => hit.path.toLowerCase())
  if (paths.some((path) => path.includes('/order'))) score += 25
  if (paths.some((path) => path.includes('/login'))) score += 10
  if (paths.some((path) => /hosting|vps|pricing|tarif|plan/.test(path))) score += 15
  if (hits.some((hit) => hit.utmSource || hit.utmCampaign)) score += 10
  return Math.min(100, score)
}

export type VisitInput = {
  path?: string
  sessionId?: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  country?: string
  userAgent?: string
}

/** Enregistre une visite observée (appelée par le site / pixel / DEVOID). */
export function ztcRecordVisit(input: VisitInput) {
  const path = String(input.path || '/').trim().slice(0, 300) || '/'
  const sessionId = String(input.sessionId || `anon_${Date.now().toString(36)}`).slice(0, 80)
  const hit: VisitorHit = {
    id: newId('hit'),
    sessionId,
    path,
    referrer: input.referrer?.trim().slice(0, 300) || undefined,
    utmSource: input.utmSource?.trim().slice(0, 80) || undefined,
    utmMedium: input.utmMedium?.trim().slice(0, 80) || undefined,
    utmCampaign: input.utmCampaign?.trim().slice(0, 80) || undefined,
    country: input.country?.trim().slice(0, 40) || undefined,
    userAgent: input.userAgent?.trim().slice(0, 200) || undefined,
    at: new Date().toISOString(),
  }
  const store = readStore()
  store.visits.push(hit)
  writeStore(store)
  return { ok: true, hit, desk: 'Funnel' }
}

export type ProspectInput = {
  sessionId?: string
  email?: string
  name?: string
  interest?: string
  status?: Prospect['status']
}

/** Transforme une session visiteurs en prospect (Funnel). */
export function ztcQualifyProspect(input: ProspectInput) {
  const sessionId = String(input.sessionId || '').trim()
  if (!sessionId && !input.email) throw new Error('sessionId ou email requis pour créer un prospect.')
  const store = readStore()
  const hits = sessionId
    ? store.visits.filter((hit) => hit.sessionId === sessionId)
    : []
  const pages = [...new Set(hits.map((hit) => hit.path))].slice(0, 20)
  const score = hits.length ? scoreSession(hits) : (input.email ? 35 : 10)
  const source = hits.find((hit) => hit.utmSource)?.utmSource
    || hits.find((hit) => hit.referrer)?.referrer
    || 'direct'
  const existing = store.prospects.findIndex((row) =>
    (sessionId && row.sessionId === sessionId)
    || (input.email && row.email && row.email.toLowerCase() === input.email.trim().toLowerCase()),
  )
  const now = new Date().toISOString()
  const prospect: Prospect = existing >= 0
    ? {
        ...store.prospects[existing]!,
        email: input.email?.trim().slice(0, 120) || store.prospects[existing]!.email,
        name: input.name?.trim().slice(0, 80) || store.prospects[existing]!.name,
        interest: input.interest?.trim().slice(0, 200) || store.prospects[existing]!.interest,
        score: Math.max(store.prospects[existing]!.score, score),
        pages: [...new Set([...store.prospects[existing]!.pages, ...pages])].slice(0, 30),
        hits: Math.max(store.prospects[existing]!.hits, hits.length),
        status: input.status || store.prospects[existing]!.status,
        updatedAt: now,
      }
    : {
        id: newId('pro'),
        sessionId: sessionId || `email_${Date.now().toString(36)}`,
        email: input.email?.trim().slice(0, 120) || undefined,
        name: input.name?.trim().slice(0, 80) || undefined,
        interest: input.interest?.trim().slice(0, 200) || undefined,
        score,
        source: String(source).slice(0, 160),
        pages,
        hits: hits.length,
        createdAt: now,
        updatedAt: now,
        status: input.status || 'new',
      }
  if (existing >= 0) store.prospects[existing] = prospect
  else store.prospects.push(prospect)
  writeStore(store)
  return { ok: true, prospect, desk: 'Funnel' }
}

export type ReportPeriod = 'day' | 'week' | 'month' | 'all'

function sinceFor(period: ReportPeriod) {
  if (period === 'all') return 0
  const ms = period === 'day' ? 86_400_000 : period === 'week' ? 604_800_000 : 2_592_000_000
  return Date.now() - ms
}

/** Rapport détaillé Funnel — faits observés uniquement. */
export function ztcVisitorReport(period: ReportPeriod = 'week') {
  const store = readStore()
  const since = sinceFor(period)
  const visits = store.visits.filter((hit) => new Date(hit.at).getTime() >= since)
  const sessions = new Set(visits.map((hit) => hit.sessionId))
  const byPath = new Map<string, number>()
  const bySource = new Map<string, number>()
  for (const hit of visits) {
    byPath.set(hit.path, (byPath.get(hit.path) || 0) + 1)
    const src = hit.utmSource || (hit.referrer ? 'referral' : 'direct')
    bySource.set(src, (bySource.get(src) || 0) + 1)
  }
  const topPages = [...byPath.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([path, hits]) => ({ path, hits }))
  const sources = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, hits]) => ({ source, hits }))
  const prospects = store.prospects.filter((row) => new Date(row.updatedAt).getTime() >= since)
  const orderHits = visits.filter((hit) => /\/order/i.test(hit.path)).length
  const conversionRate = sessions.size
    ? Math.round((prospects.length / sessions.size) * 1000) / 10
    : 0

  const summary = [
    `Rapport Funnel (${period}) — ztchosting.com`,
    `${visits.length} hits · ${sessions.size} sessions uniques · ${orderHits} vues /order.`,
    `${prospects.length} prospects · taux session→prospect ${conversionRate} %.`,
    topPages[0] ? `Page la plus vue : ${topPages[0].path} (${topPages[0].hits}).` : 'Aucune page enregistrée sur la période.',
    sources[0] ? `Source dominante : ${sources[0].source} (${sources[0].hits}).` : '',
  ].filter(Boolean).join(' ')

  return {
    ok: true,
    desk: 'Funnel',
    period,
    observed: true,
    certainty: 'observed' as const,
    summary,
    metrics: {
      hits: visits.length,
      sessions: sessions.size,
      orderViews: orderHits,
      prospects: prospects.length,
      conversionRatePct: conversionRate,
    },
    topPages,
    sources,
    prospects: prospects
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        score: row.score,
        status: row.status,
        interest: row.interest,
        hits: row.hits,
        pages: row.pages.slice(0, 5),
      })),
  }
}

export function ztcVisitorSnapshot() {
  const day = ztcVisitorReport('day')
  const week = ztcVisitorReport('week')
  return {
    ok: true,
    desk: 'Funnel',
    today: day.metrics,
    week: week.metrics,
    summary: `Aujourd’hui : ${day.metrics.sessions} sessions · Semaine : ${week.metrics.sessions} sessions, ${week.metrics.prospects} prospects.`,
  }
}
