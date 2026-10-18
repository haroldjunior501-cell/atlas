import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ZTC_ATLAS_RULES, ZTC_DESKS, ZTC_SITE, ztcDeskOf, ztcDevoidToolsOf, ztcScopeOf, ztcSkillsOf } from '@atlas/domain'
import { amdGemmaModel, amdVllmModel, thinkOnAmd } from './amd-vllm'
import { hackathonStack } from './hackathon-stack'
import { writeOauthApps } from './oauth-apps-store'
import { serverEnv } from './server-env'
import { deskSnapshot, formatDeskPrompt, ztcInventory } from './ztc-live'

export type ZtcIngestFact = {
  desk?: string
  label: string
  value: string
  source: string
  certainty: 'observed' | 'historical'
  at: string
}

const LINK_KEYS = ['ZTC_CORE_API', 'ZTC_FOSSBILLING_URL', 'ZTC_DEVOID_URL', 'ZTC_WHM_URL', 'ZTC_BRIDGE_TOKEN', 'ZTC_DEVOID_TOKEN'] as const

function ingestPath() {
  const override = process.env.ZTC_INGEST_PATH?.trim()
  if (override) return override
  const candidates = [
    join(process.cwd(), 'data', 'ztc-ingest.json'),
    join(process.cwd(), '..', '..', 'data', 'ztc-ingest.json'),
  ]
  return candidates.find((item) => existsSync(dirname(item))) ?? candidates[0]!
}

export function readIngest(): ZtcIngestFact[] {
  const path = ingestPath()
  if (!existsSync(path)) return []
  try {
    const rows = JSON.parse(readFileSync(path, 'utf8')) as ZtcIngestFact[]
    return Array.isArray(rows) ? rows.slice(-80) : []
  } catch {
    return []
  }
}

export function ingestForDesk(desk: string) {
  const name = desk.trim().toLowerCase()
  return readIngest().filter((row) => !row.desk || row.desk.toLowerCase() === name)
}

export function writeIngest(facts: ZtcIngestFact[]) {
  const path = ingestPath()
  mkdirSync(dirname(path), { recursive: true })
  const next = [...readIngest(), ...facts].slice(-80)
  writeFileSync(path, JSON.stringify(next, null, 2))
  return next
}

export function bridgeToken() {
  return (serverEnv('ZTC_BRIDGE_TOKEN') || '').trim()
}

export function bridgeAuthorized(request: Request) {
  const expected = bridgeToken()
  if (!expected) return { ok: true, open: true }
  const header = request.headers.get('authorization') || ''
  const got = header.replace(/^Bearer\s+/i, '').trim()
  const query = new URL(request.url).searchParams.get('token') || ''
  return { ok: got === expected || query === expected, open: false }
}

