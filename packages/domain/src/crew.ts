/**
 * Mission d’équipe : ATLAS (le chef) planifie, délègue à des agents spécialisés
 * qui travaillent en parallèle avec les outils de leur métier, relit et assemble.
 */

export type CrewRole = 'chercheur' | 'developpeur' | 'designer' | 'redacteur' | 'analyste' | 'renfort'

export type CrewTool = 'WebSearch' | 'WebFetch' | 'Read' | 'Write' | 'Edit' | 'Glob' | 'Grep' | 'Calcul'

export interface CrewRoleInfo {
  label: string
  does: string
  tools: CrewTool[]
  /** Postes de l’organisation les plus proches de ce métier. */
  match: RegExp
}

export const CREW_ROLES: Record<CrewRole, CrewRoleInfo> = {
  chercheur: {
    label: 'Chercheur',
    does: 'Recherches web en parallèle : concurrents, prix, offres, avis, actualités. Sites officiels d’abord, chaque chiffre avec sa date et sa source.',
    tools: ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'],
    match: /march|market|growth|recherche|veille|strat|commercial|vente|sales|acquisition|business|brand|marque|pulse|nova|support/i,
  },
  developpeur: {
    label: 'Développeur',
    does: 'Code, sites, scripts, petites applis, automatisations, tests.',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch'],
    match: /d[ée]v|tech|ing[ée]nieur|engineer|cto|data|produit|product|it\b|informatique|e-commerce|ops|forge|devops|helix|vega|whm/i,
  },
  designer: {
    label: 'Designer',
    does: 'Pages et maquettes en HTML/CSS/SVG dans un seul fichier, pensées pour le téléphone.',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch'],
    match: /design|cr[ée]a|graph|ux|ui\b|brand|marque|direct(?:eur|rice) artistique|studio/i,
  },
  redacteur: {
    label: 'Rédacteur',
    does: 'Posts, e-mails, articles, scripts vidéo, rapports.',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
    match: /r[ée]dac|content|contenu|communication|com\b|social|copy|journal|marketing|community/i,
  },
  analyste: {
    label: 'Analyste',
    does: 'Tableaux comparatifs, calculs, fichiers de données.',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Calcul'],
    match: /analy|finance|data|contr[ôo]le|compta|pricing|tr[ée]sor|cfo|revenue|business/i,
  },
  renfort: {
    label: 'Renfort',
    does: 'Coup de main ponctuel hors des cinq métiers.',
    tools: ['Read', 'Write'],
    match: /./,
  },
}

export const CREW_ROLE_IDS = Object.keys(CREW_ROLES) as CrewRole[]

export interface CrewStep {
  id: string
  role: CrewRole
  title: string
  /** Mission écrite par le chef pour cet agent. */
  brief: string
  dependsOn: string[]
  /** Sujet précis (une marque, un concurrent…) pour les chercheurs. */
  target?: string
  /** Action sensible : l’agent lève la main avant d’agir. */
  approval?: string
  /** Connecteur utilisé (gmail, notion…). */
  via?: string
  /** Requêtes web proposées par le chef pour les chercheurs. */
  queries?: string[]
}

const FILLER = new Set(('je tu il elle on nous vous ils elles me moi mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs le la les un une des du de d l au aux en et ou a à dans pour par sur avec sans ce cet cette ces qui que quoi dont est sont veux voudrais veut aimerais lance lancer lancé analyse analyser analyses compare comparer fais faire fait obtenir obtiens trouve trouver donne donner prépare préparer construis construire crée créer rédige rédiger aide aider monte monter mission équipe agent agents concurrents concurrent marque marques prix site sites lancement tableau comparatif chaque tous toutes tout moins plus très bien puis ensuite aussi comme notamment nouveau nouvelle mon-').split(' '))

