import type { SkillKind } from './skills'

export type Place =
  | 'home'
  | 'library'
  | 'study'
  | 'projects'
  | 'plugins'
  | 'agenda'
  | 'files'
  | 'settings'
  | 'help'

export type PlaceRoom = {
  id: string
  title: string
  hint: string
  color: string
  tone: [string, string]
  tags: string[]
  mark: RoomMark
  skill: SkillKind
  seed: string
  card?: string
}

export type RoomMark =
  | 'book'
  | 'page'
  | 'sheet'
  | 'quiz'
  | 'target'
  | 'folder'
  | 'code'
  | 'scan'
  | 'clock'
  | 'plugin'
  | 'gear'
  | 'help'
  | 'idea'
  | 'chart'
  | 'paint'
  | 'radar'

export type PlaceHub = {
  title: string
  intro: string
  variant?: 'cards' | 'list'
  rooms: PlaceRoom[]
}

export const PLACE_HUBS: Record<Exclude<Place, 'home'>, PlaceHub> = {
  library: {
    title: 'Bibliothèque',
    intro: 'Images, rapports, documents, factures et créations ATLAS / agents — tout y est rangé automatiquement.',
    rooms: [],
  },
  study: {
    title: 'Organisation',
    intro: 'ZtcHosting et ses employés IA : entre, discute, délègue, demande un rapport.',
    rooms: [],
  },
  projects: {
    title: 'Projets',
    intro: 'Un espace pour construire, avec Atlas comme copilote.',
    rooms: [
      { id: 'ideas', title: 'Génération d’idées', hint: 'Brainstorm, angles, concepts à tester.', color: '#f59e0b', tone: ['#d97706', '#f59e0b'], tags: ['Idées', 'Concepts', 'Pistes'], mark: 'idea', skill: 'plan', seed: 'Tu aides à générer des idées de projet : originales, concrètes, classées. Propose plusieurs pistes et comment les tester.', card: 'Idées' },
      { id: 'code', title: 'Aide à la programmation', hint: 'Écrire, expliquer, corriger du code.', color: '#3b82f6', tone: ['#1d4ed8', '#2563eb'], tags: ['Code', 'Debug', 'Projet'], mark: 'code', skill: 'code', seed: 'Tu es un ingénieur. Écris, explique ou corrige le code jusqu’au bout. Fichiers clairs, pas de code tronqué sans le dire.', card: 'Code' },
      { id: 'docs', title: 'Création de documents', hint: 'Cahier, rapport, présentation.', color: '#8b5cf6', tone: ['#6d28d9', '#7c3aed'], tags: ['Docs', 'Rapport', 'Slides'], mark: 'page', skill: 'document', seed: 'Rédige le document demandé : structure, titres, contenu utilisable. Complet.', card: 'Document' },
      { id: 'data', title: 'Analyse de données', hint: 'Tableaux, chiffres, insights.', color: '#f97316', tone: ['#ea580c', '#f97316'], tags: ['Data', 'Graphiques', 'Insights'], mark: 'chart', skill: 'document', seed: 'Analyse les données : lis les chiffres, explique, donne des insights et la suite à faire.', card: 'Analyse' },
      { id: 'design', title: 'Design et maquettes', hint: 'UI, wireframes, direction visuelle.', color: '#22c55e', tone: ['#16a34a', '#22c55e'], tags: ['UI', 'Maquettes', 'Style'], mark: 'paint', skill: 'plan', seed: 'Propose un design ou une maquette : structure d’écran, hiérarchie, couleurs, composants. Concret.', card: 'Maquette' },
      { id: 'strategy', title: 'Plan d’action et stratégie', hint: 'Objectifs, étapes, priorités.', color: '#14b8a6', tone: ['#0f766e', '#14b8a6'], tags: ['Stratégie', 'Plan', 'Priorités'], mark: 'radar', skill: 'plan', seed: 'Construis un plan d’action : objectif, étapes, priorités, risques, premières actions. Complet.', card: 'Plan' },
    ],
  },
  plugins: {
    title: 'Plugins',
    intro: 'Les applications du Studio ATLAS : Gmail, Drive, GitHub, Notion…',
    rooms: [],
  },
  agenda: {
    title: 'Agenda',
    intro: 'La journée, les rappels, les priorités.',
    rooms: [
      { id: 'today', title: 'Priorités du jour', hint: 'Quoi faire maintenant.', color: '#3b82f6', tone: ['#1d4ed8', '#2563eb'], tags: ['Jour', 'Priorités', 'Ordre'], mark: 'clock', skill: 'day', seed: 'Organise la journée : priorités, ordre, ce qui peut attendre. Sois concret.' },
      { id: 'tasks', title: 'Tâches', hint: 'Ajouter, cocher, préciser.', color: '#14b8a6', tone: ['#0f766e', '#14b8a6'], tags: ['Tâches', 'Liste', 'Suivi'], mark: 'sheet', skill: 'day', seed: 'Gère les tâches : ajoute, classe, rappelle l’essentiel.' },
      { id: 'remind', title: 'Rappels', hint: 'Ne rien oublier.', color: '#f97316', tone: ['#c2410c', '#ea580c'], tags: ['Rappel', 'Horaire', 'Alerte'], mark: 'clock', skill: 'day', seed: 'Crée ou reformule un rappel clair, avec le moment s’il est dit.' },
      { id: 'week', title: 'Semaine', hint: 'Vue plus large.', color: '#8b5cf6', tone: ['#6d28d9', '#7c3aed'], tags: ['Semaine', 'Plan', 'Rythme'], mark: 'clock', skill: 'day', seed: 'Propose un plan de la semaine à partir de ce que dit l’élève ou de ses tâches.' },
    ],
  },
  files: {
    title: 'Fichiers',
    intro: 'N’importe quel format, Atlas lit et explique.',
    rooms: [
      { id: 'import', title: 'Importer', hint: 'PDF, photo, code, n’importe quelle taille.', color: '#3b82f6', tone: ['#1d4ed8', '#2563eb'], tags: ['Import', 'PDF', 'Tout format'], mark: 'folder', skill: 'document', seed: 'Analyse le fichier importé : contenu, points clés, que faire ensuite. Complet.' },
      { id: 'photos', title: 'Photos', hint: 'Caméra ou galerie.', color: '#14b8a6', tone: ['#0f766e', '#14b8a6'], tags: ['Photo', 'Caméra', 'Galerie'], mark: 'scan', skill: 'scan', seed: 'Lis et explique cette photo jusqu’au bout.' },
      { id: 'docs', title: 'Documents', hint: 'Texte, PDF, notes.', color: '#8b5cf6', tone: ['#6d28d9', '#7c3aed'], tags: ['Texte', 'PDF', 'Notes'], mark: 'page', skill: 'document', seed: 'Travaille sur ce document : résumé, corrections, questions. Réponse complète.' },
    ],
  },
  settings: {
    title: 'Paramètres',
    intro: 'Compte, voix, appareil — Atlas t’aide à régler.',
    rooms: [
      { id: 'account', title: 'Compte', hint: 'Nom, organisation, session.', color: '#3b82f6', tone: ['#1d4ed8', '#2563eb'], tags: ['Compte', 'Session', 'Org'], mark: 'gear', skill: 'document', seed: 'Aide sur le compte ATLAS. Le visage, la voix et les fichiers restent sur l’appareil.' },
      { id: 'voice', title: 'Voix et visage', hint: 'Louise, lip-sync, légendes.', color: '#8b5cf6', tone: ['#6d28d9', '#7c3aed'], tags: ['Louise', 'Visage', 'Légendes'], mark: 'plugin', skill: 'voice', seed: 'Explique ou ajuste la voix Louise, le visage et les légendes qui suivent la parole.' },
      { id: 'privacy', title: 'Confidentialité', hint: 'Ce qui reste sur l’iPad.', color: '#14b8a6', tone: ['#0f766e', '#14b8a6'], tags: ['Local', 'Studio', 'Cloud'], mark: 'help', skill: 'document', seed: 'Explique clairement ce qui reste local et ce qui passe par le Studio ou le cloud.' },
    ],
  },
  help: {
    title: 'Aide',
    intro: 'Comment Atlas pilote toute l’application.',
    rooms: [
      { id: 'guide', title: 'Guide', hint: 'Les sections et ce qu’elles font.', color: '#3b82f6', tone: ['#1d4ed8', '#2563eb'], tags: ['Guide', 'Sections', 'Atlas'], mark: 'help', skill: 'document', seed: 'Explique l’app ATLAS mobile : accueil (parler à ATLAS), Organisation (équipe, déléguer, briefing, flux ZTC), bibliothèque, projets, plugins, agenda, fichiers. Le dirigeant coordonne ZtcHosting en mobilité.' },
      { id: 'ask', title: 'Demander à Atlas', hint: 'Une question sur l’app.', color: '#8b5cf6', tone: ['#6d28d9', '#7c3aed'], tags: ['Question', 'Aide', 'Navigation'], mark: 'quiz', skill: 'document', seed: 'Réponds à la question sur ATLAS. Si l’utilisateur veut une section, oriente-le.' },
    ],
  },
}

