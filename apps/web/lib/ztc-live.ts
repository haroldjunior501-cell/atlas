import { ZTC_SITE, type ZtcCertainty } from '@atlas/domain'
import { serverEnv } from './server-env'
import { publicUrl, webFetch } from './web-tools'

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

export interface ZtcInventory {
  site: string
  at: string
  facts: ZtcFact[]
  connectors: ZtcConnectorStatus[]
}

const now = () => new Date().toISOString()

function fact(label: string, value: string, certainty: ZtcCertainty, source: string): ZtcFact {
  return { label, value, certainty, source, at: now() }
}

function money(html: string, label: string) {
  const match = html.match(new RegExp(`${label}[\\s\\S]{0,180}?From\\s*\\$([0-9]+(?:\\.[0-9]+)?)\\s*/\\s*mo`, 'i'))
    ?? html.match(new RegExp(`${label}[\\s\\S]{0,180}?\\$([0-9]+(?:\\.[0-9]+)?)\\s*/\\s*mo`, 'i'))
  return match?.[1] ? `$${match[1]}/mo (prix affiché sur le site public)` : null
}

export async function ztcPublicCatalog(): Promise<ZtcFact[]> {
  const page = await webFetch(ZTC_SITE, 12000)
  if (!page.ok) {
    return [fact('Site public', `${ZTC_SITE} illisible (${page.status || 'timeout'})`, 'to_confirm', ZTC_SITE)]
  }
  const text = `${page.title} ${page.text}`
  const facts: ZtcFact[] = [
    fact('Marque', 'ZTC Hosting — site et domaine principal ztchosting.com', 'observed', ZTC_SITE),
    fact('Positionnement', 'Hébergement web, domaines et e-mail — Host. Deploy. Succeed online.', 'observed', ZTC_SITE),
  ]
  const hosting = money(text, 'Web Hosting') ?? money(text, 'Hosting')
  const email = money(text, 'Professional Email') ?? money(text, 'Email')
  if (hosting) facts.push(fact('Prix hébergement affiché', hosting, 'observed', ZTC_SITE))
  if (email) facts.push(fact('Prix e-mail affiché', email, 'observed', ZTC_SITE))
  if (/NVMe/i.test(text)) facts.push(fact('Stockage annoncé', 'NVMe SSD (affirmation marketing publique)', 'observed', ZTC_SITE))
  if (/Free SSL|SSL HTTPS/i.test(text)) facts.push(fact('SSL', 'SSL annoncé gratuit sur chaque site', 'observed', ZTC_SITE))
  if (/99\.99%/.test(text)) facts.push(fact('SLA annoncé', '99,99 % — affirmation marketing, non mesurée par ATLAS', 'to_confirm', ZTC_SITE))
  if (/12\.8\s*Tbps/i.test(text)) facts.push(fact('Capacité réseau annoncée', '12,8 Tbps — à confirmer par mesure', 'to_confirm', ZTC_SITE))
  if (/25\+?\s*Datacent/i.test(text)) facts.push(fact('Datacenters annoncés', '25+ — liste réelle à inventorier', 'to_confirm', ZTC_SITE))
  facts.push(fact('FOSSBilling / WHM / DEVOID', 'Décrits dans le dossier interne ; état live à revalider, pas déduit d’un souvenir', 'to_confirm', 'dossier ZTC 17.10.2026'))
  facts.push(fact('Serveur HP 160 Go / 3 To', 'NON ACQUIS — hors capacité et hors engagements', 'observed', 'dossier ZTC 17.10.2026'))
  return facts
}

async function probe(id: string, label: string, raw: string, path = ''): Promise<ZtcConnectorStatus> {
  if (!raw) return { id, label, certainty: 'unconfigured', note: 'URL absente de l’environnement. Aucun secret demandé dans le chat.' }
  const url = publicUrl(raw.endsWith('/') ? `${raw}${path.replace(/^\//, '')}` : path ? `${raw.replace(/\/$/, '')}${path}` : raw)
  if (!url) return { id, label, certainty: 'unconfigured', note: 'URL interne ou invalide : ATLAS ne sonde que le web public.' }
  const started = Date.now()
  try {
    const response = await fetch(url, { headers: { accept: 'application/json,text/plain,text/html', 'user-agent': 'ATLAS-ZTC/1.0' }, signal: AbortSignal.timeout(6000), redirect: 'follow' })
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
  const [facts, connectors] = await Promise.all([
    ztcPublicCatalog(),
    Promise.all([
      probe('ztc_core', 'Portail / API métier ZTC', serverEnv('ZTC_CORE_API')),
      probe('fossbilling', 'FOSSBilling', serverEnv('ZTC_FOSSBILLING_URL')),
      probe('whm', 'WHM / cPanel Azure', serverEnv('ZTC_WHM_URL')),
      probe('devoid', 'DEVOID /health', serverEnv('ZTC_DEVOID_URL'), '/health'),
      probe('site', 'Site public', ZTC_SITE),
    ]),
  ])
  return { site: ZTC_SITE, at: now(), facts, connectors }
}
