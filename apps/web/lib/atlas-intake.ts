import { businessModelOf } from '@atlas/domain'

export type IntakeSlot = 'sector' | 'model' | 'goal'

export interface Intake {
  base: string
  sector?: string
  model?: string
  goal?: string
}

export function intakeQuestion(slot: IntakeSlot): string {
  if (slot === 'sector') return 'Quel est le métier ? Dites-le avec vos mots : mode, restauration, logistique, formation… tout domaine convient.'
  if (slot === 'model') return 'Comment vendez-vous ? Boutique, marque, SaaS, agence, freelance…'
  return 'Quel résultat visez-vous en premier ?'
}

export function isIntakeCancel(text: string): boolean {
  return /^(annule|stop|arr[eê]te|laisse tomber|oublie)/i.test(text.trim())
}

export function composeIntention(intake: Intake): string {
  const parts = [intake.base.trim()]
  if (intake.sector && !includes(intake.base, intake.sector)) parts.push(`Secteur : ${intake.sector}`)
  if (intake.model && !includes(intake.base, intake.model)) parts.push(`Modèle : ${intake.model}`)
  if (intake.goal && !includes(intake.base, intake.goal)) parts.push(`Objectif : ${intake.goal}`)
  return parts.filter(Boolean).join('. ')
}

export function nextIntakeSlot(text: string): IntakeSlot | null {
  const blob = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const words = blob.split(/\s+/).filter((word) => word.length > 1)
  if (enoughForPlan(blob, words)) return null
  if (!hasDomain(blob, words)) return 'sector'
  if (!hasModel(blob) && words.length < 8) return 'model'
  if (!hasDirection(blob) && words.length < 8) return 'goal'
  return null
}

export function absorbAnswer(intake: Intake, answer: string): Intake {
  const slot = nextIntakeSlot(composeIntention(intake))
  const value = answer.replace(/\s+/g, ' ').trim()
  if (!slot || !value) return intake
  if (slot === 'sector') return { ...intake, sector: value }
  if (slot === 'model') return { ...intake, model: value }
  return { ...intake, goal: value }
}

function enoughForPlan(blob: string, words: string[]): boolean {
  if (words.length < 4) return false
  if (/secteur\s*:/.test(blob) && (hasDomain(blob, words) || hasOffer(blob))) return true
  if (hasOffer(blob) && (hasAudience(blob) || hasModel(blob) || words.length >= 6)) return true
  if (hasDomain(blob, words) && hasAudience(blob) && words.length >= 6) return true
  if (hasDomain(blob, words) && hasModel(blob) && hasDirection(blob)) return true
  if (words.length >= 8 && /cr[eé]e|monte|lance|marque|startup|boutique|studio|agence/.test(blob)) return true
  return false
}

function hasDomain(blob: string, words: string[]): boolean {
  if (/secteur\s*:/.test(blob)) return true
  if (hasOffer(blob) || hasAudience(blob)) return true
  if (KNOWN_DOMAIN.test(blob)) return true
  return words.length >= 8
}

function hasOffer(blob: string): boolean {
  return /marque|produit|collection|v[eê]tements?|habits?|textile|bijou|cosm[eé]tique|parfum|boutique|magasin|restaurant|caf[eé]|bar|h[oô]tel|formation|cours|coach|consult|cabinet|appli|application|plateforme|logiciel|outil|service|studio|agence|clinique|saas|marketplace|e-?commerce|shopify|startup|site web|application mobile|livraison|sushis?|food|mode\b/.test(blob)
}

function hasAudience(blob: string): boolean {
  return /pour |destin[eé]e? |femmes?|hommes?|enfants|b[eé]b[eé]s|pme|b2b|b2c|clients?|patients?|cr[eé]ateurs?/.test(blob)
}

function hasModel(blob: string): boolean {
  if (businessModelOf(blob) !== 'autre') return true
  return /marque|boutique|collection|abonnement|agence|freelance|saas|marketplace|e-?commerce/.test(blob)
}

function hasDirection(blob: string): boolean {
  return /pour |afin |objectif|abonn|croissance|leads|clients?|patients?|ventes|\barr\b|mrr|trimestre|mois|marque|femmes?|hommes?/.test(blob)
}

const KNOWN_DOMAIN = /cyber|sant[eé]|immo|jeu|design|retail|logist|financ|educ|agro|[eé]nergie|\bpme\b|b2b|b2c|jurid|legal|food|mode|luxe|voyage|sport|restauration|clinique|logiciel|saas|marketplace|e-?commerce|v[eê]tement|textile|beauté|beaute|cosm[eé]tique/

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase())
}
