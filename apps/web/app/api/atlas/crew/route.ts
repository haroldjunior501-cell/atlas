import {
  CREW_PLAN_PROMPT,
  CREW_ROLES,
  alignPrices,
  fallbackPlan,
  median,
  perKilo,
  planFromModel,
  priceMismatches,
  pricesIn,
  searchQueries,
  tokensOf,
  topicOf,
  type CrewRole,
  type CrewStep,
  type Recommendation,
} from '@atlas/domain'
import { ztcDeskOf } from '@atlas/domain'
import { thinkWithModels } from '@/lib/ace-runtime'
import { advertiseFromLive } from '@/lib/ztc-creative'
import { ingestLines } from '@/lib/ztc-connect'
import { deskSnapshot, formatDeskPrompt } from '@/lib/ztc-live'
import { evolusCompare, evolusConfigured, evolusSummarize } from '@/lib/evolus'
import { hostOf, webFetch, webSearch, type WebHit } from '@/lib/web-tools'

/** Modèles rapides d’abord : une mission enchaîne des dizaines d’appels. */
const CREW_MODELS = ['nvidia/nemotron-3.5-lightning-30b-a3b', 'nvidia/nemotron-3-super-120b-a12b']

function nemotron(system: string, user: string, tokens: number, timeoutMs: number) {
  return thinkWithModels(CREW_MODELS, system, user, tokens, timeoutMs)
}

type Source = { url: string; title: string; text: string }
type Input = { title: string; role: CrewRole; agent?: string; target?: string; report: string }

interface Body {
  op?: 'plan' | 'search' | 'fetch' | 'work' | 'review'
  mission?: string
  organization?: string
  rules?: string
  team?: string[]
  step?: CrewStep
  queries?: string[]
  agent?: string
  url?: string
  sources?: Source[]
  inputs?: Input[]
  recommendations?: Recommendation[]
  html?: string
}

const today = () => new Date().toISOString().slice(0, 10)
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} €`

async function setting(body: Body) {
  const lines = [
    body.organization ? `Entreprise : ${body.organization}.` : '',
    body.rules?.trim() ? `Règlement du bureau (à respecter) : ${body.rules.trim().slice(0, 1200)}` : '',
  ]
  try {
    const desk = ztcDeskOf(`${body.agent ?? ''} ${body.mission ?? ''}`)?.firstName ?? 'Nova'
    lines.push(formatDeskPrompt(await deskSnapshot(desk)))
    const pushed = ingestLines(desk)
    if (pushed) lines.push(pushed)
  } catch { /* lecture live optionnelle */ }
  return lines.filter(Boolean).join('\n')
}

const SOCIAL = /facebook|instagram|pinterest|youtube|tiktok|linkedin|twitter|x\.com|reddit/i
const REVIEWS = /trustpilot|avis-verifies|avis\.|ekomi|google\.[a-z.]+\/maps|tripadvisor|que-choisir/i
const SHOPS = /idealo|ledenicheur|kelkoo|toppreise|auchan|carrefour|leclerc|monoprix|intermarche|galaxus|digitec|coop\.ch|migros|manor|franprix|shop|store|boutique|epicerie|maxicoffee/i
/** Pages qui bloquent souvent les lecteurs automatiques. */
const BLOCKING = /amazon\.|cdiscount\.|fnac\.|ebay\./i

/** Choisit 3 pages : site officiel d’abord, puis avis clients, puis un revendeur. */
function pickSources(hits: WebHit[], target?: string, mission = ''): WebHit[] {
  const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const key = fold(target ?? '').replace(/[^a-z0-9]/g, '')
  const words = [...new Set(fold(topicOf(mission)).split(/[^a-z0-9]+/).filter((word) => word.length >= 5).map((word) => word.slice(0, 6)))]
  const tld = /suisse|swiss|schweiz/i.test(mission) ? '.ch' : /france|français/i.test(mission) ? '.fr' : /belgi/i.test(mission) ? '.be' : ''
  const score = (hit: WebHit) => {
    const host = hostOf(hit.url).replace(/[^a-z0-9.]/g, '')
    const text = fold(`${hit.title} ${hit.snippet} ${hit.url}`)
    let value = 0
    if (words.some((word) => text.includes(word))) value += 3
    if (tld && host.endsWith(tld)) value += 2
    if (key && host.replace(/\./g, '').includes(key.slice(0, 8))) value += 6
    else if (key && hit.url.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key.slice(0, 8))) value += 2
    if (REVIEWS.test(hit.url)) value += 3
    if (SHOPS.test(hit.url)) value += 2
    if (BLOCKING.test(hit.url)) value -= 3
    if (/wikipedia/.test(hit.url)) value += 1
    if (SOCIAL.test(hit.url)) value -= 6
    return value
  }
  const picked: WebHit[] = []
  const domains = new Set<string>()
  let reviews = 0
  for (const hit of [...hits].sort((a, b) => score(b) - score(a))) {
    const domain = hostOf(hit.url).split('.').slice(-2)[0] ?? hit.url
    const review = REVIEWS.test(hit.url)
    if (domains.has(domain) || SOCIAL.test(hit.url) || (review && reviews >= 1)) continue
    domains.add(domain)
    if (review) reviews += 1
    picked.push(hit)
    if (picked.length === 3) break
  }
  return picked
}

function researchFallback(step: CrewStep, sources: Source[]) {
  const lines = sources.flatMap((source, index) =>
    pricesIn(source.text).slice(0, 5).map((hit) => `- ${hit.context.slice(-50)} **${hit.raw}** [${index + 1}]`))
  return [
    `# ${step.target ?? step.title} – relevé du ${today()}`,
    '',
    lines.length ? '## Prix relevés' : '## Prix relevés\nAucun prix lisible sur les pages ouvertes.',
    ...lines,
    '',
    '## Ce que disent les pages',
    ...sources.map((source, index) => `- ${source.text.slice(0, 220).trim()}… [${index + 1}]`),
    '',
    '## Sources',
    ...sources.map((source, index) => `[${index + 1}] ${source.url}`),
  ].join('\n')
}

