import { CONNECTOR_CATALOG } from './catalog'
import type { ConnectorProvider, Objective } from './model'

export type BusinessModel =
  | 'saas'
  | 'marketplace'
  | 'agence'
  | 'ecommerce'
  | 'freelance'
  | 'clinique'
  | 'immobilier'
  | 'jeu'
  | 'hosting'
  | 'autre'

const PROVIDERS = new Set(CONNECTOR_CATALOG.map((item) => item.provider))

/** Portraits photo locaux (public/avatars + landing). */
const FACE_WOMEN = [
  '/landing/avatar-sarah.png',
  '/landing/avatar-emma.png',
  '/avatars/local-sarah.png',
  '/avatars/local-emma.png',
  ...Array.from({ length: 20 }, (_, i) => `/avatars/w${i + 1}.jpg`),
]

const FACE_MEN = [
  '/landing/avatar-thomas.png',
  '/landing/avatar-alex.png',
  '/avatars/local-thomas.png',
  '/avatars/local-alex.png',
  ...Array.from({ length: 20 }, (_, i) => `/avatars/m${i + 1}.jpg`),
]

export function dueIn(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function hashSeed(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  return hash
}

export function isFemaleName(firstName: string): boolean {
  return /^(marie|sarah|sara|l[eé]a|camille|in[eè]s|ines|emma|julie|alice|chlo[eé]|anna|nina|louise|claire|sophie|nova|lisa|laura|lucie|manon|pauline|elodie|[eé]lodie|am[eé]lie|amelie|claire|jade|lina|maya|nora|olivia|zoe|zo[eé]|eva|clara|h[eé]l[eè]ne|helene|isabelle|nathalie|val[eé]rie|valerie|aur[eé]lie|aurelie|c[eé]line|celine|diane|florence|gabrielle|hannah|iris|julia|karine|lola|margaux|margot|m[eé]lanie|melanie|nathalie|oc[eé]ane|oceane|p[eé]n[eé]lope|penelope|rachel|sylvie|tiffany|victoria|wendy|yasmin|yasmine)/i.test(firstName.trim())
}

/** Portrait photoréaliste déterministe (vrai visage, pas un blob SVG). */
export function agentFace(firstName: string, lastName: string): string {
  const seed = `${firstName}-${lastName}`.trim() || 'atlas-agent'
  const hash = hashSeed(seed.toLowerCase())
  const pool = isFemaleName(firstName) ? FACE_WOMEN : FACE_MEN
  return pool[hash % pool.length]!
}

/** Remplace les anciens DiceBear / lorelei par un vrai portrait. */
export function resolveAgentFace(firstName: string, lastName: string, stored?: string | null): string {
  const raw = String(stored || '').trim()
  if (raw && !/dicebear|lorelei|avataaars|bottts|shapes|identicon/i.test(raw)) {
    return raw
  }
  return agentFace(firstName, lastName)
}

export function agentVoice(firstName: string): string {
  return isFemaleName(firstName) ? 'Hortense' : 'Henri'
}

export function businessModelOf(intention: string): BusinessModel {
  const heard = intention.toLowerCase()
  if (/clinique|t[eé]l[eé]m[eé]decine|m[eé]dec|patient|sant[eé]|h[oô]pital/.test(heard)) return 'clinique'
  if (/immobilier|immo|logement|notaire/.test(heard)) return 'immobilier'
  if (/\bjeu\b|game|studio de jeux/.test(heard)) return 'jeu'
  if (/saas|abonnement|arr\b|b2b logiciel/.test(heard)) return 'saas'
  if (/marketplace|place de march[eé]|mettre en relation|deux versants/.test(heard)) return 'marketplace'
  if (/e-?commerce|boutique en ligne|shopify|dtc|marque de |v[eê]tements?|pr[eê]t.?[aà].?porter|\bmode\b|textile|habillement|cosm[eé]tique/.test(heard)) return 'ecommerce'
  if (/h[eé]berg|hosting|\bztc\b|cpanel|\bwhm\b|fossbilling|\bvps\b|datacent/.test(heard)) return 'hosting'
  if (/agence/.test(heard)) return 'agence'
  if (/freelance|solo|ind[eé]pendant/.test(heard)) return 'freelance'
  return 'autre'
}

export function toolsFor(role: string, department: string): ConnectorProvider[] {
  const text = `${role} ${department}`.toLowerCase()
  if (/market|cmo|croissance|communication|seo|contenu/.test(text)) return ['analytics', 'gmail', 'notion']
  if (/vente|sales|commercial|crm|immobilier/.test(text)) return ['crm', 'gmail', 'slack']
  if (/financ|cfo|compta|tr[eé]sor/.test(text)) return ['stripe', 'analytics']
  if (/tech|cto|d[eé]v|ing[eé]n|qa|logiciel/.test(text)) return ['github', 'linear', 'slack']
  if (/legal|jurid|contrat/.test(text)) return ['google_drive', 'notion']
  if (/whm|cpanel|vega|h[eé]berg/.test(text)) return ['whm', 'ztc_core']
  if (/domaine|dns|lyra|ssl/.test(text)) return ['resellerclub', 'cloudflare']
  if (/mail|echo|d[eé]livrabilit/.test(text)) return ['whm', 'cloudflare']
  if (/vps|helix|proxmox|openstack/.test(text)) return ['ztc_core', 'devoid']
  if (/sre|orion|noc|s[eé]curit|cipher/.test(text)) return ['ztc_core', 'whm']
  if (/ledger|fossbilling|factur/.test(text)) return ['fossbilling', 'stripe']
  if (/forge|devops/.test(text)) return ['github', 'devoid']
  if (/support|accueil|patient|succ[eè]s|nova/.test(text)) return ['gmail', 'ztc_core']
  if (/produit|product/.test(text)) return ['linear', 'notion', 'analytics']
  if (/ops|op[eé]ration|logistique/.test(text)) return ['notion', 'slack']
  return ['notion', 'slack']
}

export function knownTools(raw: string[] | undefined, role: string, department: string): ConnectorProvider[] {
  const picked = (raw ?? []).filter((item): item is ConnectorProvider => PROVIDERS.has(item as ConnectorProvider))
  return (picked.length ? picked : toolsFor(role, department)).slice(0, 4)
}

export function knownObjectives(raw: unknown, role: string, department: string): Objective[] {
  if (!Array.isArray(raw) || raw.length === 0) return objectivesFor(role, department)
  const items = raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { label?: unknown; metric?: unknown; target?: unknown; dueAt?: unknown; id?: unknown }
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    if (!label) return []
    return [{
      id: typeof row.id === 'string' && row.id ? row.id : `kpi-${index + 1}`,
      label,
      metric: typeof row.metric === 'string' ? row.metric : null,
      target: typeof row.target === 'string' ? row.target : null,
      dueAt: typeof row.dueAt === 'string' ? row.dueAt : dueIn(90),
    }]
  })
  return (items.length ? items : objectivesFor(role, department)).slice(0, 3)
}

