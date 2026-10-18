/**
 * Archétypes d’environnement : ATLAS ne repeint pas un bureau standard,
 * il choisit la typologie d’espaces qui correspond au métier de l’entreprise.
 */

export type OfficeArchetype =
  | 'corporate'
  | 'car_dealership'
  | 'marketing_agency'
  | 'restaurant'
  | 'clinic'
  | 'logistics'
  | 'retail'
  | 'tech'
  | 'real_estate'
  | 'manufacturing'
  | 'hosting'

/** Zones métier (en plus de la grammaire bureau classique). */
export type ArchetypeSpaceKind =
  | 'showroom'
  | 'workshop'
  | 'parts_store'
  | 'service_desk'
  | 'parking'
  | 'delivery_bay'
  | 'creative_studio'
  | 'photo_studio'
  | 'pitch_room'
  | 'kitchen_pro'
  | 'dining_room'
  | 'terrace'
  | 'cold_room'
  | 'waiting_room'
  | 'exam_room'
  | 'lab'
  | 'pharmacy'
  | 'warehouse'
  | 'loading_dock'
  | 'packing_area'
  | 'truck_yard'
  | 'sales_floor'
  | 'checkout'
  | 'stockroom'
  | 'fitting_rooms'
  | 'server_room'
  | 'war_room'
  | 'listing_wall'
  | 'production_line'
  | 'quality_lab'

export interface ArchetypeTheme {
  accent: string
  floor: string
  ground: string
  wall: string
  corridor: string
}

export interface ArchetypeZone {
  key: string
  name: string
  kind: string
}

export interface ArchetypeSpec {
  id: OfficeArchetype
  label: string
  tagline: string
  theme: ArchetypeTheme
  /** Département → zone métier, testé sur « nom du département + rôles ». */
  rules: Array<{ test: RegExp; kind: string }>
  /** Zones toujours présentes (équipements sans agent si aucun département ne les occupe). */
  signature: ArchetypeZone[]
  /** Espaces communs. */
  commons: ArchetypeZone[]
}

const BASE_THEME = { floor: '#f5f5f3', ground: '#e7e9ec', wall: '#ffffff', corridor: '#ecebe7' }