async function research(body: Body, step: CrewStep, agent: string) {
  const sources = (body.sources ?? []).filter((source) => source.text)
  const system = `Tu es ${agent}, chercheur de l’équipe ATLAS : un vrai agent avec ses propres outils (WebSearch, WebFetch, Read, Glob, Grep).
Tu as lu les pages ci-dessous (relevé du ${today()}). Règles strictes :
- n’invente aucun chiffre ; chaque prix ou chiffre est suivi de sa source [n] ;
- n’ajoute jamais une unité ou une période (/mois, /an, HT, TTC, par utilisateur) absente de la page : écris « période non précisée » ;
- ce qui ne figure pas dans les pages est marqué « (estimation) » ;
- une page qui parle d’autre chose (homonyme, autre secteur) est ignorée et signalée en une ligne « Écarté : … » ;
- English, Markdown, short sentences, no introduction.`
  const user = `${await setting(body)}
Mission écrite par ATLAS :
${step.brief}

Pages lues :
${sources.map((source, index) => `[${index + 1}] ${source.title} — ${source.url}\n${source.text.slice(0, 3200)}`).join('\n\n') || 'aucune page lisible : dis-le et donne seulement des pistes marquées (estimation).'}

Rends le rapport : un titre « # ${step.target ?? step.title} – relevé du ${today()} », les sections demandées, puis « ## Sources » avec [n] URL.`
  const raw = (await nemotron(system, user, 1800, 70000)).trim()
  let report = raw.length > 120 ? raw : researchFallback(step, sources)
  if (!/##\s*sources/i.test(report) && sources.length) report += `\n\n## Sources\n${sources.map((source, index) => `[${index + 1}] ${source.url}`).join('\n')}`
  return { report, tokens: tokensOf(system, user, raw), model: raw.length > 120 }
}

type Table = { columns: string[]; rows: string[][] }

function kiloTable(inputs: Input[]) {
  const rows: Array<{ name: string; count: number; median: number | null; prices: number[] }> = []
  for (const input of inputs.filter((item) => item.role === 'chercheur')) {
    const hits = pricesIn(input.report.split(/##\s*sources/i)[0] ?? input.report)
    const kilos = hits.map(perKilo).filter((value): value is number => value !== null)
    rows.push({ name: input.target ?? input.title.replace(/^recherche\s*·\s*/i, ''), count: hits.length, median: median(kilos), prices: hits.map((hit) => hit.value) })
  }
  return rows
}

function roundPrice(value: number) {
  return Math.max(0.9, Math.round(value) - 0.1)
}

/** Chiffres du tableau absents des rapports : marqués comme estimation. */
function flagInvented(table: Table, corpus: string): Table {
  const plain = corpus.replace(/\s/g, '')
  return {
    columns: table.columns,
    rows: table.rows.map((row) => row.map((cell) => {
      const numbers = cell.match(/\d+(?:[.,]\d+)?/g) ?? []
      const known = numbers.every((number) => number.length < 3 || plain.includes(number) || plain.includes(number.replace('.', ',')) || plain.includes(number.replace(',', '.')))
      return known || /estim/i.test(cell) ? cell : `${cell} (estim.)`
    })),
  }
}

function markdownTable(table: Table) {
  if (!table.columns.length) return ''
  return [
    `| ${table.columns.join(' | ')} |`,
    `| ${table.columns.map(() => '---').join(' | ')} |`,
    ...table.rows.map((row) => `| ${table.columns.map((_, index) => row[index] ?? '').join(' | ')} |`),
  ].join('\n')
}

async function analyse(body: Body, step: CrewStep, agent: string) {
  const inputs = body.inputs ?? []
  const kilos = kiloTable(inputs)
  const computed = kilos.filter((row) => row.median !== null).map((row) => `${row.name} : médiane ${money(row.median!)} / kg (${row.count} prix relevés)`).join('\n')
  const system = `Tu es ${agent}, analyste de l’équipe ATLAS (outils : Read, Write, Edit, Glob, Grep, Calcul).
Tu mets les chiffres des chercheurs dans un tableau comparatif et tu recommandes. N’invente aucun chiffre : uniquement ceux des rapports et des calculs fournis.
Réponds UNIQUEMENT en JSON :
{"title":"…","columns":["Marque","…"],"rows":[["…","…"]],"recommendations":[{"label":"Produit 250 g","value":14.9}],"notes":"2 phrases"}`
  const user = `${await setting(body)}
Mission écrite par ATLAS :
${step.brief}

Calculs déjà faits (prix au kilo) :
${computed || 'aucun prix au kilo calculable'}

Rapports des chercheurs :
${inputs.map((input) => `### ${input.title}${input.agent ? ` (${input.agent})` : ''}\n${input.report.slice(0, 2600)}`).join('\n\n')}`
  const raw = await nemotron(system, user, 2200, 80000)
  let table: Table = { columns: [], rows: [] }
  let recommendations: Recommendation[] = []
  let title = 'Tableau comparatif'
  let notes = ''
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '') as { title?: string; columns?: unknown[]; rows?: unknown[][]; recommendations?: Array<{ label?: unknown; value?: unknown }>; notes?: string }
    if (Array.isArray(parsed.columns) && Array.isArray(parsed.rows) && parsed.columns.length >= 2) {
      table = { columns: parsed.columns.map(String).slice(0, 7), rows: parsed.rows.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? ''))).slice(0, 20) }
      title = parsed.title?.trim() || title
      notes = parsed.notes?.trim() ?? ''
      recommendations = (parsed.recommendations ?? [])
        .map((item) => ({ label: String(item.label ?? '').slice(0, 60), value: Number(String(item.value ?? '').replace(',', '.').replace(/[^\d.]/g, '')) }))
        .filter((item) => item.label && Number.isFinite(item.value) && item.value > 0)
        .slice(0, 8)
    }
  } catch { /* tableau calculé localement */ }
  const usedModel = table.rows.length > 0
  if (!usedModel) {
    table = {
      columns: ['Concurrent', 'Prix relevés', 'Prix au kilo (médiane)'],
      rows: kilos.map((row) => [row.name, row.prices.slice(0, 4).map(money).join(' · ') || '—', row.median !== null ? money(row.median) : '—']),
    }
    const all = median(kilos.map((row) => row.median).filter((value): value is number => value !== null))
    if (all) {
      recommendations = [
        { label: 'Prix conseillé 250 g', value: roundPrice(all / 4 * 1.1) },
        { label: 'Prix conseillé 1 kg', value: roundPrice(all) },
      ]
      notes = `Positionnement au niveau de la médiane du marché (${money(all)} / kg).`
    }
  }
  const corpus = inputs.map((input) => input.report).join('\n') + computed
  table = flagInvented(table, corpus)
  const viaEvolus = await partnerEvolus(inputs)
  const report = [
    `# ${title}`,
    '',
    markdownTable(table),
    '',
    computed ? `## Calculs\n${computed.split('\n').map((line) => `- ${line}`).join('\n')}` : '',
    recommendations.length ? `## Recommandation\n${recommendations.map((item) => `- ${item.label} : **${money(item.value)}**`).join('\n')}` : '',
    notes ? `\n${notes}` : '',
    viaEvolus ? `\n## Evolus (AI Tools)\n${viaEvolus}` : '',
  ].filter(Boolean).join('\n')
  return { report, table, recommendations, tokens: tokensOf(system, user, raw), model: usedModel, evolus: Boolean(viaEvolus) }
}