/** Sujet de la mission en quelques mots : « café grains ». */
export function topicOf(mission: string): string {
  return mission
    .split(/\bcomme\b|:|\bnotamment\b|\bdont\b|\bparmi\b/i)[0]!
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((word) => word.length > 2 && !FILLER.has(word) && !/^\d+$/.test(word))
    .slice(0, 4)
    .join(' ')
}

/** Requêtes WebSearch d’un chercheur : celles du chef, sinon cible + sujet. */
export function searchQueries(step: CrewStep, mission: string): string[] {
  if (step.queries?.length) return step.queries.slice(0, 3)
  const topic = topicOf(mission)
  if (step.target) return [`${step.target} ${topic} prix`.trim(), `${step.target} avis clients`]
  return [`${topic || topicOf(step.brief)} prix comparatif`, `${topic || topicOf(step.brief)} meilleures marques avis`]
}

export interface CrewPlan {
  summary: string
  steps: CrewStep[]
}

export const CREW_CONNECTORS: Array<{ provider: string; label: string; test: RegExp }> = [
  { provider: 'gmail', label: 'Gmail', test: /\bgmail\b|e-?mail|courriel|mail\b/i },
  { provider: 'google_drive', label: 'Google Drive', test: /\bdrive\b/i },
  { provider: 'notion', label: 'Notion', test: /\bnotion\b/i },
  { provider: 'google_calendar', label: 'Google Agenda', test: /agenda|calendar|calendrier/i },
  { provider: 'slack', label: 'Slack', test: /\bslack\b/i },
  { provider: 'github', label: 'GitHub', test: /\bgithub\b/i },
  { provider: 'stripe', label: 'Stripe', test: /\bstripe\b|paiement/i },
  { provider: 'hubspot', label: 'HubSpot', test: /\bhubspot\b|\bcrm\b/i },
  { provider: 'airtable', label: 'Airtable', test: /\bairtable\b/i },
  { provider: 'ztc_core', label: 'ZTC Hosting', test: /\bztc\b|portail (?:ztc|client)/i },
  { provider: 'whm', label: 'WHM / cPanel', test: /\bwhm\b|cpanel/i },
  { provider: 'fossbilling', label: 'FOSSBilling', test: /fossbilling|facture h[eé]berg/i },
  { provider: 'cloudflare', label: 'Cloudflare', test: /cloudflare|\bdns\b/i },
  { provider: 'resellerclub', label: 'ResellerClub', test: /resellerclub|registrar|enregistrer (?:un )?domaine/i },
  { provider: 'evolus', label: 'Evolus', test: /\bevolus\b/i },
]

export function connectorIn(text: string) {
  return CREW_CONNECTORS.find((item) => item.test.test(text)) ?? null
}

const SENSITIVE = /\b(envoie|envoyer|envoi|publie|publier|poste[rz]?|paie|payer|pr[ée]l[èe]ve|supprime|supprimer|efface|r[ée]serve|commande[rz]?|ach[èe]te)\b/i

/** Question posée à l’utilisateur si l’étape agit sur le monde réel. */
export function permissionFor(text: string): string | undefined {
  const verb = text.match(SENSITIVE)?.[1]
  if (!verb) return undefined
  const via = connectorIn(text)
  return `J’ai besoin de votre accord pour « ${verb} »${via ? ` via ${via.label}` : ''}. Je continue ?`
}

const NUMBER_WORDS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8 }

function slug(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'x'
}

