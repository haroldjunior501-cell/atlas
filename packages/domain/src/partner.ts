/** ATLAS life-partner capability map — org studio remains available as a mode. */

export type PartnerDomain =
  | 'desktop'
  | 'research'
  | 'personal'
  | 'memory'
  | 'tutor'
  | 'coding'
  | 'create'
  | 'studio'

export type ResearchMode =
  | 'general'
  | 'compare'
  | 'company'
  | 'training'
  | 'job'
  | 'internship'
  | 'product'
  | 'event'
  | 'ticket'
  | 'hotel'
  | 'website'

export type MemoryCategory =
  | 'preference'
  | 'habit'
  | 'project'
  | 'goal'
  | 'professional'
  | 'academic'
  | 'procedure'
  | 'decision'
  | 'fact'

export interface PersonalMemoryFact {
  id: string
  category: MemoryCategory
  key: string
  value: string
  updatedAt: string
}

export interface PartnerCapability {
  id: string
  domain: PartnerDomain
  label: string
  examples: string[]
}

export const PARTNER_CAPABILITIES: PartnerCapability[] = [
  // Desktop / productivity
  { id: 'open_app', domain: 'desktop', label: 'Ouvrir une application', examples: ['ouvre Word', 'lance Chrome'] },
  { id: 'find_file', domain: 'desktop', label: 'Rechercher un fichier', examples: ['cherche mon CV sur le bureau'] },
  { id: 'read_doc', domain: 'desktop', label: 'Lire un document', examples: ['lis ce PDF'] },
  { id: 'organize_files', domain: 'desktop', label: 'Organiser des fichiers', examples: ['classe mes téléchargements'] },
  { id: 'analyze_pdf', domain: 'desktop', label: 'Analyser un PDF', examples: ['résume ce PDF'] },
  { id: 'write_doc', domain: 'desktop', label: 'Rédiger un document', examples: ['rédige une lettre de motivation'] },
  { id: 'create_deck', domain: 'desktop', label: 'Créer une présentation', examples: ['crée une présentation pitch'] },
  { id: 'analyze_excel', domain: 'desktop', label: 'Analyser un tableau Excel', examples: ['analyse ce fichier Excel'] },
  // Research
  { id: 'web_search', domain: 'research', label: 'Rechercher une information', examples: ['cherche les tendances IA 2026'] },
  { id: 'compare_sources', domain: 'research', label: 'Comparer plusieurs sources', examples: ['compare ces deux articles'] },
  { id: 'research_company', domain: 'research', label: 'Rechercher une entreprise', examples: ['qui est Nebius ?'] },
  { id: 'research_training', domain: 'research', label: 'Rechercher une formation', examples: ['formations data science Paris'] },
  { id: 'research_job', domain: 'research', label: 'Rechercher une offre d’emploi', examples: ['offres développeur React'] },
  { id: 'research_internship', domain: 'research', label: 'Rechercher une alternance', examples: ['alternance marketing digital'] },
  { id: 'compare_products', domain: 'research', label: 'Comparer des produits', examples: ['compare iPhone et Pixel'] },
  { id: 'find_events', domain: 'research', label: 'Trouver des événements', examples: ['événements tech ce week-end'] },
  { id: 'find_tickets', domain: 'research', label: 'Rechercher des billets', examples: ['billets train Paris Lyon'] },
  { id: 'find_hotels', domain: 'research', label: 'Rechercher des hôtels', examples: ['hôtels centre Lyon'] },
  { id: 'analyze_site', domain: 'research', label: 'Analyser un site web', examples: ['analyse ce site'] },
  // Personal
  { id: 'email', domain: 'personal', label: 'Email (lire, résumer, rédiger, classer)', examples: ['lis mes mails', 'réponds au dernier'] },
  { id: 'calendar', domain: 'personal', label: 'Calendrier', examples: ['crée un rendez-vous demain 14h'] },
  { id: 'tasks', domain: 'personal', label: 'Tâches personnelles', examples: ['crée une tâche : appeler le notaire'] },
  // Memory
  { id: 'remember', domain: 'memory', label: 'Se souvenir', examples: ['retiens que je préfère le tutoiement'] },
  { id: 'recall', domain: 'memory', label: 'Consulter la mémoire', examples: ['que sais-tu de moi ?'] },
  { id: 'forget', domain: 'memory', label: 'Oublier', examples: ['oublie mon ancien numéro'] },
  { id: 'correct_memory', domain: 'memory', label: 'Corriger une information', examples: ['non, mon prénom s’écrit Harold'] },
  // Tutor
  { id: 'explain', domain: 'tutor', label: 'Expliquer un concept', examples: ['explique-moi les promesses JS'] },
  { id: 'exercises', domain: 'tutor', label: 'Créer / corriger des exercices', examples: ['crée un quiz sur React'] },
  { id: 'learning_path', domain: 'tutor', label: 'Programme d’apprentissage', examples: ['programme pour apprendre Python'] },
  { id: 'interview_sim', domain: 'tutor', label: 'Simuler un entretien', examples: ['simule un entretien frontend'] },
  // Coding
  { id: 'code_explain', domain: 'coding', label: 'Expliquer du code', examples: ['explique cette fonction'] },
  { id: 'code_generate', domain: 'coding', label: 'Générer du code', examples: ['génère un hook React'] },
  { id: 'code_fix', domain: 'coding', label: 'Corriger / refactoriser', examples: ['corrige cette erreur TypeScript'] },
  { id: 'code_ops', domain: 'coding', label: 'Git, Docker, APIs, logs, déploiement', examples: ['explique cette erreur terminal'] },
  // Create
  { id: 'create_content', domain: 'create', label: 'Générer contenus', examples: ['rédige un post LinkedIn', 'fais un rapport'] },
  // Studio (org)
  { id: 'org_studio', domain: 'studio', label: 'Studio organisation (équipe IA)', examples: ['monte une équipe marketing'] },
]