/** Prix partenaire : summarize + compare. Jamais bloquant si Evolus est absent. */
async function partnerEvolus(inputs: Input[]) {
  if (!evolusConfigured()) return ''
  const first = inputs[0]?.report?.slice(0, 4000) ?? ''
  const second = inputs[1]?.report?.slice(0, 4000) ?? ''
  try {
    if (first && second) {
      const compared = await evolusCompare(first, second)
      if ('text' in compared && compared.text) return compared.text.slice(0, 900)
    }
    if (first) {
      const summary = await evolusSummarize(first)
      if ('text' in summary && summary.text) return summary.text.slice(0, 900)
    }
  } catch { /* partenaire optionnel */ }
  return ''
}

function siteTemplate(body: Body, recommendations: Recommendation[], inputs: Input[]) {
  const brand = body.organization || 'Votre marque'
  const points = inputs
    .filter((input) => input.role === 'chercheur')
    .map((input) => input.target ?? input.title)
    .slice(0, 5)
  const cards = (recommendations.length ? recommendations : [{ label: 'Offre découverte', value: 0 }])
    .map((item) => `<article><h3>${item.label}</h3><p class="price">${item.value ? money(item.value) : 'Sur demande'}</p></article>`)
    .join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${brand}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif;background:#f6efe6;color:#2b1d14}header{padding:48px 22px 28px;background:#2b1d14;color:#f6efe6}h1{margin:0 0 8px;font-size:34px}header p{margin:0;opacity:.8;font-family:system-ui}main{max-width:480px;margin:auto;padding:22px}article{background:#fffaf3;border:1px solid #e7d6c3;border-radius:16px;padding:18px;margin:0 0 14px}h3{margin:0 0 6px}.price{font:700 22px system-ui;color:#9a4a1c;margin:0}footer{padding:24px;text-align:center;font:12px system-ui;opacity:.7}</style></head>
<body><header><h1>${brand}</h1><p>${(body.mission ?? '').slice(0, 140)}</p></header><main>${cards}</main>
<footer>Positionnement établi face à ${points.join(', ') || 'le marché'} · relevé du ${today()}</footer></body></html>`
}

async function design(body: Body, step: CrewStep, agent: string) {
  const inputs = body.inputs ?? []
  const recommendations = body.recommendations ?? []
  const prices = recommendations.map((item) => `${item.label} = ${money(item.value)}`).join(' ; ')
  const system = `Tu es ${agent}, designer de l’équipe ATLAS (outils : Read, Write, Edit, Glob, Grep, WebFetch).
C’est le site de lancement de NOTRE marque${body.organization ? ` (« ${body.organization} »)` : ' (propose un nom court et élégant)'}, pas un comparatif des concurrents : accroche, gamme de produits avec leurs prix, ce qui nous différencie (tiré de l’analyse), appel à l’action. Ne cite jamais les concurrents sur le site.
Tu rends UNIQUEMENT un fichier HTML complet, de <!doctype html> à </html> : CSS dans une balise <style>, pensé pour téléphone (max-width 480px), typographie soignée, aucune ressource externe (SVG inline autorisé), aucun script.
${prices ? `Prix à afficher EXACTEMENT : ${prices}.` : 'N’affiche aucun prix inventé.'}`
  const user = `${await setting(body)}
Mission écrite par ATLAS :
${step.brief}

Livrables de l’équipe :
${inputs.map((input) => `### ${input.title}\n${input.report.slice(0, 1400)}`).join('\n\n')}`
  const raw = await nemotron(system, user, 4800, 140000)
  const html = raw.match(/<!doctype html[\s\S]*<\/html>/i)?.[0] ?? raw.match(/<html[\s\S]*<\/html>/i)?.[0] ?? ''
  const usable = html.length > 400
  const site = usable ? html : siteTemplate(body, recommendations, inputs)
  const sections = [...site.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)].map((match) => match[1]!.replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 5)
  let report = `# Site livré · index.html\n\n- ${Math.round(site.length / 1024)} Ko, un seul fichier, pensé pour le téléphone\n${sections.length ? `- Sections : ${sections.join(' · ')}\n` : ''}- Prix affichés : ${pricesIn(site).slice(0, 6).map((hit) => hit.raw).join(', ') || 'aucun'}`
  let image: string | undefined
  if (/pub|visuel|campagne|image|publicit|flare/i.test(`${body.mission} ${step.brief}`)) {
    try {
      const ad = await advertiseFromLive(body.mission ?? '')
      image = ad.image.dataUrl
      report += `\n\n## Visuel Flare\n${ad.image.summary}\nSKU live : ${ad.product.title} · ${ad.price}`
    } catch { /* FLUX optionnel : le HTML reste le livrable */ }
  }
  return { report, html: site, image, tokens: tokensOf(system, user, raw), model: usable }
}