/** Noms cités dans la mission : « … comme Lavazza, Malongo et Café Joyeux ». */
export function targetsIn(mission: string): string[] {
  const list = mission.match(/(?::|comme|notamment|dont|ex\.?|exemple\s*:?|parmi)\s+([^.;\n]+)/i)?.[1]
  if (!list) return []
  return list
    .split(/,|\bet\b|\bou\b|\//i)
    .map((item) => item.replace(/\(.*?\)/g, '').trim())
    .filter((item) => /^[A-ZÀ-Ý0-9]/.test(item) && item.length >= 2 && item.split(/\s+/).length <= 4)
    .slice(0, 8)
}

/** Nombre de cibles demandées : « analyser 5 concurrents ». */
export function countIn(mission: string): number {
  const match = mission.match(/\b(\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit)\s+(?:concurrents?|marques?|entreprises?|soci[ée]t[ée]s?|acteurs?|produits?|offres?|sites?|fournisseurs?|outils?|solutions?)/i)
  if (!match) return 0
  const raw = match[1]!.toLowerCase()
  return Math.min(8, Number(raw) || NUMBER_WORDS[raw] || 0)
}

/** Plan local si le modèle ne répond pas : mêmes métiers, mêmes dépendances. */
export function fallbackPlan(mission: string): CrewPlan {
  const ztc = ztcOpsPlan(mission)
  if (ztc) return ztc
  const steps: CrewStep[] = []
  const named = targetsIn(mission)
  const count = Math.max(named.length, countIn(mission))
  const subject = mission.replace(/\s+/g, ' ').trim()
  const researchers = count || (/recherch|concurr|march[ée]|veille|prix|avis|compar|benchmark/i.test(mission) ? 1 : 0)
  for (let index = 0; index < researchers; index += 1) {
    const target = named[index]
    steps.push({
      id: `r${index + 1}-${slug(target ?? String(index + 1))}`,
      role: 'chercheur',
      title: target ? `Recherche · ${target}` : researchers > 1 ? `Recherche · acteur n°${index + 1}` : 'Recherche',
      target,
      brief: target
        ? `Analyse ${target} pour cette mission : « ${subject} ». Rends : (1) les offres et références principales avec prix TTC actuels, (2) où elles se vendent, (3) le positionnement et la promesse, (4) points forts / faibles d’après les avis clients, (5) offres et abonnements. Cite l’URL source de chaque chiffre.`
        : researchers > 1
          ? `Identifie l’acteur n°${index + 1} le plus pertinent pour : « ${subject} » (différent des autres chercheurs), puis relève ses prix, offres, avis et positionnement, chaque chiffre avec sa source.`
          : `Fais la recherche de fond pour : « ${subject} ». Prix, offres, avis, chiffres clés, chaque chiffre avec sa date et sa source.`,
      dependsOn: [],
    })
  }
  const research = steps.map((step) => step.id)
  const wantsTable = researchers > 1 || /compar|tableau|prix|chiffr|analys|benchmark|calcul/i.test(mission)
  if (wantsTable) {
    steps.push({
      id: 'analyse',
      role: 'analyste',
      title: 'Tableau comparatif',
      brief: `Mets tous les chiffres des chercheurs dans un tableau comparatif (prix ramenés à une même unité, médianes), puis recommande un positionnement prix pour : « ${subject} ». N’invente aucun chiffre.`,
      dependsOn: research,
    })
  }
  const before = wantsTable ? ['analyse'] : research
  if (/site|landing|page|maquette|vitrine|boutique en ligne/i.test(mission)) {
    steps.push({
      id: 'design',
      role: 'designer',
      title: 'Site de lancement',
      brief: `Construis le site de lancement mobile (un seul fichier HTML) pour : « ${subject} ». Utilise exactement les prix recommandés par l’analyste et les arguments relevés par les chercheurs.`,
      dependsOn: before,
    })
  }
  if (/\b(code|script|appli|application|automatis|outil interne|api)\b/i.test(mission)) {
    steps.push({ id: 'dev', role: 'developpeur', title: 'Développement', brief: `Écris le code demandé pour : « ${subject} ».`, dependsOn: before })
  }
  if (/post|e-?mail|newsletter|article|script vid[ée]o|communiqu|texte|r[ée]dige/i.test(mission)) {
    const approval = permissionFor(mission)
    const via = connectorIn(mission)?.provider
    steps.push({ id: 'texte', role: 'redacteur', title: 'Rédaction', brief: `Rédige les textes demandés pour : « ${subject} », appuyés sur les rapports de l’équipe.`, dependsOn: before, approval, via })
  }
  if (!steps.length) {
    steps.push({ id: 'renfort', role: 'renfort', title: 'Mission', brief: subject, dependsOn: [] })
  }
  return {
    summary: `${steps.length} agent${steps.length > 1 ? 's' : ''} : ${[...new Set(steps.map((step) => CREW_ROLES[step.role].label.toLowerCase()))].join(', ')}.`,
    steps,
  }
}

function ztcOpsPlan(mission: string): CrewPlan | null {
  if (!/\bztc\b|ztchosting|cpanel|\bwhm\b|fossbilling|ticket support|mon site est lent|auto ?ssl|starter hosting|n8n|openclaw|scan|vuln|faille|hsts|csp|rapidit|ttfb|vitesse|\blent\b|publicit|visuel|campagne|flux|vid[eé]o|clip|trafic|traffic|seo|landing|\/order|banni[eè]re|accroche|marketing/i.test(mission)) return null
  const subject = mission.replace(/\s+/g, ' ').trim()
  const via = connectorIn(mission)?.provider
  if (/rapidit|perf|ttfb|vitesse|\blent\b/i.test(subject)) {
    return {
      summary: 'Swift mesure le TTFB réel, puis diagnostic et runbook — aucune écriture.',
      steps: [
        { id: 'r-speed', role: 'chercheur', title: 'Mesure Swift', target: 'ZTC Hosting', brief: `Mesure TTFB et HTTP de ztchosting.com, /order, /login, guest API et DEVOID /health pour : « ${subject} ». Chiffres observés seulement.`, dependsOn: [], queries: ['ztchosting.com', 'ztchosting.com/order'] },
        { id: 'analyse', role: 'analyste', title: 'Diagnostic performance', brief: `À partir des TTFB mesurés : goulot, pages lentes, ce qui reste à confirmer. Pas de SLA inventé. Mission : « ${subject} ».`, dependsOn: ['r-speed'] },
        { id: 'runbook', role: 'redacteur', title: 'Runbook Swift', brief: `Runbook R0 pour : « ${subject} ». Seuils observés, prochaines mesures, rien à changer en production.`, dependsOn: ['analyse'], approval: permissionFor(mission), via },
      ],
    }
  }
  if (/vuln|cve|faille|hardening|csp|hsts/i.test(subject)) {
    return {
      summary: 'Aegis lit la surface publique et liste les écarts de durcissement — aucun exploit.',
      steps: [
        { id: 'r-vuln', role: 'chercheur', title: 'Surface Aegis', target: 'ZTC Hosting', brief: `Relevé des en-têtes publics (HSTS, CSP, X-Content-Type, Referrer-Policy) de ztchosting.com pour : « ${subject} ». Aucun PoC, aucun scan agressif.`, dependsOn: [], queries: ['ztchosting.com security headers', 'ztchosting.com HSTS'] },
        { id: 'analyse', role: 'analyste', title: 'Écarts de durcissement', brief: `Classe les en-têtes manquants vs présents. Risque descriptif seulement. Mission : « ${subject} ».`, dependsOn: ['r-vuln'] },
        { id: 'runbook', role: 'redacteur', title: 'Runbook Aegis', brief: `Checklist R0 de durcissement pour : « ${subject} ». Recommandations, aucune commande d’attaque.`, dependsOn: ['analyse'], approval: permissionFor(mission), via },
      ],
    }
  }
  if (/scan|en-t[eê]te|header|surface/i.test(subject)) {
    return {
      summary: 'Radar scanne la surface publique de ztchosting.com — lecture seule.',
      steps: [
        { id: 'r-scan', role: 'chercheur', title: 'Scan Radar', target: 'ZTC Hosting', brief: `Scan public : statut HTTP, serveur annoncé, en-têtes TLS de ztchosting.com pour : « ${subject} ».`, dependsOn: [], queries: ['ztchosting.com', 'ztchosting.com/login'] },
        { id: 'analyse', role: 'analyste', title: 'Lecture de surface', brief: `Synthèse du scan Radar. Pas d’invention. Mission : « ${subject} ».`, dependsOn: ['r-scan'] },
        { id: 'runbook', role: 'redacteur', title: 'Runbook Radar', brief: `Compte-rendu R0 pour : « ${subject} ». Preuves, écarts, suite humaine.`, dependsOn: ['analyse'], approval: permissionFor(mission), via },
      ],
    }
  }
  if (/vid[eé]o|clip|promo video|film|motion|reel/i.test(subject)) {
    return {
      summary: 'Clip produit une vidéo promo à partir des SKU live — aucun SLA inventé.',
      steps: [
        { id: 'r-boutique', role: 'chercheur', title: 'SKU live', target: 'ZTC Hosting', brief: `Relève le catalogue FOSSBilling live pour : « ${subject} ». Prix et coming soon uniquement tels qu’observés.`, dependsOn: [], queries: ['ztchosting.com/order hosting', 'ZTC Hosting Business price'] },
        { id: 'story', role: 'redacteur', title: 'Storyboard Muse', brief: `Storyboard et accroches pour la vidéo. Prix = catalogue live. Mission : « ${subject} ».`, dependsOn: ['r-boutique'] },
        { id: 'film', role: 'designer', title: 'Vidéo Clip', brief: `Produis le clip / vidéo promo haute qualité. Affiche exactement le prix observé. Mission : « ${subject} ».`, dependsOn: ['story'], approval: permissionFor(mission), via },
      ],
    }
  }
  if (/funnel|flux (?:de )?visiteurs?|prospects?|rapport (?:visite|trafic|funnel)|conversion (?:site|visite)/i.test(subject)) {
    return {
      summary: 'Funnel analyse le flux visiteurs ztchosting.com, qualifie les prospects et produit un rapport — faits observés seulement.',
      steps: [
        { id: 'r-hits', role: 'chercheur', title: 'Collecte flux', target: 'ZTC Hosting', brief: `Relève les hits / sessions / pages (accueil, /order, /login) pour : « ${subject} ». Aucun volume inventé.`, dependsOn: [], queries: ['ztchosting.com analytics', 'ztchosting.com/order'] },
        { id: 'qualify', role: 'analyste', title: 'Prospects Funnel', brief: `Qualifie les sessions chaudes en prospects (score, intérêt, pages). Mission : « ${subject} ».`, dependsOn: ['r-hits'] },
        { id: 'report', role: 'redacteur', title: 'Rapport détaillé', brief: `Rédige le rapport Funnel (sessions, top pages, sources, prospects, taux). Faits observés uniquement. Mission : « ${subject} ».`, dependsOn: ['qualify'], approval: permissionFor(mission), via },
      ],
    }
  }
  if (/trafic|traffic|acquisition|seo|landing|croissance trafic/i.test(subject)) {
    return {
      summary: 'Boost planifie l’augmentation de trafic vers ztchosting.com / /order — mesure avant promesse.',
      steps: [
        { id: 'r-boutique', role: 'chercheur', title: 'Parcours & catalogue', target: 'ZTC Hosting', brief: `Cartographie accueil → /order et SKU live pour : « ${subject} ».`, dependsOn: [], queries: ['ztchosting.com', 'ztchosting.com/order'] },
        { id: 'plan', role: 'analyste', title: 'Plan trafic Boost', brief: `Plan SEO / landing / campagnes. Pas de volume inventé. Mission : « ${subject} ».`, dependsOn: ['r-boutique'] },
        { id: 'copy', role: 'redacteur', title: 'Copy Muse', brief: `Accroches et briefs landing pour le plan trafic. Prix live uniquement. Mission : « ${subject} ».`, dependsOn: ['plan'], approval: permissionFor(mission), via },
      ],
    }
  }
  if (/pub|visuel|campagne|image|flux|publicit|banni[eè]re|copy|accroche/i.test(subject)) {
    return {
      summary: 'Marketing ZTC : Muse (copy) + Flare (images) à partir des SKU live — aucun prix inventé.',
      steps: [
        { id: 'r-boutique', role: 'chercheur', title: 'SKU live', target: 'ZTC Hosting', brief: `Relève le catalogue FOSSBilling live pour : « ${subject} ». Prix et coming soon uniquement tels qu’observés.`, dependsOn: [], queries: ['ztchosting.com/order hosting', 'ZTC Hosting Business price'] },
        { id: 'copy', role: 'redacteur', title: 'Copy Muse', brief: `Accroches et légendes campagne. Prix = catalogue live. Pas de SLA inventé. Mission : « ${subject} ».`, dependsOn: ['r-boutique'] },
        { id: 'crea', role: 'designer', title: 'Visuel Flare', brief: `Crée le visuel / image marketing haute qualité pour le SKU live. Affiche exactement le prix observé. Mission : « ${subject} ».`, dependsOn: ['copy'], approval: permissionFor(mission), via },
      ],
    }
  }
  return {
    summary: 'Équipe ZTC : preuve publique, diagnostic borné, runbook — aucune écriture sans accord.',
    steps: [
      {
        id: 'r-boutique',
        role: 'chercheur',
        title: 'Preuve boutique ZTC',
        target: 'ZTC Hosting',
        brief: `Lis ztchosting.com et ztchosting.com/order pour : « ${subject} ». Relevés : plans, prix affichés, VPS coming soon, SKU IA. Chaque chiffre avec URL. Qualifie observé / à confirmer.`,
        dependsOn: [],
        queries: ['ZTC Hosting plans pricing site:ztchosting.com', 'ztchosting.com/order hosting'],
      },
      {
        id: 'analyse',
        role: 'analyste',
        title: 'Diagnostic borné',
        brief: `À partir des preuves : qui (Nova/Devoid/Funnel/Vega/Lyra/Echo/Ledger/Helix/Radar/Aegis/Swift/Flare/Clip/Boost/Muse) prend le dossier, anneau R0–R4, systèmes (FOSSBilling, WHM, Cloudflare). N’invente aucun état live. Mission : « ${subject} ».`,
        dependsOn: ['r-boutique'],
      },
      {
        id: 'runbook',
        role: 'redacteur',
        title: 'Runbook support',
        brief: `Rédige le runbook R0/R1 pour : « ${subject} ». Étapes, preuves demandées, ce qui reste bloqué sans API métier. Aucun envoi client.`,
        dependsOn: ['analyse'],
        approval: permissionFor(mission),
        via,
      },
    ],
  }
}

function roleOf(value: unknown): CrewRole | null {
  const text = String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/cherch|research|veille/.test(text)) return 'chercheur'
  if (/dev|code|ingen/.test(text)) return 'developpeur'
  if (/design|graph|maquette/.test(text)) return 'designer'
  if (/redac|writer|copy|texte/.test(text)) return 'redacteur'
  if (/analy|data|calcul/.test(text)) return 'analyste'
  if (/renfort|aide|help|autre/.test(text)) return 'renfort'
  return null
}

