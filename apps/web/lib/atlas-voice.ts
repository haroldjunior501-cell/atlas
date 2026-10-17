import {
  detectExtractFocus,
  detectTransformOp,
  extractSaveAs,
  extractSourceFile,
  isExtractRequest,
  isImageRequest,
  isTransformRequest,
  type ExtractFocus,
  type TransformOp,
} from '@/lib/atlas-docwork'
import { CONNECTOR_CATALOG, spaceFromText, speechLang } from '@atlas/domain'

export { speechLang }

export function atlasGreeting(name: string): string {
  const who = name.trim()
  if (!who || who === 'Vous') return 'Salut, que puis-je faire pour toi ?'
  return `Salut ${who}, que puis-je faire pour toi ?`
}

export type StudioView =
  | 'organigramme'
  | 'bureau'
  | 'factures'
  | 'employes'
  | 'missions'
  | 'workflows'
  | 'reunions'
  | 'approbations'
  | 'connaissances'
  | 'integrations'
  | 'observabilite'
  | 'templates'
  | 'tutoriels'
  | 'compte'

export type AtlasAction =
  | { kind: 'listen' }
  | { kind: 'compose'; text: string }
  | { kind: 'navigate'; view: StudioView }
  | { kind: 'mode'; advanced: boolean }
  | { kind: 'approve' }
  | { kind: 'reject' }
  | { kind: 'home' }
  | { kind: 'clear_org' }
  | { kind: 'answer'; text: string }
  | { kind: 'template'; title: 'SaaS' | 'Agence' | 'E-commerce' | 'Freelance' }
  | { kind: 'department'; name: string }
  | { kind: 'hire'; role: string; department?: string }
  | { kind: 'move'; name: string; department: string }
  | { kind: 'fire'; name: string }
  | { kind: 'mission'; text: string }
  | { kind: 'ask'; name: string; question: string }
  | { kind: 'plan'; steps: PlanStep[]; summary: boolean }
  | { kind: 'autonomy'; name: string; level: 'autonomous' | 'approval' }
  | { kind: 'collaborate'; with: string[] }
  | { kind: 'workflow'; text: string }
  | { kind: 'meeting'; title: string; with?: string[] }
  | { kind: 'brief' }
  | { kind: 'team' }
  | { kind: 'tasks' }
  | { kind: 'tools' }
  | { kind: 'load' }
  | { kind: 'import' }
  | { kind: 'search'; query: string }
  | { kind: 'videos'; query: string }
  | { kind: 'mail'; provider: string; label: string }
  | { kind: 'post'; text: string; channel: string }
  | { kind: 'install'; name: string; provider?: string; url: string }
  | { kind: 'connect'; provider: string; url?: string }
  | { kind: 'invoke'; provider: string; tool: string; input: string }
  | { kind: 'knowledge'; question: string }
  | { kind: 'remember'; text: string; category?: string }
  | { kind: 'forget'; query: string }
  | { kind: 'recall'; query?: string }
  | { kind: 'correct_memory'; key: string; value: string }
  | { kind: 'research'; query: string; mode?: string }
  | { kind: 'teach'; topic: string; style?: 'explain' | 'exercise' | 'quiz' | 'path' | 'interview' | 'exam' }
  | { kind: 'draft'; format: 'document' | 'presentation' | 'website' | 'report' | 'email' | 'post' | 'script' | 'table'; topic: string }
  | { kind: 'code'; intent: 'explain' | 'generate' | 'fix' | 'refactor' | 'test' | 'debug' | 'docs'; text: string }
  | { kind: 'extract'; focus: ExtractFocus; ask: string; source?: string; saveAs?: string }
  | { kind: 'transform'; op: TransformOp; ask: string; source?: string; saveAs?: string }
  | { kind: 'image'; prompt: string; title?: string }
  | { kind: 'film'; prompt: string; title?: string }
  | { kind: 'orchestrate'; scope: 'all' | 'relance' | 'envoi' | 'reappro' }
  | { kind: 'space'; op: 'add' | 'remove'; target: string; name?: string }
  | { kind: 'equip'; name: string; provider: string; on: boolean }
  | { kind: 'follow'; name: string }
  | { kind: 'crew'; mission: string }

const VIEWS: Array<{ re: RegExp; view: StudioView }> = [
  { re: /bureau 3d|jumeau|vue 3d|\b3d\b/, view: 'bureau' },
  { re: /factur|devis|encaiss/, view: 'factures' },
  { re: /organigramme/, view: 'organigramme' },
  { re: /employ/, view: 'employes' },
  { re: /mission/, view: 'missions' },
  { re: /workflow|proc[eé]dure/, view: 'workflows' },
  { re: /r[eé]union/, view: 'reunions' },
  { re: /approbation|d[eé]cision/, view: 'approbations' },
  { re: /connaissance/, view: 'connaissances' },
  { re: /int[eé]gration|connecteur/, view: 'integrations' },
  { re: /observ/, view: 'observabilite' },
  { re: /template|mod[eè]le/, view: 'templates' },
  { re: /tutoriel/, view: 'tutoriels' },
  { re: /compte|s[eé]curit/, view: 'compte' },
]

export function viewLabel(view: StudioView): string {
  const labels: Record<StudioView, string> = {
    organigramme: 'l’organigramme',
    bureau: 'le Bureau 3D',
    factures: 'les factures',
    employes: 'les employés',
    missions: 'les missions',
    workflows: 'les workflows',
    reunions: 'les réunions',
    approbations: 'les approbations',
    connaissances: 'les connaissances',
    integrations: 'les intégrations',
    observabilite: 'l’observabilité',
    templates: 'les modèles',
    tutoriels: 'les tutoriels',
    compte: 'le compte',
  }
  return labels[view]
}

