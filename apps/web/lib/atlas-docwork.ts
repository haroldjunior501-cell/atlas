/**
 * Extract / Transform — pipeline documentaire Atlas.
 * Lit une source (fichier local ou texte), structure le résultat, optionnellement sauvegarde.
 */

export type ExtractFocus =
  | 'facts'
  | 'dates'
  | 'people'
  | 'numbers'
  | 'actions'
  | 'emails'
  | 'keywords'
  | 'summary'
  | 'general'

export type TransformOp =
  | 'reformulate'
  | 'correct'
  | 'translate'
  | 'simplify'
  | 'formalize'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'json'
  | 'bullets'
  | 'email'
  | 'report'
  | 'checklist'

export function detectExtractFocus(heard: string): ExtractFocus {
  const h = heard.toLowerCase()
  if (/date|calendrier|échéance|deadline/.test(h)) return 'dates'
  if (/personne|qui |nom|contact|intervenant/.test(h)) return 'people'
  if (/chiffre|nombre|montant|budget|%|pourcentage|stat/.test(h)) return 'numbers'
  if (/action|todo|t[aâ]che|next step|prochaine [eé]tape/.test(h)) return 'actions'
  if (/e-?mail|courriel|@/.test(h)) return 'emails'
  if (/mot[- ]?cl[eé]|keyword|th[eè]me/.test(h)) return 'keywords'
  if (/r[eé]sum|synth[eè]se/.test(h)) return 'summary'
  if (/fait|information|donn[eé]e|extrait/.test(h)) return 'facts'
  return 'general'
}

export function detectTransformOp(heard: string): TransformOp {
  const h = heard.toLowerCase()
  if (/tradui|en anglais|in english|en espagnol|en allemand/.test(h)) return 'translate'
  if (/simplifi|plus simple|vulgaris/.test(h)) return 'simplify'
  if (/formal|professionnel|soutenu|plus pro/.test(h)) return 'formalize'
  if (/corrig|orthographe|grammaire/.test(h)) return 'correct'
  if (/checklist|liste de (?:contr[oô]le|v[eé]rif)/.test(h)) return 'checklist'
  if (/markdown|\.md\b|en md\b/.test(h)) return 'markdown'
  if (/html|\.html\b/.test(h)) return 'html'
  if (/csv|\.csv\b|tableau csv/.test(h)) return 'csv'
  if (/json|\.json\b/.test(h)) return 'json'
  if (/puce|bullet|liste [àa] puces/.test(h)) return 'bullets'
  if (/e-?mail|courriel|mail de /.test(h)) return 'email'
  if (/rapport|m[eé]mo/.test(h)) return 'report'
  if (/reformul|r[eé][eé]cri|r[eé]crire/.test(h)) return 'reformulate'
  return 'reformulate'
}