/** Lit le plan JSON du modèle ; renvoie null s’il est inutilisable. */
export function planFromModel(raw: string, mission: string): CrewPlan | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return null
  let body: { summary?: unknown; steps?: unknown }
  try {
    body = JSON.parse(json) as typeof body
  } catch {
    return null
  }
  if (!Array.isArray(body.steps) || !body.steps.length) return null
  const steps: CrewStep[] = []
  const ids = new Set<string>()
  for (const item of body.steps.slice(0, 10) as Array<Record<string, unknown>>) {
    const role = roleOf(item.role)
    const brief = String(item.brief ?? item.mission ?? '').trim()
    if (!role || brief.length < 8) continue
    let id = slug(String(item.id ?? item.title ?? role))
    while (ids.has(id)) id = `${id}-${steps.length + 1}`
    ids.add(id)
    const target = typeof item.target === 'string' && item.target.trim() ? item.target.trim().slice(0, 60) : undefined
    steps.push({
      id,
      role,
      title: String(item.title ?? CREW_ROLES[role].label).slice(0, 70),
      brief: brief.slice(0, 900),
      target,
      dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn.map((dep) => slug(String(dep))) : [],
      approval: permissionFor(brief),
      via: connectorIn(brief)?.provider,
      queries: Array.isArray(item.queries) ? item.queries.map(String).filter((q) => q.trim().length > 2).slice(0, 3) : undefined,
    })
  }
  if (!steps.length) return null
  const known = new Set(steps.map((step) => step.id))
  const research = steps.filter((step) => step.role === 'chercheur').map((step) => step.id)
  for (const step of steps) {
    step.dependsOn = step.dependsOn.filter((dep) => known.has(dep) && dep !== step.id)
    // Garde-fou : la synthèse attend toujours les chercheurs.
    if (step.role !== 'chercheur' && !step.dependsOn.length && research.length) step.dependsOn = research
  }
  if (!acyclic(steps)) for (const step of steps) step.dependsOn = step.role === 'chercheur' ? [] : research.filter((id) => id !== step.id)
  const summary = typeof body.summary === 'string' && body.summary.trim() ? body.summary.trim().slice(0, 240) : fallbackPlan(mission).summary
  return { summary, steps }
}