export function objectivesFor(role: string, department: string): Objective[] {
  const text = `${role} ${department}`.toLowerCase()
  const quarter = dueIn(90)
  const month = dueIn(30)
  if (/market|cmo|seo|croissance/.test(text)) {
    return [
      goal('Acquisition', 'leads / mois', '120', quarter),
      goal('Taux de conversion', '%', '2.5', quarter),
    ]
  }
  if (/vente|sales|commercial/.test(text)) {
    return [
      goal('Pipeline', '€', '80000', quarter),
      goal('Closing', 'deals / mois', '8', month),
    ]
  }
  if (/financ|cfo/.test(text)) {
    return [
      goal('Runway suivi', 'mois', '12', month),
      goal('Écart budget', '%', '<5', quarter),
    ]
  }
  if (/tech|cto|d[eé]v/.test(text)) {
    return [
      goal('Livraison', 'releases / mois', '2', month),
      goal('Incidents P1', 'par trimestre', '0', quarter),
    ]
  }
  if (/legal|jurid/.test(text)) {
    return [goal('Contrats relus', 'dossiers / mois', '12', month)]
  }
  if (/support|accueil|succ[eè]s/.test(text)) {
    return [goal('CSAT', '/5', '4.6', month)]
  }
  if (/produit|product/.test(text)) {
    return [
      goal('Features livrées', '/ mois', '4', month),
      goal('Adoption', '%', '35', quarter),
    ]
  }
  return [goal('Objectifs du trimestre', 'jalons', '3', quarter)]
}

export function skillsFor(role: string, department: string): string[] {
  const text = `${role} ${department}`.toLowerCase()
  if (/market|cmo|croissance|contenu/.test(text)) return ['Acquisition', 'Contenu', 'Analytics']
  if (/vente|sales|commercial/.test(text)) return ['Prospection', 'Négociation', 'CRM']
  if (/financ|cfo/.test(text)) return ['Budget', 'Reporting', 'Trésorerie']
  if (/tech|cto|d[eé]v/.test(text)) return ['Architecture', 'Livraison', 'Qualité']
  if (/produit|product/.test(text)) return ['Roadmap', 'Discovery', 'Priorisation']
  if (/ops|op[eé]ration/.test(text)) return ['Process', 'Coordination', 'Qualité']
  if (/support|accueil/.test(text)) return ['Relation client', 'Résolution', 'Écoute']
  return ['Exécution', 'Coordination', 'Rigueur']
}

export function toneFor(role: string, traits: string[]): string {
  const blob = `${role} ${traits.join(' ')}`.toLowerCase()
  if (/cr[eé]atif/.test(blob)) return 'pédagogique'
  if (/legal|jurid|financ|cfo/.test(blob)) return 'formel'
  if (/vente|sales|commercial/.test(blob)) return 'direct'
  if (/support|accueil|patient|chaleureux|empath/.test(blob)) return 'chaleureux'
  return 'professionnel'
}

export function hoursFor(role: string): string {
  if (/support|accueil/.test(role.toLowerCase())) return '8h–20h, 6j/7'
  if (/m[eé]dec/.test(role.toLowerCase())) return '8h–19h, gardes selon planning'
  if (/ops|op[eé]ration/.test(role.toLowerCase())) return '8h–20h'
  return '9h–18h, lundi–vendredi'
}

export function businessModelLabel(model?: string): string {
  const labels: Record<string, string> = {
    saas: 'SaaS',
    marketplace: 'Marketplace',
    agence: 'Agence',
    ecommerce: 'E-commerce',
    freelance: 'Freelance',
    clinique: 'Clinique',
    immobilier: 'Immobilier',
    jeu: 'Studio de jeux',
    hosting: 'Hébergement',
    autre: 'Autre',
  }
  return labels[model ?? ''] || ''
}

export function kitFor(firstName: string, lastName: string, role: string, department: string, traits: string[] = []) {
  const personality = traits.length ? traits : ['professionnel']
  return {
    skills: skillsFor(role, department),
    traits: personality,
    tone: toneFor(role, personality),
    hours: hoursFor(role),
    objectives: objectivesFor(role, department),
    toolIds: toolsFor(role, department),
    voiceId: agentVoice(firstName),
    face: agentFace(firstName, lastName),
  }
}

function goal(label: string, metric: string, target: string, dueAt: string): Objective {
  return { id: label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-'), label, metric, target, dueAt }
}