/** Nom de fichier mentionné dans la phrase. */
export function extractSourceFile(text: string): string | null {
  const named =
    text.match(/(?:fichier|document|note|pdf|texte)\s+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]{0,80})/i)?.[1]
    || text.match(/(?:depuis|dans|sur|de)\s+(?:le |la |l['’])?(?:fichier |document )?([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]+\.(?:txt|md|csv|json|html|log|pdf))/i)?.[1]
    || text.match(/\b([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]+\.(?:txt|md|csv|json|html|log|pdf))\b/i)?.[1]
  if (!named) return null
  return named.replace(/[.,;:!?]+$/g, '').trim()
}

/** Titre de sortie optionnel (« dans Extraits », « sauvegarde comme X »). */
export function extractSaveAs(text: string): string | null {
  const hit =
    text.match(/(?:sauvegarde|enregistre|nomme|norme|dans(?: le fichier)?|vers)\s+(?:sous |comme |le fichier |la note )?([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]{1,60})/i)?.[1]
  if (!hit) return null
  const bad = /^(le|la|les|un|une|ce|cette|fichier|document|note|pdf|texte)$/i
  if (bad.test(hit)) return null
  return hit.replace(/\.(txt|md|csv|json|html)$/i, '').trim()
}

export function isExtractRequest(heard: string): boolean {
  return /(?:extrais|extrait|extraire|extract|r[eé]cup[eè]re(?:r)?|tire)\b/.test(heard)
    || /(?:liste|donne[- ]moi).{0,24}(?:les |des )?(?:dates|noms|chiffres|actions|faits|emails?|mots[- ]cl[eé]s)/.test(heard)
}

export function isTransformRequest(heard: string): boolean {
  return /(?:transforme|conversion|convertis|reformul|r[eé]cris|r[eé][eé]cri|simplifi|formal|tradui|corrig(?:e|er)\s+(?:ce |le |la |l['’])?(?:texte|document|fichier|mail|phrase))/.test(heard)
    || /(?:en|au format)\s+(?:markdown|html|csv|json|puces|mail|rapport|checklist)/.test(heard)
    || /(?:passe|mets)\s+(?:[cç]a |le texte |ce document )?(?:en|au format)\s+/.test(heard)
}

export function isImageRequest(heard: string): boolean {
  // « landing page / site web » prime sur une génération d’image
  if (/\b(?:site|landing|vitrine|one[- ]?page|page d['’]accueil)\b/.test(heard)) return false
  return /(?:g[eé]n[eè]re|cr[eé]e|fais|dessine|illustre)\b.{0,40}\b(?:une? |l['’])?(?:image|illustration|visuel|photo|logo|affiche|banner|banni[eè]re)\b/.test(heard)
    || /\b(?:image|illustration|visuel)\b.{0,20}\b(?:de|d['’]|pour)\b/.test(heard)
}

export const EXTRACT_SYSTEM = `Tu es Atlas, extracteur d’information. Tu lis le TEXTE SOURCE et tu en extrais UNIQUEMENT ce qui est demandé.
Règles :
- Structure claire : titres courts + puces.
- Ne invente rien. Si l’info manque : « Non trouvé dans la source ».
- Pour les emails : listes adresse / sujet / intention.
- Pour les dates : format JJ/MM/AAAA ou ISO si possible + contexte.
- Pour les chiffres : valeur + unité + contexte.
- Pour les personnes : nom + rôle si présent.
- Réponds dans la langue de l’utilisateur.
- Termine par une ligne « Fiabilité : haute|moyenne|basse » selon la clarté de la source.`

export const TRANSFORM_SYSTEM = `Tu es Atlas, transformateur de contenu. Tu transformes le TEXTE SOURCE selon l’opération demandée.
Règles :
- Conserve le sens. N’invente pas de faits.
- Produis un résultat FINAL prêt à coller (pas de méta « voici la version » en long).
- markdown / html / csv / json : format strictement valide.
- email : objet + corps.
- report : titre, sections, conclusion courte.
- checklist : cases [ ] actionnables.
- translate : précise la langue cible en une ligne puis le texte.
- Réponds dans la langue de l’utilisateur (sauf traduction explicite).`

export function buildExtractUser(focus: ExtractFocus, source: string, ask: string): string {
  return `Focus d’extraction : ${focus}
Demande : ${ask}

--- TEXTE SOURCE ---
${source.slice(0, 12000)}
--- FIN SOURCE ---

Extrais maintenant selon le focus.`
}

export function buildTransformUser(op: TransformOp, source: string, ask: string): string {
  return `Opération : ${op}
Demande : ${ask}

--- TEXTE SOURCE ---
${source.slice(0, 12000)}
--- FIN SOURCE ---

Transforme maintenant.`
}

/** Extension de fichier pour une sauvegarde transform. */
export function transformFileExt(op: TransformOp): 'txt' | 'md' | 'csv' | 'json' | 'html' {
  if (op === 'markdown') return 'md'
  if (op === 'html') return 'html'
  if (op === 'csv') return 'csv'
  if (op === 'json') return 'json'
  return 'txt'
}

/** Texte collé inline (« : … » / guillemets) quand aucun fichier n’est nommé. */
export function extractInlineSource(text: string): string | null {
  const quoted = text.match(/[«"']([^«"']{20,})[»"']/)?.[1]
  if (quoted?.trim()) return quoted.trim()
  const afterColon = text.match(/:\s*([\s\S]{20,})$/)?.[1]
  if (afterColon?.trim() && !/\.(txt|md|csv|json|html|pdf)\b/i.test(afterColon)) {
    return afterColon.trim()
  }
  return null
}