function acyclic(steps: CrewStep[]) {
  const byId = new Map(steps.map((step) => [step.id, step]))
  const state = new Map<string, 1 | 2>()
  const visit = (id: string): boolean => {
    if (state.get(id) === 2) return true
    if (state.get(id) === 1) return false
    state.set(id, 1)
    for (const dep of byId.get(id)?.dependsOn ?? []) if (!visit(dep)) return false
    state.set(id, 2)
    return true
  }
  return steps.every((step) => visit(step.id))
}

export const CREW_PLAN_PROMPT = `Tu es ATLAS, le chef d’une équipe d’agents IA. Tu ne fais pas le gros du travail : tu fais le plan et tu délègues.
Métiers disponibles :
- chercheur : recherches web (un chercheur par concurrent / sujet, ils travaillent en parallèle), sites officiels d’abord, chaque chiffre avec date et source
- analyste : tableaux comparatifs, calculs, recommandations chiffrées
- designer : page ou site mobile en un seul fichier HTML/CSS
- redacteur : posts, e-mails, articles, scripts vidéo, rapports
- developpeur : code, scripts, automatisations
- renfort : coup de main hors de ces métiers
Règles : un chercheur par cible nommée ; l’analyste dépend des chercheurs ; le designer et le rédacteur dépendent de l’analyste s’il existe. 2 à 9 étapes.
Chaque "brief" est la mission que tu écris pour l’agent : précise, numérotée, avec ce qu’il doit rendre. Rappelle « n’invente aucun chiffre ».
Réponds UNIQUEMENT en JSON :
Pour chaque chercheur, ajoute "queries" : 2 requêtes web courtes (marque + produit + prix, marque + avis).
{"summary":"une phrase","steps":[{"id":"r1","role":"chercheur","title":"Recherche · Lavazza","target":"Lavazza","queries":["Lavazza café en grains prix","Lavazza café grains avis"],"brief":"…","dependsOn":[]}]}`