async function write(body: Body, step: CrewStep, agent: string, role: CrewRole) {
  const info = CREW_ROLES[role]
  const system = `Tu es ${agent}, ${info.label.toLowerCase()} de l’équipe ATLAS (outils : ${info.tools.join(', ')}). ${info.does}
N’invente aucun chiffre : reprends ceux des livrables, sinon écris « (estimation) ». Français, Markdown, livrable prêt à l’emploi.${step.via ? ' Prépare un brouillon : l’envoi réel passe par le connecteur, après accord.' : ''}`
  const user = `${await setting(body)}
Mission écrite par ATLAS :
${step.brief}

${(body.inputs ?? []).length ? `Livrables de l’équipe :\n${(body.inputs ?? []).map((input) => `### ${input.title}\n${input.report.slice(0, 1600)}`).join('\n\n')}` : ''}`
  const raw = (await nemotron(system, user, 2200, 80000)).trim()
  const report = raw.length > 60 ? raw : `# ${step.title}\n\nJe n’ai pas pu joindre le modèle. Voici le cadre :\n\n${step.brief}`
  return { report, tokens: tokensOf(system, user, raw), model: raw.length > 60 }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Body | null
  if (!body?.op) return Response.json({ error: 'op' }, { status: 400 })
  const mission = body.mission?.trim() ?? ''

  if (body.op === 'plan') {
    if (mission.length < 6) return Response.json({ error: 'mission' }, { status: 400 })
    const user = `${await setting(body)}
Équipe du bureau : ${(body.team ?? []).join(', ') || 'à composer'}.
Mission : ${mission}`
    const raw = await nemotron(CREW_PLAN_PROMPT, user, 2400, 60000)
    const plan = planFromModel(raw, mission)
    return Response.json({ plan: plan ?? fallbackPlan(mission), source: plan ? 'model' : 'local', tokens: tokensOf(CREW_PLAN_PROMPT, user, raw) })
  }

  if (body.op === 'search') {
    if (!body.step) return Response.json({ error: 'step' }, { status: 400 })
    const queries = body.queries?.length ? body.queries.slice(0, 3) : searchQueries(body.step, mission)
    const results = await Promise.all(queries.map((query) => webSearch(query).catch(() => [] as WebHit[])))
    const target = body.step.target
    const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
    const about = (hit: WebHit) => !target || fold(`${hit.title} ${hit.url} ${hit.snippet}`).includes(fold(target).slice(0, 8))
    let hits = results.flat()
      .filter((hit, index, list) => list.findIndex((item) => item.url === hit.url) === index)
      .filter((hit) => !/[/.](login|signin|sign-in|auth|idp)[/.?]|\/authorize/i.test(hit.url))
    if (target && hits.filter(about).length < 2) {
      const extra = await webSearch(target).catch(() => [] as WebHit[])
      hits = [...hits, ...extra.filter((hit) => !hits.some((item) => item.url === hit.url))]
    }
    const key = target ? fold(target) : ''
    if (key.length >= 3 && !hits.some((hit) => hostOf(hit.url).replace(/[^a-z0-9]/g, '').includes(key))) {
      const guesses = await Promise.all(['com', 'ch', 'fr'].map((tld) => webFetch(`https://www.${key}.${tld}/`, 400).catch(() => null)))
      for (const page of guesses) if (page?.ok) hits.unshift({ title: page.title || target!, url: page.url, snippet: 'Site officiel (adresse vérifiée)' })
    }
    if (hits.some(about)) hits = hits.filter(about)
    return Response.json({ queries, hits: hits.slice(0, 10), picks: pickSources(hits, body.step.target, mission) })
  }

  if (body.op === 'fetch') {
    const page = await webFetch(body.url ?? '')
    return Response.json({ url: page.url, host: hostOf(page.url), title: page.title, ok: page.ok, status: page.status, text: page.text, prices: pricesIn(page.text).slice(0, 8).map((hit) => hit.raw) })
  }

  if (body.op === 'work') {
    const step = body.step
    if (!step) return Response.json({ error: 'step' }, { status: 400 })
    const agent = body.agent?.trim() || CREW_ROLES[step.role].label
    if (step.role === 'chercheur') return Response.json(await research(body, step, agent))
    if (step.role === 'analyste') return Response.json(await analyse(body, step, agent))
    if (step.role === 'designer') return Response.json(await design(body, step, agent))
    return Response.json(await write(body, step, agent, step.role))
  }

  if (body.op === 'review') {
    const recommendations = body.recommendations ?? []
    const mismatches = body.html ? priceMismatches(recommendations, body.html) : []
    const html = mismatches.length ? alignPrices(body.html!, mismatches) : body.html ?? ''
    const fixed = mismatches.length ? priceMismatches(recommendations, html).length === 0 : true
    const message = mismatches.length
      ? `Les livrables sont là, mais ils ne sont pas alignés. L’analyste recommande ${mismatches.map((item) => money(item.expected)).join(' et ')}, alors que le site affiche ${mismatches.map((item) => (item.found !== null ? money(item.found) : '—')).join(' et ')}.`
      : ''
    const inputs = body.inputs ?? []
    const system = 'You are ATLAS, the lead. You reviewed all deliverables. Summarize the mission result in 5 lines max, in English, factual, invent no figures.'
    const fixNote = mismatches.length && fixed
      ? `Écart repéré puis CORRIGÉ par toi : le site affiche désormais ${mismatches.map((item) => money(item.expected)).join(' et ')}, comme l’analyste. Les livrables sont alignés ; ne parle pas d’incohérence restante.\n`
      : message ? `Écart repéré, correction partielle : ${message}\n` : ''
    const user = `Mission : ${mission}\n${fixNote}\n${inputs.map((input) => `### ${input.title}\n${input.report.slice(0, 900)}`).join('\n\n')}`
    const raw = (await nemotron(system, user, 900, 45000)).trim()
    const summary = raw || [
      `Mission terminée : ${inputs.length} livrable${inputs.length > 1 ? 's' : ''}.`,
      ...inputs.slice(0, 3).map((input) => `${input.title} : ${input.report.replace(/[#*|>-]/g, ' ').replace(/\s+/g, ' ').slice(0, 90).trim()}…`),
      mismatches.length ? 'Prix du site alignés sur la recommandation de l’analyste.' : '',
    ].filter(Boolean).slice(0, 5).join('\n')
    return Response.json({ mismatches, html, fixed, message, summary, tokens: tokensOf(system, user, raw) })
  }

  return Response.json({ error: 'op' }, { status: 400 })
}