export const ARCHETYPES: Record<OfficeArchetype, ArchetypeSpec> = {
  car_dealership: {
    id: 'car_dealership',
    label: 'Concession automobile',
    tagline: 'Showroom, atelier, pièces et parking',
    theme: { ...BASE_THEME, accent: '#dc2626' },
    rules: [
      { test: /accueil|r[eé]ception|service client|support|relation client|rendez/i, kind: 'service_desk' },
      { test: /atelier|m[eé]cani|carross|technici|apr[eè]s[- ]vente|apv|maintenance|r[eé]paration|diagnos/i, kind: 'workshop' },
      { test: /pi[eè]ce|magasin|stock|approvision|logisti/i, kind: 'parts_store' },
      { test: /vente|commercial|sales|conseiller|showroom|financement|leasing/i, kind: 'showroom' },
      { test: /livraison|pr[eé]paration v[eé]hicule|esth[eé]tique/i, kind: 'delivery_bay' },
    ],
    signature: [
      { key: 'reception', name: 'Réception atelier', kind: 'service_desk' },
      { key: 'showroom', name: 'Showroom', kind: 'showroom' },
      { key: 'workshop', name: 'Atelier', kind: 'workshop' },
      { key: 'parts', name: 'Magasin pièces', kind: 'parts_store' },
      { key: 'delivery', name: 'Livraison', kind: 'delivery_bay' },
      { key: 'parking', name: 'Parking clients', kind: 'parking' },
    ],
    commons: [
      { key: 'cafe', name: 'Espace café', kind: 'kitchen' },
    ],
  },
  marketing_agency: {
    id: 'marketing_agency',
    label: 'Agence marketing',
    tagline: 'Studio créa, shooting, pitch et social hub',
    theme: { ...BASE_THEME, accent: '#db2777' },
    rules: [
      { test: /cr[eé]a|design|graphi|direction artistique|motion|vid[eé]o|r[eé]dac|contenu|copy|production/i, kind: 'creative_studio' },
      { test: /photo|shooting|studio/i, kind: 'photo_studio' },
      { test: /social|communaut|influence|m[eé]dia|ads|acquisition|seo|sea|growth|perf/i, kind: 'war_room' },
      { test: /client|account|commercial|vente|new business|strat[eé]g|planning/i, kind: 'pitch_room' },
    ],
    signature: [
      { key: 'lobby', name: 'Accueil agence', kind: 'reception' },
      { key: 'studio', name: 'Studio créa', kind: 'creative_studio' },
      { key: 'shoot', name: 'Studio photo', kind: 'photo_studio' },
      { key: 'pitch', name: 'Salle de pitch', kind: 'pitch_room' },
      { key: 'social', name: 'Social hub', kind: 'war_room' },
    ],
    commons: [
      { key: 'lounge', name: 'Lounge', kind: 'lounge' },
      { key: 'kitchen', name: 'Cuisine', kind: 'kitchen' },
      { key: 'booth', name: 'Cabine', kind: 'phone_booth' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    tagline: 'Cuisine, salle, bar, terrasse et réserve',
    theme: { ...BASE_THEME, accent: '#ea580c', floor: '#f6f1ea' },
    rules: [
      { test: /cuisin|chef|commis|p[aâ]tiss|boulang|plonge|production/i, kind: 'kitchen_pro' },
      { test: /salle|service|serveu|sommeli|bar|accueil|h[oô]te/i, kind: 'dining_room' },
      { test: /stock|achat|approvision|r[eé]serve|logisti/i, kind: 'cold_room' },
      { test: /livraison|delivery|emporter/i, kind: 'delivery_bay' },
    ],
    signature: [
      { key: 'dining', name: 'Salle', kind: 'dining_room' },
      { key: 'kitchen', name: 'Cuisine', kind: 'kitchen_pro' },
      { key: 'cold', name: 'Chambre froide', kind: 'cold_room' },
      { key: 'terrace', name: 'Terrasse', kind: 'terrace' },
      { key: 'delivery', name: 'Retrait & livraison', kind: 'delivery_bay' },
    ],
    commons: [],
  },
  clinic: {
    id: 'clinic',
    label: 'Clinique',
    tagline: 'Accueil, salle d’attente, consultations, laboratoire',
    theme: { ...BASE_THEME, accent: '#0891b2', floor: '#f3f7f8' },
    rules: [
      { test: /m[eé]dec|docteur|soin|infirm|consult|praticien|th[eé]rap|dent|kin[eé]|patient|clini/i, kind: 'exam_room' },
      { test: /labo|analyse|biolog|radio|imagerie/i, kind: 'lab' },
      { test: /pharma|stock|mat[eé]riel/i, kind: 'pharmacy' },
      { test: /accueil|secr[eé]ta|rendez|admission|r[eé]ception/i, kind: 'waiting_room' },
    ],
    signature: [
      { key: 'waiting', name: 'Accueil & attente', kind: 'waiting_room' },
      { key: 'exam', name: 'Consultations', kind: 'exam_room' },
      { key: 'lab', name: 'Laboratoire', kind: 'lab' },
      { key: 'pharmacy', name: 'Pharmacie', kind: 'pharmacy' },
      { key: 'parking', name: 'Parking & ambulances', kind: 'parking' },
    ],
    commons: [
      { key: 'staff', name: 'Salle du personnel', kind: 'kitchen' },
    ],
  },
  logistics: {
    id: 'logistics',
    label: 'Logistique',
    tagline: 'Entrepôt, préparation, quais et flotte',
    theme: { ...BASE_THEME, accent: '#d97706', floor: '#f1f1ef' },
    rules: [
      { test: /entrep[oô]t|stock|magasin|inventaire|cariste/i, kind: 'warehouse' },
      { test: /pr[eé]para|emball|picking|colis|fulfil|exp[eé]dition|e-?commerce|commande/i, kind: 'packing_area' },
      { test: /transport|livr|chauffeur|flotte|tourn[eé]e|quai|r[eé]ception/i, kind: 'loading_dock' },
    ],
    signature: [
      { key: 'warehouse', name: 'Entrepôt', kind: 'warehouse' },
      { key: 'packing', name: 'Préparation', kind: 'packing_area' },
      { key: 'dock', name: 'Quais', kind: 'loading_dock' },
      { key: 'yard', name: 'Cour camions', kind: 'truck_yard' },
    ],
    commons: [
      { key: 'cafe', name: 'Cafétéria', kind: 'cafeteria' },
    ],
  },
  retail: {
    id: 'retail',
    label: 'Commerce',
    tagline: 'Surface de vente, caisses, cabines et réserve',
    theme: { ...BASE_THEME, accent: '#7c3aed' },
    rules: [
      { test: /vente|vendeu|conseill|boutique|magasin|merchandis|visuel/i, kind: 'sales_floor' },
      { test: /caisse|encaiss|accueil|service client|sav/i, kind: 'checkout' },
      { test: /stock|r[eé]assort|logisti|r[eé]ception|achat|approvision|e-?commerce|exp[eé]dition/i, kind: 'stockroom' },
    ],
    signature: [
      { key: 'floor', name: 'Surface de vente', kind: 'sales_floor' },
      { key: 'checkout', name: 'Caisses', kind: 'checkout' },
      { key: 'fitting', name: 'Cabines', kind: 'fitting_rooms' },
      { key: 'stock', name: 'Réserve', kind: 'stockroom' },
      { key: 'parking', name: 'Parking', kind: 'parking' },
    ],
    commons: [
      { key: 'staff', name: 'Salle du personnel', kind: 'kitchen' },
    ],
  },
  tech: {
    id: 'tech',
    label: 'Startup tech',
    tagline: 'Open space produit, salle serveurs, war room',
    theme: { ...BASE_THEME, accent: '#2563eb' },
    rules: [
      { test: /d[eé]v|ing[eé]n|tech|produit|cto|data|ia\b|ml|backend|frontend|mobile|qa|design/i, kind: 'open_space' },
      { test: /infra|devops|s[eé]curit|syst[eè]me|r[eé]seau|cloud/i, kind: 'server_room' },
      { test: /support|succ[eè]s|ops|incident/i, kind: 'war_room' },
    ],
    signature: [
      { key: 'lobby', name: 'Accueil', kind: 'reception' },
      { key: 'servers', name: 'Salle serveurs', kind: 'server_room' },
      { key: 'war', name: 'War room', kind: 'war_room' },
      { key: 'meeting', name: 'Salle de réunion', kind: 'meeting_medium' },
    ],
    commons: [
      { key: 'lounge', name: 'Lounge', kind: 'lounge' },
      { key: 'kitchen', name: 'Cuisine', kind: 'kitchen' },
      { key: 'booth', name: 'Cabine', kind: 'phone_booth' },
      { key: 'focus', name: 'Focus', kind: 'focus_room' },
    ],
  },
  real_estate: {
    id: 'real_estate',
    label: 'Agence immobilière',
    tagline: 'Vitrine des biens, bureaux conseillers, signature',
    theme: { ...BASE_THEME, accent: '#059669' },
    rules: [
      { test: /n[eé]goci|agent|conseill|vente|transaction|location|commercial/i, kind: 'listing_wall' },
      { test: /g[eé]rance|syndic|gestion locative|administr/i, kind: 'cubicle' },
    ],
    signature: [
      { key: 'vitrine', name: 'Vitrine des biens', kind: 'listing_wall' },
      { key: 'signature', name: 'Salle de signature', kind: 'meeting_medium' },
      { key: 'parking', name: 'Parking visites', kind: 'parking' },
    ],
    commons: [
      { key: 'kitchen', name: 'Cuisine', kind: 'kitchen' },
    ],
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Site industriel',
    tagline: 'Ligne de production, contrôle qualité, stock, quais',
    theme: { ...BASE_THEME, accent: '#ca8a04', floor: '#efefec' },
    rules: [
      { test: /production|fabric|op[eé]rateur|usin|assembl|atelier|maintenance|m[eé]thode/i, kind: 'production_line' },
      { test: /qualit|contr[oô]le|labo|m[eé]trolog/i, kind: 'quality_lab' },
      { test: /stock|logisti|magasin|approvision|achat|exp[eé]dition/i, kind: 'warehouse' },
    ],
    signature: [
      { key: 'line', name: 'Ligne de production', kind: 'production_line' },
      { key: 'quality', name: 'Contrôle qualité', kind: 'quality_lab' },
      { key: 'warehouse', name: 'Stock', kind: 'warehouse' },
      { key: 'dock', name: 'Quais', kind: 'loading_dock' },
      { key: 'yard', name: 'Cour camions', kind: 'truck_yard' },
    ],
    commons: [
      { key: 'cafe', name: 'Réfectoire', kind: 'cafeteria' },
    ],
  },
  hosting: {
    id: 'hosting',
    label: 'Hébergeur cloud',
    tagline: 'Support, NOC, hébergement, domaines, facturation, SKU IA',
    theme: { ...BASE_THEME, accent: '#0ea5e9' },
    rules: [
      { test: /accueil|support|succ[eè]s|ticket|nova|relation client/i, kind: 'service_desk' },
      { test: /sre|noc|orion|incident|surveillance|op[eé]ration/i, kind: 'war_room' },
      { test: /h[eé]berg|whm|cpanel|vega|serveur|infra/i, kind: 'server_room' },
      { test: /domaine|dns|lyra|ssl|certificat/i, kind: 'project_room' },
      { test: /mail|messag|echo|d[eé]livrabilit/i, kind: 'cubicle' },
      { test: /vps|proxmox|openstack|helix|cloud|llm|gpu/i, kind: 'server_room' },
      { test: /s[eé]curit|soc|cipher|grc|conform|radar|aegis|scan|vuln/i, kind: 'lab' },
      { test: /factur|billing|ledger|finance|fossbilling/i, kind: 'private_office' },
      { test: /devops|forge|release|ansible|n8n|openclaw/i, kind: 'open_space' },
      { test: /growth|pulse|produit/i, kind: 'project_room' },
      { test: /marketing|flare|clip|boost|muse|pub|trafic|vid[eé]o|cr[eé]a|campagne/i, kind: 'creative_studio' },
      { test: /swift|perf|ttfb|rapidit/i, kind: 'war_room' },
    ],
    signature: [
      { key: 'support', name: 'Accueil & support', kind: 'service_desk' },
      { key: 'noc', name: 'Salle des opérations', kind: 'war_room' },
      { key: 'hosting', name: 'Réseau & hébergement', kind: 'server_room' },
      { key: 'soc', name: 'Salle de sécurité', kind: 'lab' },
      { key: 'studio', name: 'Studio marketing', kind: 'creative_studio' },
      { key: 'meeting', name: 'Salle de réunion', kind: 'meeting_medium' },
    ],
    commons: [
      { key: 'kitchen', name: 'Salle du personnel', kind: 'kitchen' },
    ],
  },
  corporate: {
    id: 'corporate',
    label: 'Bureaux',
    tagline: 'Bureaux, open spaces, réunions et espaces communs',
    theme: { ...BASE_THEME, accent: '#4f46e5' },
    rules: [],
    signature: [
      { key: 'lobby', name: 'Accueil', kind: 'lobby' },
    ],
    commons: [
      { key: 'lounge', name: 'Salon', kind: 'lounge' },
      { key: 'cafe', name: 'Cafétéria', kind: 'cafeteria' },
      { key: 'kitchen', name: 'Cuisine', kind: 'kitchen' },
    ],
  },
}

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as OfficeArchetype[]

export interface ArchetypeSignal {
  name?: string
  sector?: string
  businessModel?: string
  intention?: string
  departments?: string[]
  roles?: string[]
}

const SIGNALS: Array<{ id: OfficeArchetype; test: RegExp }> = [
  { id: 'car_dealership', test: /concession|automobile|\bauto\b|voiture|v[eé]hicule|garage|carrosserie|moto|occasion|showroom/i },
  { id: 'marketing_agency', test: /marketing|agence (de )?(com|pub|cr[eé]a|digital|marketing)|communication|publicit|branding|social media|influence|\bagence\b/i },
  { id: 'restaurant', test: /restaurant|resto|brasserie|bistro|caf[eé]|boulanger|p[aâ]tisser|traiteur|pizz|food|cuisine|gastronom|h[oô]tel/i },
  { id: 'clinic', test: /clinique|sant[eé]|m[eé]dical|cabinet m[eé]d|dentaire|dentiste|kin[eé]|physio|h[oô]pital|patient|soins|v[eé]t[eé]rinaire/i },
  { id: 'logistics', test: /logistique|transport|livraison|entrep[oô]t|fret|supply|exp[eé]dition|fulfil|coursier|d[eé]m[eé]nage/i },
  { id: 'retail', test: /boutique|magasin|commerce|retail|v[eê]tement|\bmode\b|pr[eê]t-[aà]-porter|cosm[eé]tique|[eé]picerie|concept store|e-?commerce/i },
  { id: 'hosting', test: /h[eé]berg|hosting|\bztc\b|datacent|cpanel|\bwhm\b|fossbilling|mutualis|nom de domaine|\bvps\b|resellerclub/i },
  { id: 'tech', test: /saas|logiciel|startup|tech|software|application|\bapp\b|plateforme|marketplace|\bia\b|intelligence artificielle|jeu vid[eé]o|cloud|cyber|d[eé]veloppement web/i },
  { id: 'real_estate', test: /immobili|r[eé]gie|agence immo|location d.appart|promoteur|courtier immo/i },
  { id: 'manufacturing', test: /usine|industri|fabrication|manufactur|production de|atelier de production|m[eé]tallurg|plasturg|horlog|menuiserie/i },
]

const MODEL_HINT: Record<string, Array<[OfficeArchetype, number]>> = {
  saas: [['tech', 3]],
  jeu: [['tech', 3]],
  marketplace: [['tech', 2.5]],
  agence: [['marketing_agency', 2.5]],
  ecommerce: [['logistics', 2.6], ['retail', 2.4]],
  clinique: [['clinic', 3]],
  immobilier: [['real_estate', 3.2]],
  freelance: [['corporate', 2]],
}

/** Détermine l’environnement à partir de ce que l’utilisateur a demandé. */
export function detectArchetype(signal: ArchetypeSignal): OfficeArchetype {
  const score = new Map<OfficeArchetype, number>()
  const add = (id: OfficeArchetype, value: number) => score.set(id, (score.get(id) ?? 0) + value)
  const weigh = (text: string | undefined, weight: number) => {
    if (!text) return
    for (const signalRule of SIGNALS) if (signalRule.test.test(text)) add(signalRule.id, weight)
  }
  weigh(signal.sector, 3)
  weigh(signal.intention, 3)
  weigh(signal.name, 2)
  for (const dept of signal.departments ?? []) weigh(dept, 1)
  for (const role of signal.roles ?? []) weigh(role, 0.34)
  for (const [id, value] of MODEL_HINT[(signal.businessModel ?? '').toLowerCase()] ?? []) add(id, value)
  // Une agence immobilière n’est pas une agence marketing.
  if ((score.get('real_estate') ?? 0) > 0) score.set('marketing_agency', Math.max(0, (score.get('marketing_agency') ?? 0) - 2.5))
  if ((score.get('hosting') ?? 0) > 0) score.set('tech', Math.max(0, (score.get('tech') ?? 0) - 2.8))
  let best: OfficeArchetype = 'corporate'
  let top = 1.9
  for (const [id, value] of score) {
    if (value > top) {
      best = id
      top = value
    }
  }
  return best
}

/** Zone métier d’un département dans l’archétype, ou null pour un bureau classique. */
export function zoneForDepartment(archetype: OfficeArchetype, deptName: string, roles: string[]): string | null {
  const spec = ARCHETYPES[archetype]
  const byName = spec.rules.find((rule) => rule.test.test(deptName))
  if (byName) return byName.kind
  const haystack = roles.join(' ')
  const votes = new Map<string, number>()
  for (const rule of spec.rules) {
    const hits = roles.filter((role) => rule.test.test(role)).length
    if (hits) votes.set(rule.kind, hits)
  }
  if (!haystack || votes.size === 0) return null
  let best: string | null = null
  let count = 0
  for (const [kind, hits] of votes) {
    if (hits > count) {
      best = kind
      count = hits
    }
  }
  return count * 2 >= roles.length ? best : null
}

/** Organisation exemple par archétype — pour la démo sans organisation créée. */
export function sampleOrganization(archetype: OfficeArchetype): {
  name: string
  sector: string
  departments: Array<{ id: string; name: string; agents: Array<{ id: string; firstName: string; lastName: string; role: string; status?: 'online' | 'working' | 'idle' }> }>
} {
  const people = (prefix: string, rows: Array<[string, string, string, ('online' | 'working' | 'idle')?]>) =>
    rows.map(([firstName, lastName, role, status], index) => ({ id: `${prefix}-${index}`, firstName, lastName, role, status: status ?? 'working' }))
  switch (archetype) {
    case 'car_dealership':
      return {
        name: 'Garage du Léman SA',
        sector: 'Concession automobile',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Claire', 'Favre', 'Directrice de site']]) },
          { id: 'ventes', name: 'Ventes', agents: people('ve', [['Julien', 'Rochat', 'Conseiller vente'], ['Sarah', 'Meier', 'Conseillère vente', 'idle'], ['Luca', 'Bernasconi', 'Financement & leasing']]) },
          { id: 'atelier', name: 'Atelier', agents: people('at', [['Nuno', 'Silva', 'Mécanicien'], ['Kevin', 'Keller', 'Mécanicien'], ['Marc', 'Huber', 'Carrossier'], ['Ali', 'Demir', 'Diagnosticien'], ['Tom', 'Weber', 'Mécanicien', 'idle']]) },
          { id: 'pieces', name: 'Magasin pièces', agents: people('pi', [['Paolo', 'Ricci', 'Magasinier']]) },
          { id: 'accueil', name: 'Réception atelier', agents: people('ac', [['Emma', 'Schmid', 'Réceptionnaire après-vente']]) },
        ],
      }
    case 'marketing_agency':
      return {
        name: 'Studio Lavaux',
        sector: 'Agence marketing',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Inès', 'Bernard', 'Directrice d’agence']]) },
          { id: 'crea', name: 'Création', agents: people('cr', [['Noah', 'Petit', 'Directeur artistique'], ['Léa', 'Martin', 'Graphiste'], ['Sacha', 'Klein', 'Motion designer'], ['Hugo', 'Roux', 'Rédacteur']]) },
          { id: 'social', name: 'Social media', agents: people('so', [['Mila', 'Favre', 'Community manager'], ['Yanis', 'Ali', 'Media buyer', 'idle']]) },
          { id: 'clients', name: 'Clientèle', agents: people('cl', [['Thomas', 'Moreau', 'Account manager'], ['Zoé', 'Girard', 'Stratège']]) },
        ],
      }
    case 'restaurant':
      return {
        name: 'Brasserie du Port',
        sector: 'Restaurant',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Marco', 'Rossi', 'Gérant']]) },
          { id: 'cuisine', name: 'Cuisine', agents: people('cu', [['Élodie', 'Blanc', 'Cheffe'], ['Samir', 'Haddad', 'Second'], ['Lucas', 'Perret', 'Commis'], ['Anna', 'Vogel', 'Pâtissière']]) },
          { id: 'salle', name: 'Salle', agents: people('sa', [['Chloé', 'Morel', 'Maître d’hôtel'], ['Diego', 'Lopez', 'Serveur'], ['Lina', 'Keller', 'Serveuse', 'idle'], ['Max', 'Durand', 'Barman']]) },
          { id: 'achats', name: 'Achats & stock', agents: people('ac', [['Paul', 'Monnier', 'Économe']]) },
        ],
      }
    case 'clinic':
      return {
        name: 'Clinique des Alpes',
        sector: 'Santé',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Hélène', 'Aubert', 'Directrice médicale']]) },
          { id: 'med', name: 'Médecins', agents: people('me', [['Dr Paul', 'Meyer', 'Médecin généraliste'], ['Dr Sara', 'Costa', 'Cardiologue'], ['Dr Ivan', 'Novak', 'Pédiatre', 'idle']]) },
          { id: 'soins', name: 'Soins', agents: people('so', [['Julie', 'Roy', 'Infirmière'], ['Omar', 'Benali', 'Infirmier']]) },
          { id: 'labo', name: 'Laboratoire', agents: people('la', [['Nina', 'Schär', 'Biologiste']]) },
          { id: 'accueil', name: 'Accueil', agents: people('ac', [['Laura', 'Gerber', 'Secrétaire médicale']]) },
        ],
      }
    case 'logistics':
      return {
        name: 'Rhône Logistique SA',
        sector: 'Logistique',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Pierre', 'Fontana', 'Directeur des opérations']]) },
          { id: 'entrepot', name: 'Entrepôt', agents: people('en', [['Rui', 'Santos', 'Cariste'], ['Kim', 'Nguyen', 'Gestionnaire de stock'], ['Bruno', 'Lehmann', 'Cariste', 'idle']]) },
          { id: 'prep', name: 'Préparation', agents: people('pr', [['Aline', 'Jaquet', 'Préparatrice'], ['Mehdi', 'Saidi', 'Préparateur'], ['Eva', 'Brunner', 'Emballage']]) },
          { id: 'transport', name: 'Transport', agents: people('tr', [['Hans', 'Frei', 'Chef de quai'], ['Fabio', 'Conti', 'Planificateur tournées']]) },
        ],
      }
    case 'retail':
      return {
        name: 'Maison Cervin',
        sector: 'Mode',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Camille', 'Roth', 'Responsable boutique']]) },
          { id: 'vente', name: 'Vente', agents: people('ve', [['Jade', 'Marchand', 'Conseillère de vente'], ['Arthur', 'Lenoir', 'Conseiller de vente'], ['Mia', 'Baumann', 'Visual merchandiser', 'idle']]) },
          { id: 'caisse', name: 'Caisse', agents: people('ca', [['Sofia', 'Ferreira', 'Hôtesse de caisse']]) },
          { id: 'stock', name: 'Stock & e-commerce', agents: people('st', [['Leo', 'Graf', 'Gestionnaire de stock'], ['Nora', 'Kunz', 'Expéditions']]) },
        ],
      }
    case 'tech':
      return {
        name: 'Zurisee Labs',
        sector: 'Logiciel B2B',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Marc', 'Lefèvre', 'CEO']]) },
          { id: 'tech', name: 'Ingénierie', agents: people('te', [['Inès', 'Bernard', 'CTO'], ['Kai', 'Müller', 'Développeur backend'], ['Lou', 'Simon', 'Développeuse frontend'], ['Ravi', 'Patel', 'Data engineer'], ['Elsa', 'Berg', 'Product designer', 'idle']]) },
          { id: 'infra', name: 'Infrastructure', agents: people('in', [['Jonas', 'Wyss', 'DevOps']]) },
          { id: 'ventes', name: 'Ventes', agents: people('ve', [['Thomas', 'Klein', 'Account executive'], ['Sarah', 'Moreau', 'SDR']]) },
          { id: 'support', name: 'Support', agents: people('su', [['Aya', 'Haddad', 'Customer success']]) },
        ],
      }
    case 'real_estate':
      return {
        name: 'Régie du Lac',
        sector: 'Immobilier',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Olivier', 'Pasche', 'Directeur']]) },
          { id: 'transac', name: 'Transactions', agents: people('tr', [['Nathalie', 'Bovet', 'Courtière'], ['Romain', 'Chappuis', 'Négociateur'], ['Alice', 'Mettler', 'Négociatrice', 'idle']]) },
          { id: 'gerance', name: 'Gérance', agents: people('ge', [['Fabienne', 'Dubois', 'Gérante d’immeubles'], ['Yves', 'Thalmann', 'Comptable gérance']]) },
        ],
      }
    case 'hosting':
      return {
        name: 'ZtcHosting',
        sector: 'Hébergement web et cloud',
        departments: [
          { id: 'support', name: 'Support', agents: people('su', [['Nova', 'Diallo', 'Support & Customer Success', 'working'], ['Devoid', 'ZTC', 'Customer AI Operator', 'working']]) },
          { id: 'flux', name: 'Flux visiteurs', agents: people('fx', [['Funnel', 'Moreau', 'Visitor Flow & Prospects', 'working']]) },
          { id: 'noc', name: 'Opérations', agents: people('no', [['Orion', 'Keller', 'SRE / Infrastructure', 'working']]) },
          { id: 'host', name: 'Hébergement', agents: people('ho', [['Vega', 'Moreau', 'Hosting & WHM', 'working']]) },
          { id: 'dns', name: 'Domaines & DNS', agents: people('dn', [['Lyra', 'Benali', 'Domains & DNS']]) },
          { id: 'mail', name: 'Messagerie', agents: people('ma', [['Echo', 'Santos', 'Mail & Deliverability', 'idle']]) },
          { id: 'cloud', name: 'Cloud / VPS', agents: people('cl', [['Helix', 'Park', 'Cloud / VPS / LLM']]) },
          { id: 'soc', name: 'Sécurité', agents: people('se', [['Cipher', 'Nguyen', 'Security & SOC'], ['Radar', 'Ito', 'Surface Scan', 'working'], ['Aegis', 'Khan', 'Vulnerability Research']]) },
          { id: 'fin', name: 'Facturation', agents: people('fi', [['Ledger', 'Rousseau', 'Billing & Finance Ops']]) },
          { id: 'dev', name: 'DevOps', agents: people('de', [['Forge', 'Martin', 'DevOps & Release', 'idle']]) },
          { id: 'growth', name: 'Produit', agents: people('gr', [['Pulse', 'Favre', 'Growth & Product']]) },
          { id: 'mkt', name: 'Marketing', agents: people('mk', [
            ['Flare', 'Morel', 'Ads Visual Designer', 'working'],
            ['Clip', 'Nguyen', 'Promo Video Producer', 'working'],
            ['Boost', 'Keller', 'Traffic & Acquisition', 'working'],
            ['Muse', 'Bernard', 'Campaign Copywriter'],
          ]) },
          { id: 'grc', name: 'Conformité', agents: people('gc', [['Sage', 'Aubert', 'GRC / Compliance', 'idle']]) },
          { id: 'perf', name: 'Performance', agents: people('pe', [['Swift', 'Costa', 'Site Performance', 'working']]) },
        ],
      }
    case 'manufacturing':
      return {
        name: 'Jura Précision SA',
        sector: 'Industrie',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Daniel', 'Sutter', 'Directeur d’usine']]) },
          { id: 'prod', name: 'Production', agents: people('pr', [['Marco', 'Gallo', 'Opérateur CNC'], ['Lena', 'Fischer', 'Opératrice'], ['Yusuf', 'Kaya', 'Régleur'], ['Simon', 'Moser', 'Technicien maintenance', 'idle']]) },
          { id: 'qualite', name: 'Qualité', agents: people('qu', [['Carla', 'Zbinden', 'Contrôleuse qualité']]) },
          { id: 'logistique', name: 'Logistique', agents: people('lo', [['Peter', 'Hofer', 'Magasinier'], ['Dario', 'Bianchi', 'Expéditeur']]) },
        ],
      }
    default:
      return {
        name: 'Atlas Conseil',
        sector: 'Conseil',
        departments: [
          { id: 'dir', name: 'Direction', agents: people('dir', [['Léa', 'Martin', 'Directrice']]) },
          { id: 'produit', name: 'Produit', agents: people('pr', [['Marc', 'Lefèvre', 'Chef de projet'], ['Inès', 'Bernard', 'Analyste']]) },
          { id: 'ventes', name: 'Ventes', agents: people('ve', [['Thomas', 'Klein', 'Commercial'], ['Sarah', 'Moreau', 'Chargée d’affaires', 'idle']]) },
          { id: 'finance', name: 'Finance', agents: people('fi', [['Hugo', 'Noir', 'Comptable']]) },
        ],
      }
  }
}