export function serviceUrl(raw: string) {
  const text = raw.trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    if (!/^https?:$/.test(url.protocol)) return ''
    if (url.username || url.password) return ''
    return url.href.replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function ingestLines(desk: string) {
  const rows = ingestForDesk(desk)
  if (!rows.length) return ''
  return ['Faits poussés par le produit ZTC (observés / historiques) :', ...rows.slice(-12).map((row) => `- ${row.label} : ${row.value} · ${row.source}`)].join('\n')
}

export async function ztcConnectStatus() {
  const [stack, inventory] = await Promise.all([hackathonStack(), ztcInventory()])
  const token = Boolean(bridgeToken())
  return {
    ok: true,
    site: ZTC_SITE,
    llms: {
      amd: { live: stack.required.amd.live, model: amdVllmModel(), note: stack.required.amd.note },
      gemma: { live: stack.partners.gemma.live, model: amdGemmaModel(), note: stack.partners.gemma.note },
    },
    product: {
      fossbilling: inventory.connectors.find((item) => item.id === 'fossbilling') ?? null,
      devoid: inventory.connectors.find((item) => item.id === 'devoid') ?? null,
      core: inventory.connectors.find((item) => item.id === 'ztc_core') ?? null,
      whm: inventory.connectors.find((item) => item.id === 'whm') ?? null,
    },
    bridge: {
      token: token,
      open: !token,
      think: '/api/atlas/ztc/connect',
      ingest: '/api/atlas/ztc/connect',
    },
    desks: ZTC_DESKS.map((desk) => ({
      firstName: desk.firstName,
      role: desk.role,
      ring: desk.ring,
      datasets: ztcScopeOf(desk.firstName).datasets,
    })),
    how: [
      'Dans le code ZTC / DEVOID : POST {ATLAS}/api/atlas/ztc/connect avec op=think, desk, text.',
      'Pour pousser un fait produit : op=ingest, facts[{label,value,source,certainty:observed|historical}].',
      'Pour enregistrer les URL métier : op=link (ZTC_CORE_API, DEVOID, FOSSBilling, WHM).',
      'Escalade DEVOID → département Support : op=escalate { text, sessionId?, service? } → assigné à Nova (Support) + collab spécialiste.',
      'Réattribuer dans Support : op=assign { ticketId, desk: Nova|… }. Collab métier : op=route { ticketId, desk: Lyra|Vega|… }.',
      'Outils DEVOID (même catalogue) : op=tools { desk } ; op=tool { desk, tool, customerId, args? } — acheter, DNS, e-mail, WP…',
      'Flux visiteurs Funnel : op=visit { path, sessionId } ; op=prospect { sessionId, email? } ; op=visitor-report { period }.',
      'Optionnel : ZTC_BRIDGE_TOKEN — le site envoie Authorization: Bearer …',
      'Chaque bureau n’exécute que ses outils DEVOID (prévisualisation / confirm pour les écritures).',
    ],
    supportBridge: {
      escalate: 'op=escalate → département Support (assigné Nova)',
      assign: 'op=assign → réattribuer dans Support',
      route: 'op=route → collab spécialiste (Lyra/Vega/…)',
      reply: 'op=reply',
      pull: 'op=pull',
      tickets: 'op=tickets',
      tool: 'op=tool',
      tools: 'op=tools',
      department: 'Support',
      routing: {
        domain_dns: 'Lyra',
        hosting: 'Vega',
        email: 'Echo',
        billing: 'Ledger',
        security: 'Cipher',
        performance: 'Swift',
        general: 'Nova',
      },
    },
    visitorFlow: {
      desk: 'Funnel',
      department: 'Flux visiteurs',
      visit: 'op=visit',
      prospect: 'op=prospect',
      report: 'op=visitor-report',
    },
  }
}

export async function ztcThink(
  deskHint: string,
  text: string,
  opts?: { mode?: string; channel?: string; customerId?: string; fast?: boolean },
) {
  const question = text.replace(/\s+/g, ' ').trim()
  if (question.length < 3) throw new Error('Texte trop court.')
  const desk = ztcDeskOf(`${deskHint} ${question}`)?.firstName ?? 'Nova'
  const tools = ztcDevoidToolsOf(desk)
  const skills = ztcSkillsOf(desk)
  const devoidMode = /devoid|reason|support/i.test(`${opts?.mode || ''} ${opts?.channel || ''}`)
    || /DEVOID|widget chat|besoin client|analyse le site/i.test(question)
  const fast = Boolean(opts?.fast) || devoidMode
  const snap = fast ? null : await deskSnapshot(desk)
  const pushed = fast ? '' : ingestLines(desk)
  const system = `${ZTC_ATLAS_RULES}

BUREAU : ${desk} · ${ztcScopeOf(desk).datasets.join(', ')}
Compétences : ${skills.join(', ')}
Outils DEVOID autorisés : ${tools.join(', ') || 'aucun'}
${devoidMode ? `
Tu es le cerveau LLM d’ATLAS pour DEVOID (chat client ztchosting.com).
Méthode obligatoire (concise) :
1) Besoin client en 1 phrase.
2) Analyse site/produit ZTC (faits connus seulement, pas d’invention).
3) Solution concrète en 3 étapes max + outil DEVOID si utile.
Primary language: English. Reply in English by default; mirror the client if they clearly write in another language. No generic ticket if you can resolve here.
` : 'Tu peux proposer d’exécuter ces outils (achat, DNS, e-mail, WP…) via op=tool. Si une donnée manque : dis-le.'}`
  const user = `${snap ? formatDeskPrompt(snap) : `Contexte ZTC : boutique https://ztchosting.com/order — Starter gratuit, Business $5.99, Premium $9.99.`}