export interface CrewMember {
  id: string
  name: string
  role: string
  department?: string
}

/** Confie chaque étape à l’employé du bureau dont le poste est le plus proche du métier. */
export function assignCrew(steps: CrewStep[], members: CrewMember[]): Record<string, string | null> {
  const load = new Map<string, number>(members.map((member) => [member.id, 0]))
  const result: Record<string, string | null> = {}
  for (const step of steps) {
    if (!members.length) {
      result[step.id] = null
      continue
    }
    const fit = members.filter((member) => CREW_ROLES[step.role].match.test(`${member.role} ${member.department ?? ''}`))
    const pool = fit.length ? fit : members
    const chosen = [...pool].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))[0]!
    load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1)
    result[step.id] = chosen.id
  }
  return result
}

/** Étapes prêtes : toutes leurs dépendances sont terminées (ou écartées). */
export function readySteps(steps: CrewStep[], finished: Set<string>, started: Set<string>): CrewStep[] {
  return steps.filter((step) => !started.has(step.id) && step.dependsOn.every((dep) => finished.has(dep)))
}

export interface PriceHit {
  value: number
  raw: string
  /** Quelques mots avant le prix : « 1 kg », « 250 g »… */
  context: string
}

/** Prix en euros / francs repérés dans un texte ou une page HTML. */
export function pricesIn(text: string): PriceHit[] {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ')
  const hits: PriceHit[] = []
  const pattern = /(?:(?:CHF|€)\s?(\d{1,4}(?:[.,]\d{1,2})?))|(?:(\d{1,4}(?:[.,]\d{1,2})?)\s?(?:€|EUR\b|CHF\b|euros?\b))/gi
  for (const match of plain.matchAll(pattern)) {
    const raw = match[1] ?? match[2] ?? ''
    const value = Number(raw.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) continue
    const start = Math.max(0, (match.index ?? 0) - 40)
    hits.push({ value, raw: match[0].trim(), context: plain.slice(start, match.index ?? 0).trim() })
  }
  return hits
}