function clean(value: string): string {
  return value
    .replace(/^[,\s.…!?:]+/g, '')
    .replace(/[.…,!?:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titled(value: string): string {
  const text = clean(value)
  if (!text) return ''
  return text.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
}

export function youtubeQuery(raw: string): string {
  const stripped = clean(raw.replace(/\b(atlas|jarvis)\b/gi, ' '))
  const after = stripped.match(
    /(?:vid[eé]os?|youtube|you\s*tube)\s*(?:moi\s+)?(?:les?\s+|des?\s+)?(?:sur\s+|de\s+|pour\s+|d['’])?\s*(.+)$/i,
  )
  if (after?.[1]) return clean(after[1])
  return clean(stripped
    .replace(/^(?:recherche|cherche|montre|ouvre|trouve|lance|regarde|search|find|show|open|watch)[- ]?(?:moi\s+|me\s+)?/i, '')
    .replace(/^(?:les?\s+|des?\s+|some\s+|the\s+)?/i, '')
    .replace(/^vid[eé]os?\s*/i, '')
    .replace(/^(?:sur\s+|de\s+|pour\s+|d['’]|on\s+|about\s+)/i, '')
    .replace(/^you\s*tube\s*/i, ''))
}

export function youtubeSearchUrl(query: string): string {
  const q = query.trim()
  if (!q) return 'https://www.youtube.com/'
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

/** Créer une vidéo, pas en chercher une sur YouTube. */
export function filmAction(text: string): { kind: 'film'; prompt: string; title?: string } | null {
  const heard = text.toLowerCase()
  if (/\b(?:youtube|you\s*tube)\b/.test(heard)) return null
  if (/\b(?:cherche|recherche|trouve|regarde)\b/.test(heard) && !/\b(?:g[eé]n[eè]re|cr[eé]e|fais|tourne|r[eé]alise|generate|make)\b/.test(heard)) {
    return null
  }
  const creating = /\b(?:g[eé]n[eè]re|cr[eé]e|fais|tourne|r[eé]alise|produce|generate|make)\b.{0,48}\b(?:vid[eé]o|film|clip|s[eé]quence)\b/.test(heard)
    || /\b(?:vid[eé]o|film)\b.{0,32}\b(?:haute qualit[eé]|cin[eé]ma|cinématographique)\b/.test(heard)
  if (!creating) return null
  const prompt = clean(text.replace(
    /^(?:atlas[, ]*)?(?:g[eé]n[eè]re|cr[eé]e|fais|tourne|r[eé]alise|produce|generate|make)\s+(?:moi\s+)?(?:une?\s+|un\s+|le\s+|la\s+)?(?:vid[eé]o|film|clip|s[eé]quence)\s*(?:de|d['’]|sur|avec|of|about)?\s*/i,
    '',
  ))
  const body = prompt || clean(text)
  if (body.length < 3) return null
  return { kind: 'film', prompt: body }
}

export function webSearchUrl(query: string): string {
  const q = query.trim()
  if (!q) return 'https://duckduckgo.com/'
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
}

export const ATLAS_APPS = [
  { keys: /gmail|google mail/, label: 'Gmail', provider: 'gmail', url: 'https://mail.google.com' },
  { keys: /outlook|hotmail/, label: 'Outlook', provider: 'outlook', url: 'https://outlook.live.com' },
  { keys: /slack/, label: 'Slack', provider: 'slack', url: 'https://slack.com/downloads' },
  { keys: /teams/, label: 'Teams', provider: 'teams', url: 'https://www.microsoft.com/microsoft-teams/download-app' },
  { keys: /google agenda|google calendar/, label: 'Google Calendar', provider: 'google_calendar', url: 'https://calendar.google.com' },
  { keys: /outlook calendar|calendrier outlook/, label: 'Outlook Calendar', provider: 'outlook_calendar', url: 'https://outlook.live.com/calendar' },
  { keys: /github/, label: 'GitHub', provider: 'github', url: 'https://desktop.github.com' },
  { keys: /gitlab/, label: 'GitLab', provider: 'gitlab', url: 'https://gitlab.com' },
  { keys: /jira/, label: 'Jira', provider: 'jira', url: 'https://www.atlassian.com/software/jira' },
  { keys: /linear/, label: 'Linear', provider: 'linear', url: 'https://linear.app' },
  { keys: /google drive|drive google/, label: 'Google Drive', provider: 'google_drive', url: 'https://drive.google.com' },
  { keys: /onedrive/, label: 'OneDrive', provider: 'onedrive', url: 'https://onedrive.live.com' },
  { keys: /notion/, label: 'Notion', provider: 'notion', url: 'https://www.notion.so/desktop' },
  { keys: /dropbox/, label: 'Dropbox', provider: 'dropbox', url: 'https://www.dropbox.com/downloading' },
  { keys: /hubspot/, label: 'HubSpot', provider: 'hubspot', url: 'https://www.hubspot.com' },
  { keys: /salesforce/, label: 'Salesforce', provider: 'salesforce', url: 'https://login.salesforce.com' },
  { keys: /pipedrive/, label: 'Pipedrive', provider: 'pipedrive', url: 'https://www.pipedrive.com' },
  { keys: /\bcrm\b/, label: 'CRM', provider: 'crm', url: 'https://duckduckgo.com/?q=CRM' },
  { keys: /stripe/, label: 'Stripe', provider: 'stripe', url: 'https://dashboard.stripe.com' },
  { keys: /mixpanel/, label: 'Mixpanel', provider: 'mixpanel', url: 'https://mixpanel.com' },
  { keys: /analytics|google analytics|ga4/, label: 'Analytics', provider: 'analytics', url: 'https://analytics.google.com' },
  { keys: /figma/, label: 'Figma', provider: 'figma', url: 'https://www.figma.com' },
  { keys: /canva/, label: 'Canva', provider: 'canva', url: 'https://www.canva.com' },
  { keys: /mootion/, label: 'Mootion', provider: 'mootion', url: 'https://www.mootion.com' },
  { keys: /shopify/, label: 'Shopify', provider: 'shopify', url: 'https://www.shopify.com' },
  { keys: /n8n/, label: 'n8n', provider: 'n8n', url: 'https://n8n.io' },
  { keys: /\bmcp\b/, label: 'MCP', provider: 'mcp', url: 'https://modelcontextprotocol.io' },
  { keys: /puppeteer|computer use/, label: 'Navigateur', provider: 'browser', url: 'https://github.com/modelcontextprotocol/servers' },
  { keys: /\bssh\b|agent local|ordinateur|cet ordi/, label: 'Ordinateur', provider: 'machine', url: 'local://desktop' },
] as const

/** Apps OS locales (Word, Excel…) — pas des pages de téléchargement. */
export const DESKTOP_VOICE_APPS = [
  { keys: /\b(?:word|winword|microsoft word)\b/, label: 'Word', app: 'word' },
  { keys: /\b(?:excel|tableur)\b/, label: 'Excel', app: 'excel' },
  { keys: /\b(?:powerpoint|power ?point|\bppt\b)\b/, label: 'PowerPoint', app: 'powerpoint' },
  { keys: /\b(?:chrome|google chrome)\b/, label: 'Chrome', app: 'chrome' },
  { keys: /\b(?:edge|microsoft edge)\b/, label: 'Edge', app: 'edge' },
  { keys: /\b(?:bloc[- ]?notes|notepad)\b/, label: 'Bloc-notes', app: 'notepad' },
  { keys: /\b(?:explorateur|explorer)\b/, label: 'Explorateur', app: 'explorer' },
  { keys: /\b(?:calculatrice|calc)\b/, label: 'Calculatrice', app: 'calculator' },
  { keys: /\b(?:vs ?code|visual studio code)\b/, label: 'VS Code', app: 'vscode' },
  { keys: /\bcursor\b/, label: 'Cursor', app: 'cursor' },
  { keys: /\bspotify\b/, label: 'Spotify', app: 'spotify' },
  { keys: /\bdiscord\b/, label: 'Discord', app: 'discord' },
  { keys: /\bnotion\b/, label: 'Notion', app: 'notion' },
  { keys: /\bslack\b/, label: 'Slack', app: 'slack' },
] as const

export function matchDesktopVoiceApp(heard: string) {
  return DESKTOP_VOICE_APPS.find((app) => app.keys.test(heard)) ?? null
}

export function matchApp(heard: string) {
  return ATLAS_APPS.find((app) => app.keys.test(heard)) ?? null
}

export function webQuery(raw: string): string {
  return clean(raw
    .replace(/\b(atlas|jarvis)\b/gi, ' ')
    .replace(/^(?:fais|faire|faites|peux[- ]tu|peux tu|peut[- ]on)\s+(?:des?\s+|une\s+)?/i, '')
    .replace(/^(?:des?\s+)?recherches?\s+(?:sur\s+|de\s+|pour\s+)?/i, '')
    .replace(/^(?:recherche[- ]?moi|cherche[- ]?moi|cherche|recherches?|google|bing|trouve[- ]?moi|fais une recherche(?: sur)?)\s+/i, '')
    .replace(/^(?:sur (?:le |l')?(?:web|internet|net|google|ligne)\s*)/i, '')
    .replace(/\s+sur (?:le |l')?(?:web|internet|net|google|ligne)$/i, '')
    .replace(/\s+et\s+(?:adopt[eé]s?|applique|mets? en place|d[eé]ploie)(?:\s+les?)?\s*$/i, ''))
}

export function wantsAdoption(text: string): boolean {
  return /adopt|appliqu|met(?:s|tre) en place|d[eé]ploie|lance l['’]?offre|cr[eé]e.{0,32}workflow/.test(text.toLowerCase())
}

function postChannel(heard: string): string {
  if (/linkedin/.test(heard)) return 'LinkedIn'
  if (/twitter|\bx\b/.test(heard)) return 'X'
  if (/instagram/.test(heard)) return 'Instagram'
  if (/facebook/.test(heard)) return 'Facebook'
  if (/tiktok/.test(heard)) return 'TikTok'
  if (/slack/.test(heard)) return 'Slack'
  return 'le web'
}

export interface PlanStep {
  name: string
  task: string
}

const NOT_NAMES = new Set(['bonjour', 'salut', 'oui', 'non', 'ok', 'merci', 'alors', 'donc', 'bon', 'écoute', 'ecoute', 'dis', 'ensuite', 'puis', 'bref'])

function addressed(part: string): PlanStep | null {
  const asked = part.match(/^demande\s+[àa]\s+(\p{L}+)\s+(?:de\s+|d['’])?(.+)$/iu)
  if (asked?.[1] && asked[2]) return { name: titled(asked[1]), task: clean(asked[2]) }
  const direct = part.match(/^(\p{Lu}\p{L}+)\s*,\s*(.+)$/u)
  if (direct?.[1] && direct[2] && !NOT_NAMES.has(direct[1].toLowerCase())) {
    return { name: direct[1], task: clean(direct[2]) }
  }
  return null
}

export function compoundSteps(raw: string): { steps: PlanStep[]; summary: boolean } | null {
  const text = clean(raw.replace(/\b(jarvis|atlas)\b/gi, ' '))
  const summary = /r[ée]sum[ée]|synth[èe]se/i.test(text)
  const body = text.replace(/[.,;]?\s*(?:et\s+)?(?:ensuite|puis|enfin)?\s*,?\s*fais[- ]moi\s+(?:un|une|le|la)?\s*(?:r[ée]sum[ée]|synth[èe]se).*$/iu, '')
  const parts = body
    .split(/\s*(?:,|;|\bet\b|\bpuis\b|\bensuite\b)\s*(?=demande\s+[àa]\s+)/iu)
    .map((part) => clean(part))
    .filter(Boolean)
  const steps = parts.map(addressed).filter((step): step is PlanStep => Boolean(step))
  if (steps.length < 2 || steps.length !== parts.length) return null
  return { steps, summary }
}

const ORG_WORDS = /entreprise|soci[ée]t[ée]|organisation|startup|agence|[ée]quipe|document|fichier|note|pr[ée]sentation|site web|campagne|workflow|r[ée]union avec|mission/
const PERSON = '(\\p{L}[\\p{L}-]+)'
const WHEN = /demain|aujourd|hier|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d+\s?h\b|heure|rendez|mail|message|t[aâ]che|facture/
const NOT_PERSON = /^(?:le|la|les|l|mon|ma|mes|nos|notre|votre|un|une|des|du|tout|toute|tous|ce|cette|ces|projet|travail|dossier|march[ée]|entreprise|[ée]quipe)$/i

function personOk(name: string | undefined): name is string {
  return Boolean(name) && !NOT_PERSON.test(name!) && !providerIn(name!.toLowerCase())
}

function providerIn(heard: string) {
  return CONNECTOR_CATALOG.find((item) => {
    const label = item.label.toLowerCase()
    return heard.includes(label) || heard.includes(item.provider.replace(/_/g, ' '))
  }) ?? null
}

/** Pilotage du bureau : zones, postes, outils par agent, suivi du travail. */
function officeCommand(text: string, heard: string): AtlasAction | null {
  if (/\b3d\b|jumeau|organigramme/.test(heard)) return null

  const follow = text.match(new RegExp(`(?:o[uù] en est|que fait|qu.est-ce que fait|sur quoi travaille|suis le travail de|montre(?:-moi)? le travail de|flux de travail de)\\s+${PERSON}`, 'iu'))
  if (personOk(follow?.[1])) return { kind: 'follow', name: titled(follow[1]) }

  const grant = text.match(new RegExp(`(?:connecte|branche|relie|[ée]quipe)\\s+${PERSON}\\s+(?:[àa]|au|aux|sur|avec|de)\\s+(.+)`, 'iu'))
    ?? text.match(new RegExp(`donne\\s+(?:[àa]\\s+)?${PERSON}\\s+(?:l['’]\\s*)?acc[eè]s\\s+(?:[àa]|au|aux)\\s+(.+)`, 'iu'))
  if (personOk(grant?.[1]) && grant[2]) {
    const tool = providerIn(grant[2].toLowerCase())
    if (tool) return { kind: 'equip', name: titled(grant[1]), provider: tool.provider, on: true }
  }
  const revoke = text.match(new RegExp(`(?:retire|enl[eè]ve|coupe|d[ée]connecte)\\s+(?:l['’]acc[eè]s\\s+(?:[àa]\\s+)?)?(.+?)\\s+(?:[àa]|de)\\s+${PERSON}\\s*$`, 'iu'))
  if (revoke?.[1] && personOk(revoke[2])) {
    const tool = providerIn(revoke[1].toLowerCase())
    if (tool) return { kind: 'equip', name: titled(revoke[2]), provider: tool.provider, on: false }
  }
  if (WHEN.test(heard)) return null

  const adding = heard.match(/^(?:ajoute|installe|am[ée]nage|construi[st]|cr[ée]e|rajoute)\s+(?:moi\s+)?(?:un |une |des |le |la |l['’]|nouveau |nouvelle |un nouveau |une nouvelle )*(.+)$/)
  if (adding?.[1] && !ORG_WORDS.test(heard) && !/d[ée]partement|employ|agent|\bposte\b/.test(heard)) {
    const space = spaceFromText(adding[1])
    if (space) {
      const named = text.match(/(?:appel[ée]e?s?|nomm[ée]e?s?|intitul[ée]e?s?|baptis[ée]e?s?)\s+(.+)$/i)?.[1]
      return { kind: 'space', op: 'add', target: space.kind, name: named ? titled(named) : undefined }
    }
  }

  const removing = heard.match(/^(?:supprime|retire|enl[eè]ve|ferme|d[ée]truis|d[ée]molis)\s+(?:moi\s+)?(?:le |la |les |l['’]|un |une |ce |cette )?(.+)$/)
  if (removing?.[1]) {
    const target = clean(removing[1])
    if (/^(?:poste|d[ée]partement|salle|zone|pi[eè]ce|espace|bureau)\b/.test(target) || spaceFromText(target)) {
      return { kind: 'space', op: 'remove', target }
    }
  }
  return null
}

export function interpretAtlas(raw: string): AtlasAction {
  const text = clean(raw.replace(/\b(jarvis|atlas)\b/gi, ' '))
  const heard = text.toLowerCase()
  if (!heard || /^(bonjour|salut|écoute|ecoute|oui|ok)$/.test(heard)) return { kind: 'listen' }
  // Mission d’équipe : ATLAS planifie, délègue à plusieurs agents en parallèle, relit
  const crewCue = /mission d['’ ]?[ée]quipe|(?:monte|mobilise|lance|envoie|r[ée]unis)\s+(?:une |l['’ ]?|toute l['’ ]?|mon |ton )?[ée]quipe\s*(?::|,|pour\s+\p{L}+(?:er|ir|re)\b)|avec toute l['’ ]?[ée]quipe|un agent par concurrent|analys\w*\s+(?:\d+|deux|trois|quatre|cinq|six|sept|huit)\s+concurrents/u
  if (crewCue.test(heard)) {
    const mission = text
      .replace(/^\s*(?:atlas|jarvis)[\s,:]*/i, '')
      .replace(/^(?:lance|monte|mobilise|envoie|r[ée]unis)\s+(?:une |l['’ ]?|toute l['’ ]?|mon |ton )?(?:mission d['’ ]?)?[ée]quipe\s*(?:pour|sur|:|,)?\s*/i, '')
      .replace(/^mission d['’ ]?[ée]quipe\s*(?::|,)?\s*/i, '')
      .trim()
    if (mission.length >= 8) return { kind: 'crew', mission }
  }
  // Orchestration du jumeau numérique (factures, stock, répartition)
  if (/\brelance\b.{0,40}(?:factur|impay|retard|[ée]chu|client)/.test(heard)) return { kind: 'orchestrate', scope: 'relance' }
  if (/(?:envoie|finalise|[ée]met).{0,30}(?:brouillon|factur)/.test(heard)) return { kind: 'orchestrate', scope: 'envoi' }
  if (/(?:r[ée]approvisionn|r[ée]assort|commande).{0,30}(?:stock|pi[eè]ces|marchandise)|stock bas/.test(heard)) return { kind: 'orchestrate', scope: 'reappro' }
  if (/orchestr|r[ée]partis? (?:le travail|les t[aâ]ches)|lance (?:toutes )?les actions|optimise (?:le bureau|l.entreprise|les op[ée]rations)/.test(heard)) return { kind: 'orchestrate', scope: 'all' }
  const office = officeCommand(text, heard)
  if (office) return office
  // Supprimer / réinitialiser l’organigramme courant
  if (/(?:supprime|supprimer|efface|effacer|supprimez|détrui[st]|reset|vide|enl[eè]ve|retire).{0,24}(?:cet?te?\s+)?(?:organigramme|organisation|entreprise|chart|équipe)/.test(heard)
    || /(?:organigramme|organisation).{0,16}(?:supprim|effac|détrui|reset|vid)/.test(heard)
    || /^(?:recommence|repartir de zéro|nouvelle organisation vide)$/.test(heard)) {
    return { kind: 'clear_org' }
  }
  // Personal memory (pas « efface l’organigramme »)
  if (/^(?:oublie|oublier)\b/.test(heard)
    || /^(?:efface|supprime)\s+(?:de\s+)?(?:ta\s+|la\s+)?m[eé]moire\b/.test(heard)
    || /ne (?:te )?souviens plus|forget\b/.test(heard)) {
    const query = clean(text
      .replace(/^(?:atlas[, ]*)?(?:oublie|oublier|efface|supprime)\s+(?:que |de |ceci |ça |ca )?/i, '')
      .replace(/^(?:de )?(?:ta |la )?m[eé]moire\s*/i, ''))
    return { kind: 'forget', query: query || '*' }
  }
  if (/^(?:retiens|souviens[- ]toi|m[eé]morise|note que|remember)\b/.test(heard)
    || /\bretiens que\b/.test(heard)) {
    const fact = clean(text
      .replace(/^(?:atlas[, ]*)?(?:retiens|souviens[- ]toi|m[eé]morise|note que|remember)\s+(?:que |que je |que j['’])?/i, ''))
    return { kind: 'remember', text: fact || text }
  }
  if (/^(?:corrige|en fait|non[, ]+)/.test(heard) && /m[eé]moire|retenu|souviens/.test(heard)) {
    const value = clean(text.replace(/^(?:atlas[, ]*)?(?:corrige|en fait|non)[, ]*/i, ''))
    return { kind: 'correct_memory', key: value.slice(0, 40), value }
  }
  if (/que (?:sais|connais)[- ]tu (?:de |sur )?moi|ma m[eé]moire|ce que tu retiens|rappelle[- ]moi ce que tu sais/.test(heard)) {
    return { kind: 'recall', query: clean(text) }
  }
  // Tutor / explain / exam prep
  if (/simule (?:un )?entretien|mock interview|pr[eé]pare[- ]moi (?:un )?entretien/.test(heard)) {
    return { kind: 'teach', topic: clean(text), style: 'interview' }
  }
  if (/cr[eé]e (?:un |une )?(?:quiz|exercice|qcm)|programme d['’]apprentissage|plan d['’][eé]tudes/.test(heard)) {
    const style = /quiz|qcm/.test(heard) ? 'quiz' as const : /exercice/.test(heard) ? 'exercise' as const : 'path' as const
    return { kind: 'teach', topic: clean(text), style }
  }
  if (/pr[eé]pare[- ]moi (?:un |à l['’])?examen|r[eé]visions?\b/.test(heard)) {
    return { kind: 'teach', topic: clean(text), style: 'exam' }
  }
  if (/^(?:explique|explique[- ]moi|qu['’]est[- ]ce que|c['’]est quoi|what is|how does)\b/.test(heard)
    || /\bexplique[- ]moi\b/.test(heard)) {
    // « Sarah, explique-moi… » reste un ordre à l’employé
    if (!/^\p{Lu}\p{L}+\s*,/u.test(text) && !/^demande\s+[àa]\s+/i.test(text)) {
      return { kind: 'teach', topic: clean(text), style: 'explain' }
    }
  }
  // Site web one-page stylé (avant image : « studio photo », « affiche » ne doivent pas voler l’intent)
  if (
    /\b(?:site|landing|vitrine|page d['’]accueil|one[- ]?page)\b/.test(heard)
    && /\b(?:cr[eé]e|cr[eé]er|fais|faire|g[eé]n[eè]re|pr[eé]pare|conçois|concois|design|styl[eé]|moderne|beau|landing)\b/.test(heard)
    && !/\b(?:cherche|recherche|ouvre|ouvrir|visite)\b/.test(heard)
  ) {
    return { kind: 'draft', format: 'website', topic: clean(text) }
  }
  const film = filmAction(text)
  if (film) return film
  // Image generation
  if (isImageRequest(heard)) {
    const prompt = clean(text
      .replace(/^(?:atlas[, ]*)?(?:g[eé]n[eè]re|cr[eé]e|fais|dessine|illustre)\s+(?:moi\s+)?(?:une?\s+)?(?:image|illustration|visuel|photo|logo|affiche|banni[eè]re)\s*(?:de|d['’]|pour|sur)?\s*/i, '')
      || text)
    return { kind: 'image', prompt: prompt || clean(text) }
  }
  // Extract structured info from a source file / text
  if (isExtractRequest(heard)) {
    return {
      kind: 'extract',
      focus: detectExtractFocus(heard),
      ask: clean(text),
      source: extractSourceFile(text) ?? undefined,
      saveAs: extractSaveAs(text) ?? undefined,
    }
  }
  // Transform / reformulate / convert format
  if (isTransformRequest(heard)) {
    return {
      kind: 'transform',
      op: detectTransformOp(heard),
      ask: clean(text),
      source: extractSourceFile(text) ?? undefined,
      saveAs: extractSaveAs(text) ?? undefined,
    }
  }
  // Coding partner
  if (/\b(?:corrige|refactor|refactorise|g[eé]n[eè]re|explique).{0,40}(?:code|fonction|bug|erreur|typescript|python|react)\b/.test(heard)
    || /\b(?:debug|crée des tests|documente (?:ce |le )?projet|analyse (?:ces? )?logs?)\b/.test(heard)
    || /erreur (?:terminal|npm|docker|git)\b/.test(heard)) {
    const intent = /refactor/.test(heard) ? 'refactor' as const
      : /test/.test(heard) ? 'test' as const
        : /debug|bug|erreur|log/.test(heard) ? 'debug' as const
          : /documente/.test(heard) ? 'docs' as const
            : /explique/.test(heard) ? 'explain' as const
              : /corrige/.test(heard) ? 'fix' as const
                : 'generate' as const
    return { kind: 'code', intent, text }
  }
  // Content draft
  if (/\b(?:r[eé]dige|cr[eé]e|pr[eé]pare|g[eé]n[eè]re)\b.{0,48}\b(?:document|rapport|pr[eé]sentation|slides?|email|mail|post|script|tableau|site|landing)\b/.test(heard)
    || /\b(?:contenu marketing|maquette|diagramme)\b/.test(heard)) {
    const kind = /site|landing|vitrine|one[- ]?page/.test(heard) ? 'website' as const
      : /pr[eé]sentation|slides?/.test(heard) ? 'presentation' as const
        : /rapport/.test(heard) ? 'report' as const
          : /email|mail/.test(heard) ? 'email' as const
            : /post|linkedin|tweet/.test(heard) ? 'post' as const
              : /script/.test(heard) ? 'script' as const
                : /tableau/.test(heard) ? 'table' as const
                  : 'document' as const
    return { kind: 'draft', format: kind, topic: clean(text) }
  }
  if (/mode avanc/.test(heard)) return { kind: 'mode', advanced: true }
  if (/mode simple|mode ceo/.test(heard)) return { kind: 'mode', advanced: false }
  const compound = compoundSteps(raw)
  if (compound) return { kind: 'plan', steps: compound.steps, summary: compound.summary }
  const joining = text.match(/demande\s+[àa]\s+(\p{L}+)\s+de\s+(?:me\s+)?(?:rejoindre|venir|parler)/iu)
  if (joining?.[1]) return { kind: 'ask', name: titled(joining[1]), question: '' }
  const spoken = addressed(text)
  if (spoken && !/^demande\b/i.test(text)) return { kind: 'ask', name: spoken.name, question: spoken.task }
  if (/approuv|valide/.test(heard) && heard.length < 48) return { kind: 'approve' }
  if (/refus|rejet/.test(heard) && heard.length < 48) return { kind: 'reject' }
  if (/import/.test(heard)) return { kind: 'import' }
  if (/accueil|revenir/.test(heard) && heard.length < 40) return { kind: 'home' }
  if (/brief|situation|o[uù] en est/.test(heard)) return { kind: 'brief' }
  if (/^(montre|liste|quelles|ouvre)\b/.test(heard) && /t[aâ]che/.test(heard)) return { kind: 'tasks' }
  if (/surcharge|d[eé]bord/.test(heard) && heard.length < 48) return { kind: 'load' }
  if (/\b(?:vid[eé]os?|youtube|you\s*tube)\b/.test(heard) && /(?:cherche|recherche|montre|ouvre|trouve|lance|regarde|search|find|show|open|watch)\b/.test(heard)) {
    return { kind: 'videos', query: youtubeQuery(text) }
  }
  if (/(?:t[eé]l[eé]charge|installe|download)\b/.test(heard)
    || (matchApp(heard) && /\b(ouvre|ouvrir|montre|lance)\b/.test(heard) && !/\bmcp\b|n8n/.test(heard))) {
    const app = matchApp(heard)
    const named = text.match(/(?:t[eé]l[eé]charge|installe|download)\s+(?:l['’]|le |la |les |l application |l['’]app )?(.+)/i)
    const name = app?.label ?? (named?.[1] ? titled(named[1]) : 'cette application')
    return { kind: 'install', name, provider: app?.provider, url: app?.url ?? webSearchUrl(`${name} télécharger`) }
  }
  const pairing = text.match(/(\p{L}+)\s+et\s+(\p{L}+)/iu)
  if (/\bconnecte/.test(heard) && pairing?.[1] && pairing[2] && !matchApp(heard) && !/\bmcp\b|n8n/.test(heard)) {
    return { kind: 'collaborate', with: [titled(pairing[1]), titled(pairing[2])] }
  }
  if (/\b(?:relie|connecte|branche)\b/.test(heard) && (matchApp(heard) || /\bmcp\b|n8n|serveur/.test(heard))) {
    const app = matchApp(heard)
    const href = text.match(/https?:\/\/\S+/i)?.[0]
    return { kind: 'connect', provider: app?.provider ?? (/n8n/.test(heard) ? 'n8n' : 'mcp'), url: href }
  }
  // Répondre / envoyer — avant la lecture, sinon « dernier mail » les détourne
  if (/(?:r[eé]ponds|r[eé]pondre|r[eé]ponse).{0,64}(?:mail|e-?mail|courriel|dernier message|bo[iî]te|inbox)/.test(heard)
    || /(?:mail|e-?mail|courriel|message).{0,40}(?:r[eé]ponds|r[eé]pondre|r[eé]ponse)/.test(heard)
    || /(?:r[eé]ponds|r[eé]pondre).{0,48}(?:en fonction|selon|d['’]apr[eè]s).{0,24}(?:contenu|mail|message)/.test(heard)) {
    const instruction =
      text.match(/(?:dis(?:e)?(?:[- ]lui|[- ]leur)?|en disant|pour dire|message)\s*[:\-–]\s*(.+)/i)?.[1]?.trim()
      || text.replace(/^(?:atlas[, ]*)?(?:r[eé]ponds|r[eé]pondre|fais une r[eé]ponse)\s+(?:au |à l['’]|au dernier |au mail |à ce )?/i, '').trim()
      || 'Réponds poliment et utilement selon le contenu du message.'
    return {
      kind: 'invoke',
      provider: 'gmail',
      tool: 'prepare_reply',
      input: JSON.stringify({ instruction, text }),
    }
  }
  if (/(?:envoie|envoi|envoyer).{0,64}(?:mail|e-?mail|courriel)/.test(heard)
    || /(?:mail|e-?mail|courriel).{0,24}(?:à|a)\s+\S+@\S+/.test(heard)) {
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
    const subject =
      text.match(/(?:sujet|object)\s*[:\-–]\s*(.+?)(?:\.|$)/i)?.[1]?.trim()
      || text.match(/(?:pour|au sujet de|concernant)\s+(.+?)(?:\.|$)/i)?.[1]?.trim()
      || 'Message ATLAS'
    const body =
      text.match(/(?:corps|message|dis(?:e)?(?:[- ]lui|[- ]leur)?)\s*[:\-–]\s*(.+)/i)?.[1]?.trim()
      || `Bonjour,\n\n${subject}.\n\nCordialement,\nATLAS`
    return {
      kind: 'invoke',
      provider: /outlook/.test(heard) ? 'outlook' : 'gmail',
      tool: 'send_email',
      input: JSON.stringify({ to: email, subject, body, text }),
    }
  }
  // Lire / ouvrir les mails — tolère fautes (lie→lis, lit→lis). \b : pas « relie ».
  if (
    !/\b(?:r[eé]ponds|r[eé]pondre|envoie|envoyer|envoi|relie|connecte|branche)\b/.test(heard)
    && (
      /(?:mail|e-?mails?|courriels?|inbox|bo[iî]te (?:mail|de r[eé]ception)|gmail|outlook)/.test(heard)
      && /\b(?:lis|lie|lit|lire|ouvre|ouvrir|regarde|montre|consulte|re[cç]u|check|v[eé]rifie|affiche|dernier|derniers|nouveaux|non[- ]?lus)\b/.test(heard)
      || /\b(?:lis|lie|lit|lire|ouvre|ouvrir|regarde|montre)\b.{0,28}(?:gmail|outlook|mail|e-?mail|courriel|inbox)/.test(heard)
      || /\b(?:dernier|derniers|nouveaux)\s+(?:mail|e-?mails?|courriels?|messages?)\b/.test(heard)
    )
  ) {
    const app = matchApp(heard) ?? ATLAS_APPS[0]
    return { kind: 'mail', provider: app.provider, label: app.label }
  }
  if (/(?:cr[eé]e|ajoute|invite|bloque).{0,32}(?:[eé]v[eé]nement|cr[eé]neau|rendez-vous)/.test(heard) && /agenda|calendrier|calendar/.test(heard)) {
    return { kind: 'invoke', provider: 'google_calendar', tool: 'create_event', input: text }
  }
  // Pilotage in-app (avant « ouvre / lance app ») : Spotify, Notion, Word…
  {
    const appHint = /spotify|youtube|notion|discord|slack|word|notepad|chrome|edge|vscode|cursor|shopify|explorateur|excel|powerpoint|bloc[- ]?notes/i
    const playVerb = /(?:joue|jouer|play|mets|met|lance|lancer)\b/.test(heard)
    const playInApp = playVerb
      && (
        appHint.test(heard)
        || /(?:dans|sur|avec|via)\s+\w+/i.test(heard)
        || /(?:son|morceau|musique|titre|track|album)\b/.test(heard)
      )
      && !/(?:internet|web|google|bing|mail|e-?mail|fichier|document|t[aâ]che|mission|workflow)\b/.test(heard)
    const searchInApp = /(?:cherche|trouve)\b/.test(heard)
      && /(?:dans|sur)\b/.test(heard)
      && (appHint.test(heard) || /(?:dans|sur)\s+\w{2,}/i.test(heard))
      && !/(?:internet|web|google|bing)\b/.test(heard)
    const typeInApp = /(?:[eé]cris|ecris|tape|r[eé]dige)\b/.test(heard)
      && /(?:dans|sur)\b/.test(heard)
      && (appHint.test(heard) || /(?:dans|sur)\s+\w{2,}/i.test(heard))
      && !/(?:fichier|document|note)\b/.test(heard)
    const mediaCtrl = /(?:pause|suivant|pr[eé]c[eé]dent).{0,28}(?:spotify|musique|youtube|son)/i.test(heard)
      || /(?:pause|suivant|pr[eé]c[eé]dent)\s+(?:la\s+)?(?:musique|lecture)/i.test(heard)
    if (playInApp || searchInApp || typeInApp || mediaCtrl) {
      return {
        kind: 'invoke',
        provider: 'machine',
        tool: 'control_app',
        input: JSON.stringify({ text, command: text }),
      }
    }
  }
  // Ordinateur local : ouvrir apps (installées ou système), fichiers, documents
  const deskApp = matchDesktopVoiceApp(heard)
  if (deskApp && /\b(ouvre|ouvrir|lance|lancer|d[eé]marre|start)\b/.test(heard)
    && !/(?:son|morceau|musique|titre|track)\b/.test(heard)
    && !/(?:dans|sur)\s+\w+/i.test(heard)) {
    return { kind: 'invoke', provider: 'machine', tool: 'open_app', input: deskApp.app }
  }
  if (/(?:liste|montre|affiche|quelles).{0,24}(?:applications?|apps?|logiciels?|programmes?)(?:\s+(?:install[eé]s?|sur (?:mon |l['’])?(?:pc|ordinateur)))?/.test(heard)
    || /(?:applications?|apps?) (?:install[eé]s?|disponibles?)/.test(heard)) {
    return { kind: 'invoke', provider: 'machine', tool: 'list_apps', input: text }
  }
  if (/\b(ouvre|ouvrir|lance|lancer|d[eé]marre|start)\b/.test(heard)
    && !/(?:mail|e-?mail|courriel|gmail|outlook|youtube|vid[eé]o|dossier|bureau|documents|t[eé]l[eé]charg|fichier|site|page|url|http)/.test(heard)
    && !/(?:mission|workflow|r[eé]union|int[eé]gration|organigramme|t[aâ]che|task|d[eé]partement)/.test(heard)
    && !/(?:une |la |le )?(?:t[aâ]che|mission|workflow|r[eé]union)\b/.test(heard)
    && !/(?:marque|entreprise|organisation|startup|business|boutique|agence|campagne|produit)/.test(heard)) {
    const named = text.match(
      /(?:ouvre|ouvrir|lance|lancer|d[eé]marre|start)\s+(?:l['’]|le |la |les |l application |l['’]app |application |app )?(.+)$/i,
    )?.[1]?.trim()
    if (named && named.length >= 2 && named.length < 60
      && !/^(?:une |un |la |le )?(?:t[aâ]che|mission|workflow|r[eé]union|marque|entreprise)\b/i.test(named)) {
      return {
        kind: 'invoke',
        provider: 'machine',
        tool: 'open_app',
        input: JSON.stringify({ app: named, text }),
      }
    }
  }
  if (/\b(ouvre|ouvrir|lance)\b/.test(heard) && /\b(chrome|edge|word|excel|powerpoint|bloc[- ]?notes|explorateur|calculatrice|cursor|vs ?code)\b/.test(heard)) {
    const app = matchDesktopVoiceApp(heard)?.app || 'notepad'
    return { kind: 'invoke', provider: 'machine', tool: 'open_app', input: app }
  }
  // Écrire / ajouter DANS un fichier existant (continuité) — avant « crée un fichier »
  if (
    /(?:[eé]cris|ecris|ajoute|mets|insc?ris)\b/.test(heard)
    && (
      /(?:fichier|document|note|\bdedans\b)/.test(heard)
      || /(?:[eé]cris|ecris|ajoute|mets)\s+dans\s+[A-Za-zÀ-ÿ0-9]/.test(heard)
    )
    && !/(?:cr[eé]e|cr[eé]er|crte|nouveau)\b/.test(heard)
  ) {
    const titled =
      text.match(/(?:fichier|document|note)\s+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]{0,60})/i)?.[1]
      || text.match(/(?:dans|sur)\s+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]{1,60})\b/i)?.[1]
    const content =
      text.match(/(?:(?:le |la |l['’])?(?:message|texte|contenu)\s+)(.+)$/i)?.[1]
      || text.match(/(?:fichier|document|note)\s+[A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]{0,60}\s+(.+)$/i)?.[1]
      || text.match(/(?:dedans|dans\s+[A-Za-zÀ-ÿ0-9][\wÀ-ÿ.-]+)\s+(.+)$/i)?.[1]
      || ''
    const title = (titled || '')
      .replace(/\.(txt|md)$/i, '')
      .replace(/[.,!?;:]+$/g, '')
      .trim()
    const body = content
      .replace(/^(?:le |la |l['’])?(?:message|texte|contenu)\s+/i, '')
      .replace(/^[:\-–]\s*/, '')
      .trim()
    const mode = /ajoute|compl[eè]te|append/i.test(heard) ? 'append' : 'replace'
    return {
      kind: 'invoke',
      provider: 'filesystem',
      tool: 'write_document',
      input: JSON.stringify({ title: title || 'Note ATLAS', body, mode, open: true }),
    }
  }
  // Créer un nouveau fichier — « crée » seulement (pas « écris dans »)
  if (/(?:cr[eé]e|cr[eé]er|crte)\b.{0,48}(?:document|fichier|note)/.test(heard)
    || /(?:nouveau document|nouvelle note)/.test(heard)
    || (/\b(?:r[eé]dige)\b.{0,40}(?:document|fichier|note)\b/.test(heard) && !/\bdans\b/.test(heard))) {
    // « nomme / norme / appelé / intitulé … Orelle » + « fichier Orelle »
    const titled =
      text.match(/(?:document|note|fichier)\s+(?:intitul[eé]|nomm[eée]|norme|nomme|appel[eé]|appelé)\s+(?:le |la |l['’]|un |une )?\s*(.+?)(?:\s+(?:avec|qui |et (?:écris|ecris|mets)|contenu)|$)/i)?.[1]
      || text.match(/(?:nomme|norme|nommer|intitule|intitulé)\s+(?:le |la |l['’])?(?:fichier|document|note)\s+(.+?)(?:\s+(?:avec|qui |et (?:écris|ecris))|$)/i)?.[1]
      || text.match(/(?:nomme|norme|nommer)\s+(?:le |la |l['’])?\s*(.+?)(?:\s+(?:avec|qui |et (?:écris|ecris))|$)/i)?.[1]
      || text.match(/(?:fichier|document|note)\s+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ-]{1,40})\b/i)?.[1]
    const content =
      text.match(/(?:avec (?:le )?(?:texte|contenu)|qui (?:dit|contient)|contenu\s*[:\-–]|écris(?:[- ]y|[- ]dedans)?|ecris(?:[- ]y|[- ]dedans)?|mets(?:[- ]y)?)\s*[:\-–]?\s*(.+)$/i)?.[1]
      || ''
    const title = (titled || 'Note ATLAS')
      .replace(/^(?:le |la |l['’]|un |une )\s*/i, '')
      .replace(/[.!?…]+$/g, '')
      .trim()
      .slice(0, 80) || 'Note ATLAS'
    return {
      kind: 'invoke',
      provider: 'filesystem',
      tool: 'create_document',
      input: JSON.stringify({ title, body: content.trim(), open: true }),
    }
  }
  const twin = /\b3d\b|jumeau|factur/.test(heard)
  if (!twin && (/(?:liste|montre|affiche).{0,24}(?:fichier|bureau|documents|t[eé]l[eé]charg)/.test(heard)
    || /(?:qu.?est[- ]ce qu.?il y a|contenu).{0,16}(?:bureau|documents)/.test(heard))) {
    const folder = /bureau|desktop/.test(heard) ? 'desktop' : /t[eé]l[eé]charg/.test(heard) ? 'downloads' : 'documents'
    return { kind: 'invoke', provider: 'filesystem', tool: 'list_files', input: JSON.stringify({ folder }) }
  }
  if (!twin && /\b(ouvre|ouvrir)\b/.test(heard) && /\b(bureau|documents|t[eé]l[eé]chargements)\b/.test(heard) && !/\bfichier\b/.test(heard)) {
    const folder = /bureau/.test(heard) ? 'desktop' : /t[eé]l[eé]charg/.test(heard) ? 'downloads' : 'documents'
    return { kind: 'invoke', provider: 'filesystem', tool: 'open_folder', input: JSON.stringify({ folder }) }
  }
  if (/remplis.{0,32}formulaire|pilote le navigateur|extrait.{0,24}(?:du |le )?site|computer use/.test(heard)) {
    return { kind: 'invoke', provider: 'browser', tool: 'open_app', input: 'chrome' }
  }
  if (/\bssh\b|commande (?:sur la )?machine|agent local|d[eé]marre le service|arr[eê]te le service|travaille sur (?:mon |l[''])?ordinateur|contr[oô]le (?:mon |l[''])?ordinateur/.test(heard)) {
    return { kind: 'invoke', provider: 'machine', tool: 'status', input: text }
  }
  if (/(outil|connecteur|int[eé]gration)/.test(heard) && /(montre|liste|ouvre|connect|quels)/.test(heard)) return { kind: 'tools' }
  const studioHunt = /(?:employ|agent ia|d[eé]partement|organigramme)/.test(heard) && !/(?:web|internet|google|ligne)/.test(heard)
  if (!studioHunt && /(?:cherche|recherche|google|bing|trouve[- ]moi)\b/.test(heard)) {
    const query = webQuery(text) || text
    if (/offre|emploi|alternance|formation|h[oô]tel|billet|entreprise|compare|vs\b|produit|[eé]v[eé]nement|site web/.test(heard)) {
      return { kind: 'research', query, mode: undefined }
    }
    return { kind: 'search', query }
  }
  if (/(?:fais une recherche|(?:fais|faire)\s+des?\s+recherches?|sur (?:le |l')?(?:web|internet|net))\b/.test(heard)) {
    return { kind: 'research', query: webQuery(text) || text }
  }
  if (/(?:meilleur(?:e|s)? produits?|que vendre|quoi vendre|quels? produits?|quoi proposer|quelle offre)/.test(heard)) {
    return { kind: 'research', query: webQuery(text) || text, mode: 'product' }
  }
  if (/(?:offre d['’]?emploi|alternance|formation |h[oô]tels?|billets?|compare .{0,40} et |qui est (?:l['’])?entreprise)/.test(heard)) {
    return { kind: 'research', query: webQuery(text) || text }
  }
  if (/dossier|base de connaissance|m[eé]moire|que dit|qu.est-ce qu.on sait/.test(heard)) {
    return { kind: 'knowledge', question: text }
  }
  if (/qu.est-ce qui se passe|pr[eé]pare ma journ|mes priorit|r[eé]sum[eé] de l.entreprise|que dois-je faire|point sur|briefing|fais-moi le point/.test(heard)) {
    return { kind: 'brief' }
  }
  if (/^(montre|liste|qui)\b/.test(heard) && /[eé]quipe|employ/.test(heard)) return { kind: 'team' }

  if (/mod[eè]le|template/.test(heard)) {
    if (/saas/.test(heard)) return { kind: 'template', title: 'SaaS' }
    if (/agence/.test(heard)) return { kind: 'template', title: 'Agence' }
    if (/e-?commerce|boutique/.test(heard)) return { kind: 'template', title: 'E-commerce' }
    if (/freelance|solo/.test(heard)) return { kind: 'template', title: 'Freelance' }
    return { kind: 'navigate', view: 'templates' }
  }

  if (/\b(ouvre|ouvrir|montre|montrer|affiche)\b/.test(heard)) {
    const hit = VIEWS.find((item) => item.re.test(heard))
    if (hit) return { kind: 'navigate', view: hit.view }
  }

  const department = heard.match(/(?:cr[eé]e|ajoute|ouvre)\s+(?:un\s+|le\s+)?d[eé]partement\s+(.+)/)
  if (department?.[1]) return { kind: 'department', name: titled(department[1]) }

  const hire = heard.match(/(?:embauche|recrute|ajoute un employ[ée]|ajoute un agent)\s*(.*)/)
  if (hire) {
    const [, rolePart = '', where] = (hire[1] || '').match(/^(.*?)(?:\s+(?:dans|au|à|a|pour|en)\s+(?:le |la |l['’]|les )?(?:d[ée]partement\s+|service\s+|p[ôo]le\s+)?(.+))?$/) ?? []
    const role = titled(rolePart.replace(/^(?:un|une|des|le|la|l['’])\s+/, '').replace(/^(?:employ[ée]|agent)\s+/, '')) || 'Support client'
    return where ? { kind: 'hire', role, department: titled(where) } : { kind: 'hire', role }
  }

  const moved = text.match(/(?:d[eé]place|transf[eè]re)\s+(\p{L}+)\s+(?:vers|dans|au d[eé]partement)\s+(.+)/iu)
  if (moved?.[1] && moved[2]) return { kind: 'move', name: titled(moved[1]), department: titled(moved[2]) }
  const fired = text.match(/^(?:retire|licencie)\s+(?:l['’]employ[ée]\s+)?(\p{L}+)/iu)
  if (fired?.[1]) return { kind: 'fire', name: titled(fired[1]) }

  const asked = text.match(/demande\s+[àa]\s+(\p{L}+)\s+(?:de\s+|d['’])?(.+)/iu)
  if (asked?.[1] && asked[2]) return { kind: 'mission', text: `${titled(asked[1])} : ${clean(asked[2])}` }

  const talk = text.match(/^(?:parle|parler|discute|discuter|communique|communiquer)\s+[àa]\s+(\p{L}+)(?:\s+(?:de|d['’]|sur)\s+(.+))?/iu)
  if (talk?.[1] && !/^(?:l['’]?)?[eé]quipe$/.test(talk[1].toLowerCase())) {
    return { kind: 'ask', name: titled(talk[1]), question: clean(talk[2] || '') }
  }
  if (/(?:parle|discute|communique).{0,16}(?:agents?|[eé]quipe)/.test(heard)) return { kind: 'team' }

  const tell = text.match(/^(?:dis|dit)\s+[àa]\s+(\p{L}+)\s+(?:de\s+|d['’])?(.+)/iu)
  if (tell?.[1] && tell[2]) return { kind: 'mission', text: `${titled(tell[1])} : ${clean(tell[2])}` }

  if (/plus d.autonomie|en autonomie/.test(heard)) {
    const who = heard.match(/[àa]\s+(\p{L}+)/u)
    if (who?.[1]) return { kind: 'autonomy', name: titled(who[1]), level: 'autonomous' }
  }
  if (/moins d.autonomie|retire.+autonomie/.test(heard)) {
    const who = heard.match(/[àa]\s+(\p{L}+)/u)
    if (who?.[1]) return { kind: 'autonomy', name: titled(who[1]), level: 'approval' }
  }
  if (/collabor|connecte|fais travailler/.test(heard)) {
    const pair = text.match(/(\p{L}+)\s+et\s+(\p{L}+)/iu)
    if (pair?.[1] && pair[2]) return { kind: 'collaborate', with: [titled(pair[1]), titled(pair[2])] }
  }

  if (/r[eé]union/.test(heard) && !/^(ouvre|montre|affiche)\b/.test(heard)) {
    const between = heard.match(/(?:entre|avec)\s+(.+?)(?:\s+sur\s+|\s+pour\s+|$)/)
    const withNames = between
      ? between[1].split(/\s+et\s+|,\s*/).map((name) => titled(name)).filter((name) => name.length > 1)
      : []
    const about = heard.match(/\b(?:sur|pour)\s+(.+)/)
    const title = about?.[1] && !/^(entre|avec)\b/.test(about[1])
      ? titled(about[1])
      : withNames.length ? `Point ${withNames.join(' et ')}` : 'Point d’équipe'
    return { kind: 'meeting', title, with: withNames }
  }

  if (/\b(?:r[eé]parti|workflows?|automatise|automatiser)\b/.test(heard)
    || /(?:cr[eé]e?|crte|cree|lance|fais|faire)\s*[- ]?(?:moi\s+)?(?:un\s+|une\s+)?(?:proc[eé]dure|workflow)/.test(heard)) {
    return { kind: 'workflow', text }
  }

  const mission = heard.match(/(?:confie|lance une mission|lance une t[aâ]che|d[eé]marre une t[aâ]che)\s*[:,]?\s*(.+)/)
  if (mission?.[1]) return { kind: 'mission', text: clean(mission[1]) }

  if (/pr[eé]pare.*(campagne|rapport|journ[eé]e)|fais[- ]moi un rapport/.test(heard)) {
    return { kind: 'workflow', text }
  }
  if (/\b(?:publie|poster?\b|fais un post|cr[eé]e un post|[eé]cris un post)/.test(heard)
    || (/(?:linkedin|twitter|instagram|facebook|tiktok)/.test(heard) && /(?:fais|cr[eé]e|r[eé]dige|[eé]cris|publie)/.test(heard))) {
    return { kind: 'post', text, channel: postChannel(heard) }
  }
  if (/pourquoi/.test(heard) && /vente|chiffre|budget|baisse|revenus?/.test(heard)) {
    return { kind: 'knowledge', question: text }
  }

  const buildsOrganization = /(?:cr[eé]e|monte|dessine|compose|g[eé]n[eè]re|lance).{0,80}(?:organisation|entreprise|[eé]quipe|startup|soci[eé]t[eé]|marque|agence|studio|saas|marketplace|e-?commerce|boutique)/.test(heard)
    || /(?:startup|entreprise|organisation|agence|saas|marketplace).{0,48}(?:pour|destin[eé]e?)/.test(heard)
  if (buildsOrganization && text.length >= 3) return { kind: 'compose', text }
  // Filet : toute demande réelle → Atlas répond (ne jamais rester muet / « j’écoute » seul)
  if (text.length >= 4 && !/^(bonjour|salut|hello|bonsoir|merci|ok|oui|non)$/i.test(heard)) {
    return { kind: 'answer', text }
  }
  return { kind: 'listen' }
}

const SPOKEN: Record<string, { how: string; hi: string; thanks: string; name: string; listen: string }> = {
  'fr-FR': {
    how: 'Ça va bien, que puis-je faire pour toi ?',
    hi: 'Salut, que puis-je faire pour toi ?',
    thanks: 'Avec plaisir.',
    name: 'Je suis Atlas, ton partenaire. Dis-moi ce dont tu as besoin.',
    listen: 'Je t’écoute. Dis-moi ce que tu veux.',
  },
  'en-US': {
    how: 'I am doing well. What can I do for you?',
    hi: 'Hi, what can I do for you?',
    thanks: 'You are welcome.',
    name: 'I am Atlas, your partner. Tell me what you need.',
    listen: 'I am listening. Tell me what you want.',
  },
  'es-ES': {
    how: 'Estoy bien. ¿Qué puedo hacer por ti?',
    hi: 'Hola, ¿qué puedo hacer por ti?',
    thanks: 'Con gusto.',
    name: 'Soy Atlas, tu compañero. Dime qué necesitas.',
    listen: 'Te escucho. Dime qué quieres.',
  },
  'de-DE': {
    how: 'Mir geht es gut. Was kann ich für dich tun?',
    hi: 'Hallo, was kann ich für dich tun?',
    thanks: 'Gern geschehen.',
    name: 'Ich bin Atlas, dein Partner. Sag mir, was du brauchst.',
    listen: 'Ich höre zu. Sag mir, was du willst.',
  },
  'it-IT': {
    how: 'Sto bene. Cosa posso fare per te?',
    hi: 'Ciao, cosa posso fare per te?',
    thanks: 'Con piacere.',
    name: 'Sono Atlas, il tuo partner. Dimmi di cosa hai bisogno.',
    listen: 'Ti ascolto. Dimmi cosa vuoi.',
  },
  'pt-BR': {
    how: 'Estou bem. O que posso fazer por você?',
    hi: 'Olá, o que posso fazer por você?',
    thanks: 'Por nada.',
    name: 'Eu sou Atlas, seu parceiro. Diga o que você precisa.',
    listen: 'Estou ouvindo. Diga o que você quer.',
  },
  'ar-SA': {
    how: 'أنا بخير. ماذا أستطيع أن أفعل لك؟',
    hi: 'مرحبا، ماذا أستطيع أن أفعل لك؟',
    thanks: 'على الرحب.',
    name: 'أنا أطلس، شريكك. قل لي ماذا تحتاج.',
    listen: 'أنا أستمع. قل لي ماذا تريد.',
  },
  'ja-JP': {
    how: '元気です。何をしましょうか？',
    hi: 'こんにちは。何をしましょうか？',
    thanks: 'どういたしまして。',
    name: '私はアトラスです。必要なことを教えてください。',
    listen: '聞いています。したいことを教えてください。',
  },
  'ko-KR': {
    how: '잘 지내요. 무엇을 도와드릴까요?',
    hi: '안녕하세요. 무엇을 도와드릴까요?',
    thanks: '천만에요.',
    name: '저는 아틀라스입니다. 필요한 것을 말해 주세요.',
    listen: '듣고 있어요. 원하는 것을 말해 주세요.',
  },
  'zh-CN': {
    how: '我很好。我能帮你做什么？',
    hi: '你好。我能帮你做什么？',
    thanks: '不客气。',
    name: '我是 Atlas，你的伙伴。告诉我你需要什么。',
    listen: '我在听。告诉我你想做什么。',
  },
  'hi-IN': {
    how: 'मैं ठीक हूँ। मैं आपके लिए क्या कर सकता हूँ?',
    hi: 'नमस्ते, मैं आपके लिए क्या कर सकता हूँ?',
    thanks: 'आपका स्वागत है।',
    name: 'मैं एटलस हूँ, आपका साथी। बताइए आपको क्या चाहिए।',
    listen: 'मैं सुन रहा हूँ। बताइए आप क्या चाहते हैं।',
  },
  'ru-RU': {
    how: 'У меня всё хорошо. Чем я могу помочь?',
    hi: 'Привет, чем я могу помочь?',
    thanks: 'Пожалуйста.',
    name: 'Я Атлас, твой партнёр. Скажи, что тебе нужно.',
    listen: 'Я слушаю. Скажи, чего ты хочешь.',
  },
}

export function localVoiceReply(text: string): string {
  const line = SPOKEN[speechLang(text)] ?? SPOKEN['en-US']
  const heard = text.toLowerCase()
  if (/comment (vas|allez)|ça va|ca va|how are you|cómo estás|como estas|wie geht|come stai|como vai/.test(heard)) {
    return line.how
  }
  if (/^(?:bonjour|salut|hello|bonsoir|hey|coucou|hi|hola|ciao|hallo|olá|ola|привет|こんにちは|你好|안녕|مرحبا|नमस्ते)\b/u.test(heard)
    || /^(?:bonjour|salut|hello|bonsoir)[\s,!.?]*$/i.test(heard.trim())) {
    return line.hi
  }
  if (/merci|thanks|thank you|gracias|danke|grazie|obrigad/.test(heard)) return line.thanks
  if (/qui es-tu|ton nom|tu es qui|who are you|your name|quién eres|quien eres|wer bist|pr[eé]sente[- ]?toi|te pr[eé]senter|introduce yourself|pres[eé]ntate/.test(heard)) return line.name
  return line.listen
}

const KINDS = new Set<AtlasAction['kind']>([
  'listen', 'compose', 'navigate', 'mode', 'approve', 'reject', 'home', 'clear_org', 'answer', 'template',
  'department', 'hire', 'move', 'fire', 'mission', 'workflow', 'meeting', 'brief', 'team', 'tasks', 'tools', 'load', 'import',
  'search', 'videos', 'mail', 'post', 'install', 'connect', 'invoke', 'knowledge', 'autonomy', 'collaborate', 'ask',
  'remember', 'forget', 'recall', 'correct_memory', 'research', 'teach', 'draft', 'code',
  'extract', 'transform', 'image', 'film',
])

const TEMPLATE_TITLES = new Set(['SaaS', 'Agence', 'E-commerce', 'Freelance'])
const STUDIO_VIEWS = new Set<StudioView>([
  'organigramme', 'bureau', 'factures', 'employes', 'missions', 'workflows', 'reunions', 'approbations',
  'connaissances', 'integrations', 'observabilite', 'templates', 'tutoriels', 'compte',
])

export function directiveFromModel(raw: string): { reply: string; action: AtlasAction } | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  let body: { reply?: unknown; action?: Record<string, unknown> }
  try {
    body = JSON.parse(match[0]) as { reply?: unknown; action?: Record<string, unknown> }
  } catch {
    return null
  }
  const action = body.action
  if (!action) return null
  const kind = action.kind
  if (typeof kind !== 'string' || !KINDS.has(kind as AtlasAction['kind'])) return null
  const reply = typeof body.reply === 'string' ? body.reply.trim() : ''
  if (kind === 'compose' && typeof action.text === 'string') return { reply, action: { kind, text: action.text } }
  if (kind === 'navigate' && typeof action.view === 'string' && STUDIO_VIEWS.has(action.view as StudioView)) {
    return { reply, action: { kind, view: action.view as StudioView } }
  }
  if (kind === 'mode' && typeof action.advanced === 'boolean') return { reply, action: { kind, advanced: action.advanced } }
  if (kind === 'orchestrate') {
    const scope = ['all', 'relance', 'envoi', 'reappro'].includes(String(action.scope)) ? (action.scope as 'all' | 'relance' | 'envoi' | 'reappro') : 'all'
    return { reply, action: { kind, scope } }
  }
  if (kind === 'template' && typeof action.title === 'string' && TEMPLATE_TITLES.has(action.title)) {
    return { reply, action: { kind, title: action.title as 'SaaS' | 'Agence' | 'E-commerce' | 'Freelance' } }
  }
  if (kind === 'department' && typeof action.name === 'string') return { reply, action: { kind, name: action.name } }
  if (kind === 'hire' && typeof action.role === 'string') {
    return { reply, action: typeof action.department === 'string' && action.department ? { kind, role: action.role, department: action.department } : { kind, role: action.role } }
  }
  if (kind === 'space' && (action.op === 'add' || action.op === 'remove') && typeof action.target === 'string') {
    return { reply, action: { kind, op: action.op, target: action.target, name: typeof action.name === 'string' ? action.name : undefined } }
  }
  if (kind === 'equip' && typeof action.name === 'string' && typeof action.provider === 'string') {
    return { reply, action: { kind, name: action.name, provider: action.provider, on: action.on !== false } }
  }
  if (kind === 'follow' && typeof action.name === 'string') return { reply, action: { kind, name: action.name } }
  if (kind === 'crew' && typeof action.mission === 'string' && action.mission.trim().length >= 8) return { reply, action: { kind, mission: action.mission.trim() } }
  if (kind === 'move' && typeof action.name === 'string' && typeof action.department === 'string') {
    return { reply, action: { kind: 'move', name: action.name, department: action.department } }
  }
  if (kind === 'fire' && typeof action.name === 'string') return { reply, action: { kind: 'fire', name: action.name } }
  if ((kind === 'mission' || kind === 'workflow') && typeof action.text === 'string') return { reply, action: { kind, text: action.text } }
  if (kind === 'meeting' && typeof action.title === 'string') {
    const withNames = Array.isArray(action.with) ? action.with.filter((item): item is string => typeof item === 'string') : undefined
    return { reply, action: { kind, title: action.title, with: withNames } }
  }
  if (kind === 'search' && typeof action.query === 'string') return { reply, action: { kind: 'search', query: action.query } }
  if (kind === 'videos' && typeof action.query === 'string') return { reply, action: { kind: 'videos', query: action.query } }
  if (kind === 'mail' && typeof action.provider === 'string') {
    const app = matchApp(String(action.provider)) ?? ATLAS_APPS.find((item) => item.provider === action.provider) ?? ATLAS_APPS[0]
    return { reply, action: { kind: 'mail', provider: String(action.provider), label: typeof action.label === 'string' ? action.label : app.label } }
  }
  if (kind === 'post' && typeof action.text === 'string') {
    return { reply, action: { kind: 'post', text: action.text, channel: typeof action.channel === 'string' ? action.channel : 'le web' } }
  }
  if (kind === 'install' && typeof action.name === 'string') {
    const app = matchApp(action.name.toLowerCase())
    return {
      reply,
      action: {
        kind: 'install',
        name: action.name,
        provider: typeof action.provider === 'string' ? action.provider : app?.provider,
        url: typeof action.url === 'string' ? action.url : app?.url ?? webSearchUrl(`${action.name} télécharger`),
      },
    }
  }
  if (kind === 'connect' && typeof action.provider === 'string') {
    return { reply, action: { kind: 'connect', provider: action.provider, url: typeof action.url === 'string' ? action.url : undefined } }
  }
  if (kind === 'invoke' && typeof action.provider === 'string') {
    return { reply, action: { kind: 'invoke', provider: action.provider, tool: typeof action.tool === 'string' ? action.tool : 'run', input: typeof action.input === 'string' ? action.input : '' } }
  }
  if (kind === 'knowledge' && typeof action.question === 'string') return { reply, action: { kind, question: action.question } }
  if (kind === 'remember' && typeof action.text === 'string') {
    return { reply, action: { kind, text: action.text, category: typeof action.category === 'string' ? action.category : undefined } }
  }
  if (kind === 'forget' && typeof action.query === 'string') return { reply, action: { kind, query: action.query } }
  if (kind === 'recall') return { reply, action: { kind, query: typeof action.query === 'string' ? action.query : undefined } }
  if (kind === 'correct_memory' && typeof action.key === 'string' && typeof action.value === 'string') {
    return { reply, action: { kind, key: action.key, value: action.value } }
  }
  if (kind === 'research' && typeof action.query === 'string') {
    return { reply, action: { kind, query: action.query, mode: typeof action.mode === 'string' ? action.mode : undefined } }
  }
  if (kind === 'teach' && typeof action.topic === 'string') {
    const style = action.style
    const allowed = style === 'explain' || style === 'exercise' || style === 'quiz' || style === 'path' || style === 'interview' || style === 'exam'
    return { reply, action: { kind, topic: action.topic, style: allowed ? style : 'explain' } }
  }
  if (kind === 'draft' && typeof action.topic === 'string') {
    const formats = new Set(['document', 'presentation', 'website', 'report', 'email', 'post', 'script', 'table'])
    const raw = typeof action.format === 'string' ? action.format
      : typeof (action as { type?: unknown }).type === 'string' ? (action as { type: string }).type
        : 'document'
    const format = formats.has(raw)
      ? raw as 'document' | 'presentation' | 'website' | 'report' | 'email' | 'post' | 'script' | 'table'
      : 'document'
    return { reply, action: { kind: 'draft', format, topic: action.topic } }
  }
  if (kind === 'code' && typeof action.text === 'string') {
    const intent = action.intent
    const allowed = intent === 'explain' || intent === 'generate' || intent === 'fix' || intent === 'refactor' || intent === 'test' || intent === 'debug' || intent === 'docs'
    return { reply, action: { kind, intent: allowed ? intent : 'generate', text: action.text } }
  }
  if (kind === 'film' && typeof action.prompt === 'string') {
    return {
      reply,
      action: {
        kind: 'film',
        prompt: action.prompt,
        title: typeof action.title === 'string' ? action.title : undefined,
      },
    }
  }
  if (kind === 'image' && typeof action.prompt === 'string') {
    return {
      reply,
      action: {
        kind: 'image',
        prompt: action.prompt,
        title: typeof action.title === 'string' ? action.title : undefined,
      },
    }
  }
  if (kind === 'extract' && typeof action.ask === 'string') {
    const focusRaw = typeof action.focus === 'string' ? action.focus : 'general'
    const focuses = new Set(['facts', 'dates', 'people', 'numbers', 'actions', 'emails', 'keywords', 'summary', 'general'])
    const focus = (focuses.has(focusRaw) ? focusRaw : 'general') as ExtractFocus
    return {
      reply,
      action: {
        kind: 'extract',
        focus,
        ask: action.ask,
        source: typeof action.source === 'string' ? action.source : undefined,
        saveAs: typeof action.saveAs === 'string' ? action.saveAs : undefined,
      },
    }
  }
  if (kind === 'transform' && typeof action.ask === 'string') {
    const opRaw = typeof action.op === 'string' ? action.op : 'reformulate'
    const ops = new Set(['reformulate', 'correct', 'translate', 'simplify', 'formalize', 'markdown', 'html', 'csv', 'json', 'bullets', 'email', 'report', 'checklist'])
    const op = (ops.has(opRaw) ? opRaw : 'reformulate') as TransformOp
    return {
      reply,
      action: {
        kind: 'transform',
        op,
        ask: action.ask,
        source: typeof action.source === 'string' ? action.source : undefined,
        saveAs: typeof action.saveAs === 'string' ? action.saveAs : undefined,
      },
    }
  }
  if (kind === 'ask' && typeof action.name === 'string') {
    return { reply, action: { kind, name: action.name, question: typeof action.question === 'string' ? action.question : '' } }
  }
  if (kind === 'autonomy' && typeof action.name === 'string' && (action.level === 'autonomous' || action.level === 'approval')) {
    return { reply, action: { kind, name: action.name, level: action.level } }
  }
  if (kind === 'collaborate' && Array.isArray(action.with)) {
    const withNames = action.with.filter((item): item is string => typeof item === 'string')
    if (withNames.length >= 2) return { reply, action: { kind, with: withNames.slice(0, 2) } }
  }
  if (kind === 'listen' || kind === 'approve' || kind === 'reject' || kind === 'home' || kind === 'clear_org' || kind === 'brief' || kind === 'team' || kind === 'tasks' || kind === 'tools' || kind === 'load' || kind === 'import') {
    return { reply, action: { kind } }
  }
  if (kind === 'answer' && typeof action.text === 'string') return { reply, action: { kind, text: action.text } }
  return null
}