${pushed}
${opts?.customerId ? `CustomerId: ${opts.customerId}` : ''}
${opts?.channel ? `Canal: ${opts.channel}` : ''}

Question ZTC / DEVOID :
${question}`
  const answer = (await thinkOnAmd(
    system,
    user,
    devoidMode ? 900 : 1200,
    devoidMode ? 50000 : 45000,
  )).trim()
  return {
    ok: Boolean(answer),
    desk,
    datasets: ztcScopeOf(desk).datasets,
    tools,
    skills,
    mode: devoidMode ? 'devoid' : 'think',
    fast,
    model: amdVllmModel(),
    fallback: amdGemmaModel(),
    text: answer || 'Les LLM AMD n’ont pas répondu. Vérifiez AMD_VLLM_API_KEY / Token Factory.',
    reply: answer,
    response: answer,
  }
}

export function ztcLink(body: Record<string, string | undefined>) {
  const patch: Record<string, string> = {}
  const map: Record<string, string> = {
    coreUrl: 'ZTC_CORE_API',
    fossUrl: 'ZTC_FOSSBILLING_URL',
    devoidUrl: 'ZTC_DEVOID_URL',
    whmUrl: 'ZTC_WHM_URL',
    token: 'ZTC_BRIDGE_TOKEN',
    devoidToken: 'ZTC_DEVOID_TOKEN',
  }
  for (const [from, envKey] of Object.entries(map)) {
    const raw = String(body[from] ?? body[envKey] ?? '').trim()
    if (!raw) continue
    if (envKey.endsWith('_TOKEN')) {
      patch[envKey] = raw
      process.env[envKey] = raw
      continue
    }
    const url = serviceUrl(raw)
    if (!url) throw new Error(`URL invalide pour ${envKey}.`)
    patch[envKey] = url
    process.env[envKey] = url
  }
  if (!Object.keys(patch).length) throw new Error('Aucune URL ou jeton à enregistrer.')
  writeOauthApps(patch)
  return {
    ok: true,
    saved: Object.keys(patch),
    note: 'URLs stockées localement. Les jetons ne sont pas renvoyés. WHM / cœur restent en lecture jusqu’à preuve.',
  }
}

export function ztcIngest(deskHint: string, source: string, facts: Array<{ label?: string; value?: string; source?: string; certainty?: string; desk?: string }>) {
  const desk = (deskHint || ztcDeskOf(source)?.firstName || '').trim()
  const rows: ZtcIngestFact[] = []
  for (const fact of facts.slice(0, 20)) {
    const label = String(fact.label ?? '').trim().slice(0, 80)
    const value = String(fact.value ?? '').trim().slice(0, 280)
    const from = String(fact.source ?? source ?? '').trim().slice(0, 160)
    const certainty = fact.certainty === 'historical' ? 'historical' : fact.certainty === 'observed' ? 'observed' : ''
    if (!label || !value || !from || !certainty) continue
    rows.push({
      desk: String(fact.desk ?? desk).trim().slice(0, 24) || undefined,
      label,
      value,
      source: from,
      certainty,
      at: new Date().toISOString(),
    })
  }
  if (!rows.length) throw new Error('Aucun fait observé/historique. N’envoyez pas d’estimations.')
  return { ok: true, stored: writeIngest(rows).length, accepted: rows.length }
}

export { LINK_KEYS }
