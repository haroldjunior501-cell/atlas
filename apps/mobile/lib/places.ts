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
    intro: 'Le stockage d’ATLAS : tout ce que tu importes ailleurs, et ce qu’Atlas génère.',
    rooms: [],
  },
  study: {
    title: 'Études',
    intro: 'Un espace pour apprendre, avec Atlas comme prof.',
    rooms: [
      { id: 'explain', title: 'Cours et explications', hint: 'Envoie ton cours, ATLAS te l’explique clairement.', color: '#3b82f6', tone: ['#1d4ed8', '#2563eb'], tags: ['Cours', 'Explications', 'Exemples'], mark: 'book', skill: 'lesson', seed: 'Tu es un professeur exigeant et clair. L’élève t’envoie son cours. Explique tout le raisonnement, avec exemples. Ne t’arrête pas au milieu. Pose une question pour vérifier. Tu peux ouvrir une autre section si on te le demande.', card: 'Explication' },
      { id: 'exercises', title: 'Exercices et corrections', hint: 'Un énoncé, une correction pas à pas.', color: '#14b8a6', tone: ['#0f766e', '#14b8a6'], tags: ['Exercices', 'Méthodes', 'Corrections'], mark: 'page', skill: 'lesson', seed: 'Corrige l’exercice comme un professeur : méthode, étapes, calculs, réponse finale, puis erreurs fréquentes. Ne coupe pas la correction.', card: 'Correction' },
      { id: 'summaries', title: 'Résumés automatiques', hint: 'L’essentiel d’un cours, en une fiche.', color: '#8b5cf6', tone: ['#6d28d9', '#7c3aed'], tags: ['Synthèse', 'Fiche', 'Points clés'], mark: 'page', skill: 'document', seed: 'Fais un résumé complet du cours : idées clés, définitions, formules, ce qu’il faut retenir. Structure claire, rien d’important oublié.', card: 'Résumé' },
      { id: 'sheets', title: 'Fiches de révision', hint: 'Fiches courtes à relire avant un devoir.', color: '#f97316', tone: ['#c2410c', '#ea580c'], tags: ['Fiches', 'Notions', 'Révisions'], mark: 'sheet', skill: 'lesson', seed: 'Transforme le cours en fiche de révision complète : notions, formules, pièges, mini-exemples. Termine la fiche.', card: 'Fiche' },
      { id: 'quiz', title: 'Quiz et évaluations', hint: 'Questions pour tester ce que tu sais.', color: '#f43f5e', tone: ['#be123c', '#e11d48'], tags: ['Quiz', 'QCM', 'Examens'], mark: 'quiz', skill: 'lesson', seed: 'Interroge l’élève. Une question claire, puis attends. Quand il répond, corrige en expliquant vraiment pourquoi.', card: 'Quiz' },
      { id: 'goal', title: 'Un objectif d’étude', hint: 'Dis à ATLAS ce que tu veux apprendre et il te crée un plan personnalisé.', color: '#22d3ee', tone: ['#0e7490', '#0891b2'], tags: ['Objectif', 'Plan', 'Progression'], mark: 'target', skill: 'plan', seed: 'L’élève te dit un objectif d’étude. Crée un plan personnalisé : étapes, durée, méthode, premières actions. Complet, pas un slogan.', card: 'Plan' },
    ],
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
      { id: 'voice', title: 'Voix et visage', hint: 'Pascal, lip-sync, légendes.', color: '#8b5cf6', tone: ['#6d28d9', '#7c3aed'], tags: ['Pascal', 'Visage', 'Légendes'], mark: 'plugin', skill: 'voice', seed: 'Explique ou ajuste la voix Pascal, le visage et les légendes qui suivent la parole.' },
      { id: 'privacy', title: 'Confidentialité', hint: 'Ce qui reste sur l’iPad.', color: '#14b8a6', tone: ['#0f766e', '#14b8a6'], tags: ['Local', 'Studio', 'Cloud'], mark: 'help', skill: 'document', seed: 'Explique clairement ce qui reste local et ce qui passe par le Studio ou le cloud.' },
    ],
  },
  help: {
    title: 'Aide',
    intro: 'Comment Atlas pilote toute l’application.',
    rooms: [
      { id: 'guide', title: 'Guide', hint: 'Les sections et ce qu’elles font.', color: '#3b82f6', tone: ['#1d4ed8', '#2563eb'], tags: ['Guide', 'Sections', 'Atlas'], mark: 'help', skill: 'document', seed: 'Explique l’app ATLAS : accueil, bibliothèque (images, vidéos, docs, images générées), études, projets, plugins, agenda, fichiers. Atlas lit les documents et explique les vidéos. Atlas peut ouvrir n’importe quelle section si on le demande.' },
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
export function routeFromOrder(text: string): { place: Place; room?: string } | null {
  const heard = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const go = /ouvr|va dans|vas dans|aller dans|emmene|ramene|montre[- ]moi|lance |section|espace /.test(heard)
  const named =
    /(bibliotheque|etudes?|cours|exercices?|resume|fiches?|quiz|projets?|plugins?|agenda|fichiers?|parametres?|aide|accueil)/.test(
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
  if (/agenda|taches?|rappel/.test(heard) && !/etude/.test(heard)) {
    if (/rappel/.test(heard)) return { place: 'agenda', room: 'remind' }
    if (/tache/.test(heard)) return { place: 'agenda', room: 'tasks' }
    if (/semaine/.test(heard)) return { place: 'agenda', room: 'week' }
    return { place: 'agenda' }
  }
  if (/fichiers?/.test(heard) && !/bibliotheque/.test(heard)) return { place: 'files' }
  if (/parametre/.test(heard)) return { place: 'settings' }
  if (/\baide\b/.test(heard)) return { place: 'help' }
  if (/etude|cours|exercice|fiche de revision|quiz|qcm/.test(heard)) {
    if (/exercice/.test(heard)) return { place: 'study', room: 'exercises' }
    if (/resume/.test(heard)) return { place: 'study', room: 'summaries' }
    if (/fiche/.test(heard)) return { place: 'study', room: 'sheets' }
    if (/quiz|qcm|evaluation/.test(heard)) return { place: 'study', room: 'quiz' }
    if (/cours|expli/.test(heard)) return { place: 'study', room: 'explain' }
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
    : room?.seed || 'Réponds clairement. Tu peux ouvrir Études, Projets, Plugins, Agenda, Fichiers, Bibliothèque, Paramètres ou Aide si on te le demande.'
  return [who, where, job].filter(Boolean).join(' ')
}