export function researchModeOf(query: string): ResearchMode {
  const q = query.toLowerCase()
  if (/alternance|apprentissage\b|contrat pro/.test(q)) return 'internship'
  if (/offre d['’]?emploi|job|recrut|poste de |candidature/.test(q)) return 'job'
  if (/formation|bootcamp|cours en ligne|mooc|master |licence /.test(q)) return 'training'
  if (/h[oô]tel|airbnb|h[eé]bergement|booking/.test(q)) return 'hotel'
  if (/billet|train|avion|vol |sncf|flight|ticket/.test(q)) return 'ticket'
  if (/[eé]v[eé]nement|concert|salon |meetup|conf[eé]rence/.test(q)) return 'event'
  if (/compare|vs\b|versus|diff[eé]rence entre|lequel choisir/.test(q)) return 'compare'
  if (/entreprise|soci[eé]t[eé]|startup|compagnie|qui est /.test(q)) return 'company'
  if (/produit|meilleur .+ pour|avis sur /.test(q)) return 'product'
  if (/https?:\/\/|site web|analyse (?:ce |le )?site/.test(q)) return 'website'
  return 'general'
}

export function memoryCategoryOf(text: string): MemoryCategory {
  const q = text.toLowerCase()
  if (/pr[eé]f[eè]re|aimer|d[eé]teste|tutoiement|vouvoiement/.test(q)) return 'preference'
  if (/habitude|chaque matin|toujours|jamais/.test(q)) return 'habit'
  if (/projet|en train de|je travaille sur/.test(q)) return 'project'
  if (/objectif|but |je veux |ambition/.test(q)) return 'goal'
  if (/travail|entreprise|poste|m[eé]tier|pro\b/.test(q)) return 'professional'
  if (/[eé]tude|fac|universit[eé]|examen|cours/.test(q)) return 'academic'
  if (/proc[eé]dure|quand je |comment je fais/.test(q)) return 'procedure'
  if (/d[eé]cid[eé]|on a choisi|dor[eé]navant/.test(q)) return 'decision'
  return 'fact'
}