export function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 100) / 100
}

/** Prix ramené au kilo quand le poids est indiqué juste avant (250 g, 1 kg…). */
export function perKilo(hit: PriceHit): number | null {
  const weight = hit.context.match(/(\d+(?:[.,]\d+)?)\s?(kg|g)\b(?!.*\d+(?:[.,]\d+)?\s?(?:kg|g)\b)/i)
  if (!weight) return null
  const amount = Number(weight[1]!.replace(',', '.'))
  const grams = weight[2]!.toLowerCase() === 'kg' ? amount * 1000 : amount
  if (!grams || grams < 50 || grams > 5000) return null
  return Math.round((hit.value / grams) * 1000 * 100) / 100
}

export interface Recommendation {
  label: string
  value: number
}

export interface Mismatch {
  label: string
  expected: number
  found: number | null
}

const money = (value: number) => value.toFixed(2).replace('.', ',')

/** Le chef compare les prix recommandés par l’analyste à ceux affichés par le site. */
export function priceMismatches(recommendations: Recommendation[], html: string): Mismatch[] {
  if (!recommendations.length || !html) return []
  const close = (a: number, b: number) => Math.abs(a - b) < 0.005
  const shown = pricesIn(html).map((hit) => hit.value)
  const missing = recommendations.filter((rec) => !shown.some((value) => close(value, rec.value)))
  const strays = [...new Set(shown.filter((value) => !recommendations.some((rec) => close(rec.value, value))))]
  return missing.map((rec, index) => ({ label: rec.label, expected: rec.value, found: strays[index] ?? null }))
}

/** Aligne le site sur les chiffres de l’analyste (le chef corrige tout seul). */
export function alignPrices(html: string, mismatches: Mismatch[]): string {
  let next = html
  for (const item of mismatches) {
    if (item.found === null) continue
    const variants = [money(item.found), item.found.toFixed(2), String(item.found)]
    for (const variant of [...new Set(variants)]) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`(^|[^\\d,.])${escaped}(?=\\s?(?:€|EUR|CHF|euros?))`, 'g')
      if (pattern.test(next)) {
        next = next.replace(pattern, `$1${money(item.expected)}`)
        break
      }
    }
  }
  return next
}

/** Estimation des jetons consommés (≈ 4 caractères par jeton). */
export function tokensOf(...texts: string[]) {
  return Math.round(texts.reduce((sum, text) => sum + text.length, 0) / 4)
}