export function hubFor(place: Place): PlaceHub | null {
  if (place === 'home') return null
  return PLACE_HUBS[place]
}

export function roomOf(place: Place, roomId: string | null | undefined): PlaceRoom | null {
  if (!roomId) return null
  return hubFor(place)?.rooms.find((room) => room.id === roomId) ?? null
}

export function chatKey(place: Place, roomId: string) {
  return `${place}:${roomId}`
}

/** Ouvre une section seulement si l’utilisateur le demande clairement. */
/**
 * Ordres destinés au Studio web / PC / site ZtcHosting —
 * ne doivent PAS basculer vers une section mobile (ex. Organisation).
 */
export function isStudioOrPcOrder(text: string) {
  const heard = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/(bureau\s*3d|jumeau|plein\s*ecran|fullscreen|organigramme|studio\s*(web|atlas)?)/.test(heard)) return true
  if (/(ouvre|affiche|montre|va |passe ).{0,28}(factur|mission|employ|integration|observ|reunion|approbation|connaissance|template|tutoriel|compte)\b/.test(heard)) return true
  if (/(ouvre|lance|affiche|montre).{0,40}(site|ztchosting|boutique|espace client|navigateur)/.test(heard)) return true
  if (/sur (le |l')?(pc|ordinateur)|dans (le )?navigateur|chrome|edge/.test(heard)) return true
  return false
}

export function routeFromOrder(text: string): { place: Place; room?: string } | null {
  if (isStudioOrPcOrder(text)) return null
  const heard = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // « présente / explique mon organisation » = conversation Atlas, pas navigation
  if (/(presente|presenter|parle[- ]moi|explique|decrit|resume|c'?est quoi).{0,40}(organisation|equipe|ztc|ztchosting)/.test(heard)
    || /(organisation|ztchosting|equipe).{0,20}(c'?est quoi|qui (?:est|sont))/.test(heard)) {
    return null
  }
  const go = /ouvr|va dans|vas dans|aller dans|emmene|ramene|montre[- ]moi|lance |section|espace /.test(heard)
  const named =
    /(bibliotheque|organisation|bureau|equipe|delegu|brief|ztc|produit|etudes?|projets?|plugins?|agenda|fichiers?|parametres?|aide|accueil)/.test(
      heard,
    )
  if (!go && !/^ouvre\b/.test(heard)) {
    if (!named) return null
    if (!/\b(ouvre|va |vas |aller|montre|lance|section)\b/.test(heard)) return null
  }

  if (/\baccueil\b|\bhome\b|ecran principal/.test(heard)) return { place: 'home' }
  if (/bibliotheque/.test(heard)) return { place: 'library' }
  if (/plugin|integration|connecter|applications?/.test(heard)) {
    return { place: 'plugins' }
  }
  if (/projet/.test(heard)) {
    if (/idee|brainstorm/.test(heard)) return { place: 'projects', room: 'ideas' }
    if (/program|code|debug/.test(heard)) return { place: 'projects', room: 'code' }
    if (/document|rapport|slides/.test(heard)) return { place: 'projects', room: 'docs' }
    if (/donnee|data|chiffre/.test(heard)) return { place: 'projects', room: 'data' }
    if (/design|maquette|ui/.test(heard)) return { place: 'projects', room: 'design' }
    if (/strategie|plan d.action/.test(heard)) return { place: 'projects', room: 'strategy' }
    return { place: 'projects' }
  }
  if (/agenda|taches?|rappel/.test(heard) && !/organisation|delegu|mission/.test(heard)) {
    if (/rappel/.test(heard)) return { place: 'agenda', room: 'remind' }
    if (/tache/.test(heard)) return { place: 'agenda', room: 'tasks' }
    if (/semaine/.test(heard)) return { place: 'agenda', room: 'week' }
    return { place: 'agenda' }
  }
  if (/fichiers?/.test(heard) && !/bibliotheque/.test(heard)) return { place: 'files' }
  if (/parametre/.test(heard)) return { place: 'settings' }
  if (/\baide\b/.test(heard)) return { place: 'help' }
  if (/organisation|equipe|delegu|briefing|flux produit|mission d['’]equipe|parle a (?:un )?agent/.test(heard)
    && !/site|navigateur|boutique|studio|3d|plein|presente|explique|decrit|resume/.test(heard)) {
    return { place: 'study' }
  }
  if (/\brapport\b/.test(heard) && /(?:agent|nova|swift|flare|ledger|demande|confie)/.test(heard)) {
    return { place: 'study' }
  }
  return null
}

export function isNavOnly(text: string) {
  return /^(ouvre|va|vas|aller|montre|lance|emmene|ramene)\b.{0,48}$/i.test(text.trim())
}

export function atlasFrame(place: Place, room: PlaceRoom | null, _userText: string, name?: string, pluginLabel?: string) {
  const hub = hubFor(place)
  const who = name ? `L’utilisateur s’appelle ${name}.` : ''
  const where = hub
    ? `Tu es Atlas. Section : ${hub.title}${pluginLabel ? ` / ${pluginLabel}` : room ? ` / ${room.title}` : ''}.`
    : 'Tu es Atlas, sur l’écran d’accueil.'
  const job = pluginLabel
    ? `Tu pilotes l’application ${pluginLabel} via le Studio. Si elle n’est pas reliée, dis-le clairement.`
    : room?.seed || 'Réponds clairement et exécute. Tu pilotes le Studio web (bureau 3D, plein écran, sections) et le PC (apps, navigateur). Pour ZtcHosting : « ouvre le site », « ouvre la boutique », « ouvre l’espace client ». Sections mobiles : Organisation, Projets, Plugins, Agenda, Fichiers, Bibliothèque.'
  return [who, where, job].filter(Boolean).join(' ')
}
