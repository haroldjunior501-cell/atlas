import type { OfficeArchetype } from './office-archetype'
import type { OfficeLayout, OfficeProp, OfficeRoom } from './office-layout'

/**
 * Données opérationnelles du jumeau numérique.
 * Tant que la facturation n’est pas branchée, ATLAS les simule de façon
 * déterministe à partir de l’environnement généré (marqué `simulated`).
 */

export type OpsRecordStatus = 'paid' | 'pending' | 'overdue' | 'draft' | 'progress'

export interface OpsRecord {
  id: string
  number: string
  /** Date suisse JJ.MM.AAAA (affichage). */
  date: string
  /** Date ISO AAAA-MM-JJ (tri, filtres). */
  isoDate: string
  dueDate: string
  dueIso: string
  client: string
  subject: string
  /** Montant TTC. */
  amount: number
  /** TVA 8,1 % incluse. */
  vat: number
  status: OpsRecordStatus
  /** Agent qui porte le dossier, assigné par ATLAS. */
  agentId: string | null
  agentName: string | null
  roomId: string | null
  departmentId: string | null
  departmentName: string | null
}

export type OpsActionKind = 'relance' | 'envoi' | 'reappro' | 'dispatch' | 'flux'

/** Action d’orchestration proposée par ATLAS, exécutable par un agent. */
export interface OpsAction {
  id: string
  kind: OpsActionKind
  title: string
  detail: string
  priority: 'high' | 'normal'
  agentId: string | null
  agentName: string | null
  roomId: string | null
  recordIds: string[]
  amount?: number
  /** Consigne transmise à l’agent. */
  mission: string
}

export interface OpsKpi {
  id: string
  label: string
  value: string
  hint?: string
  tone: 'accent' | 'good' | 'warn' | 'neutral'
  live?: boolean
}

export interface OpsStage {
  id: string
  label: string
  count: number
}

export interface OpsAsset {
  id: string
  name: string
  detail: string
  status: string
  tone: 'accent' | 'good' | 'warn' | 'neutral'
  roomId: string
  agentName?: string
}

export interface OpsInventoryLine {
  name: string
  ref: string
  qty: number
  unit: string
  low?: boolean
}

export interface OpsZone {
  roomId: string
  title: string
  subtitle: string
  departmentId: string | null
  metrics: Array<{ label: string; value: string }>
  inventory: OpsInventoryLine[]
  inventoryTitle: string
  finance: { records: number; billed: number; pending: number; overdue: number }
}

export interface OfficeOps {
  archetype: OfficeArchetype
  label: string
  currency: 'CHF'
  simulated: boolean
  kpis: OpsKpi[]
  recordsTitle: string
  records: OpsRecord[]
  stages: OpsStage[]
  assetsTitle: string
  assets: OpsAsset[]
  zones: Record<string, OpsZone>
  tasks: Record<string, string>
  /** Plan d’orchestration ATLAS. */
  atlas: { summary: string; actions: OpsAction[] }
}

export interface OpsLive {
  openTasks: number
  pendingDecisions: number
  activeAgents: number
}

/** Preuves produit live (FOSSBilling / DEVOID / TTFB / scan) — jamais inventées. */
export interface OpsProductLive {
  products?: Array<{ title: string; priceFrom: number | null; comingSoon?: boolean; unit?: string }>
  devoidOk?: boolean | null
  devoidModel?: string | null
  speed?: Array<{ path: string; ttfbMs: number; ok: boolean }>
  scan?: { status?: number; server?: string; missing?: string[] } | null
  realTasks?: Record<string, string>
}

export function formatChf(amount: number): string {
  const rounded = Math.round(amount)
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '’')
  return `CHF ${rounded < 0 ? '-' : ''}${digits}`
}

function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PEOPLE = ['M. Müller', 'Mme Favre', 'M. Rochat', 'Mme Keller', 'M. Bernasconi', 'Mme Schmid', 'M. Weber', 'Mme Huber', 'M. Meier', 'Mme Gerber', 'M. Rossi', 'Mme Brunner', 'M. Dubois', 'Mme Steiner', 'M. Pasche']
const COMPANIES = ['Alpenblick SA', 'Léman Bio Sàrl', 'Jura Optique SA', 'Lavaux Vins', 'Cervin Sport AG', 'Rhône Habitat SA', 'Zurisee Tech AG', 'Fribourg Fromages', 'Valais Énergie SA', 'Neuchâtel Design', 'Gruyère Mobilité', 'Ticino Moda SA']
const CARS = ['VW Golf VIII', 'Toyota Corolla Hybrid', 'Tesla Model 3', 'Skoda Octavia Combi', 'BMW X1 sDrive18d', 'Mercedes Classe C', 'Dacia Duster', 'Audi A4 Avant', 'Skoda Kodiaq', 'Toyota Yaris Hybrid', 'Renault Clio', 'Peugeot 3008']

interface Template {
  recordsTitle: string
  prefix: string
  client: 'people' | 'companies' | 'patients' | 'tables'
  subjects: string[]
  amount: [number, number]
  stages: string[]
  assetsTitle: string
  tasks: Record<string, string[]>
}

const TEMPLATES: Record<OfficeArchetype, Template> = {
  car_dealership: {
    recordsTitle: 'Devis & factures',
    prefix: 'D',
    client: 'people',
    subjects: ['Service 30’000 km', 'Freins avant', 'Pneus hiver 215/65 R16', 'Amortisseurs arrière', 'Embrayage complet', 'Climatisation', 'Pare-chocs arrière', 'Capteur de pression', 'Vente véhicule neuf', 'Reprise occasion', 'Leasing 48 mois', 'Expertise MFK'],
    amount: [180, 4800],
    stages: ['Réception', 'Diagnostic', 'Devis', 'Réparation', 'Contrôle', 'Livraison'],
    assetsTitle: 'Véhicules',
    tasks: {
      lift: ['Vidange & filtres', 'Remplacement plaquettes', 'Diagnostic électronique', 'Géométrie', 'Changement pneus'],
      desk: ['Offre de reprise', 'Dossier leasing', 'Relance devis', 'Essai routier planifié'],
      counter: ['Accueil client', 'Ouverture d’ordre de réparation', 'Commande pièces'],
      delivery: ['Préparation livraison', 'Remise des clés'],
    },
  },
  marketing_agency: {
    recordsTitle: 'Factures clients',
    prefix: 'F',
    client: 'companies',
    subjects: ['Campagne social ads', 'Refonte identité visuelle', 'Shooting produits', 'Vidéo motion 30 s', 'Plan média T4', 'Stratégie de contenu', 'Landing page', 'Newsletter mensuelle', 'Rapport performance', 'Kit réseaux sociaux'],
    amount: [1200, 24000],
    stages: ['Brief', 'Concept', 'Production', 'Validation', 'Diffusion', 'Reporting'],
    assetsTitle: 'Campagnes',
    tasks: {
      desk: ['Maquettes campagne', 'Déclinaisons formats', 'Rédaction posts', 'Montage vidéo', 'Rapport mensuel'],
      camera: ['Shooting produits'],
      meeting: ['Pitch client', 'Atelier stratégie'],
    },
  },
  restaurant: {
    recordsTitle: 'Tickets & factures',
    prefix: 'T',
    client: 'tables',
    subjects: ['Menu du jour ×2', 'Fondue moitié-moitié', 'Filets de perche', 'Brunch dominical', 'Banquet entreprise', 'Vins & boissons', 'Livraison fournisseur', 'Commande à emporter'],
    amount: [38, 1800],
    stages: ['Réservation', 'Commande', 'Cuisine', 'Service', 'Encaissement'],
    assetsTitle: 'Tables & commandes',
    tasks: {
      stove: ['Cuisson plats du jour', 'Mise en place', 'Sauces & fonds', 'Dressage desserts'],
      service: ['Service table 4', 'Prise de commande', 'Encaissement'],
      bar: ['Cocktails', 'Service vins'],
      stock: ['Inventaire chambre froide', 'Réception livraison'],
    },
  },
  clinic: {
    recordsTitle: 'Dossiers & factures',
    prefix: 'P',
    client: 'patients',
    subjects: ['Consultation générale', 'Bilan cardiologique', 'Contrôle pédiatrique', 'Prise de sang', 'ECG', 'Vaccination', 'Pansement', 'Radiographie'],
    amount: [90, 980],
    stages: ['Accueil', 'Consultation', 'Examens', 'Résultats', 'Facturation'],
    assetsTitle: 'Salles & équipements',
    tasks: {
      exam: ['Consultation en cours', 'Examen clinique', 'Compte rendu'],
      bench: ['Analyses sanguines', 'Validation résultats'],
      counter: ['Admission patient', 'Prise de rendez-vous'],
      stock: ['Réassort pharmacie'],
    },
  },
  logistics: {
    recordsTitle: 'Expéditions & factures',
    prefix: 'BL',
    client: 'companies',
    subjects: ['24 palettes · Genève', 'Colis express ×120', 'Tournée Lausanne', 'Stockage mensuel', 'Cross-dock Bâle', 'Retours e-commerce', 'Transport frigorifique', 'Livraison J+1'],
    amount: [420, 18000],
    stages: ['Réception', 'Stockage', 'Préparation', 'Chargement', 'Livraison'],
    assetsTitle: 'Flotte & engins',
    tasks: {
      rack: ['Mise en stock allée B', 'Inventaire tournant', 'Réappro picking'],
      packing: ['Préparation commandes', 'Emballage colis', 'Étiquetage'],
      dock: ['Chargement quai 2', 'Contrôle réception'],
    },
  },
  retail: {
    recordsTitle: 'Ventes & factures',
    prefix: 'V',
    client: 'people',
    subjects: ['Manteau laine', 'Robe soie', 'Commande e-shop', 'Retouche', 'Carte cadeau', 'Réassort fournisseur', 'Sneakers cuir', 'Sac cabas'],
    amount: [49, 2400],
    stages: ['Réassort', 'Mise en rayon', 'Vente', 'Encaissement', 'SAV'],
    assetsTitle: 'Stock & rayons',
    tasks: {
      floor: ['Conseil client', 'Mise en rayon', 'Vitrine'],
      till: ['Encaissement', 'Retour article'],
      stock: ['Réception colis', 'Expédition e-shop'],
    },
  },
  tech: {
    recordsTitle: 'Factures abonnements',
    prefix: 'INV',
    client: 'companies',
    subjects: ['Plan Business annuel', 'Plan Pro mensuel', 'Onboarding', 'Licences supplémentaires', 'Support premium', 'Intégration API', 'Formation équipe'],
    amount: [290, 36000],
    stages: ['Backlog', 'Développement', 'Revue', 'Tests', 'Déploiement'],
    assetsTitle: 'Infrastructure',
    tasks: {
      desk: ['Revue de code', 'Feature paiements', 'Correctif #412', 'Démo client', 'Prospection'],
      rack: ['Monitoring cluster', 'Mise à jour sécurité'],
    },
  },
  real_estate: {
    recordsTitle: 'Mandats & honoraires',
    prefix: 'M',
    client: 'people',
    subjects: ['Appartement 4.5 p. Lausanne', 'Villa Morges', 'Studio Genève', 'Attique Vevey', 'Local commercial Nyon', 'Gérance immeuble', 'Estimation', 'Bail commercial'],
    amount: [800, 42000],
    stages: ['Estimation', 'Mandat', 'Visites', 'Offre', 'Signature'],
    assetsTitle: 'Biens',
    tasks: {
      desk: ['Visite planifiée', 'Rédaction annonce', 'Négociation offre', 'Relance acquéreur'],
    },
  },
  manufacturing: {
    recordsTitle: 'Commandes & factures',
    prefix: 'C',
    client: 'companies',
    subjects: ['Lot 500 pièces usinées', 'Série prototypes', 'Boîtiers aluminium', 'Axes inox', 'Maintenance préventive', 'Commande matière'],
    amount: [1500, 64000],
    stages: ['Commande', 'Approvisionnement', 'Production', 'Contrôle qualité', 'Expédition'],
    assetsTitle: 'Machines',
    tasks: {
      machine: ['Usinage lot 2041', 'Réglage outil', 'Changement de série'],
      bench: ['Contrôle dimensionnel', 'Rapport qualité'],
      rack: ['Préparation expédition'],
    },
  },
  hosting: {
    recordsTitle: 'Commandes & factures',
    prefix: 'ZTC',
    client: 'companies',
    subjects: ['Starter Hosting', 'Business Hosting', 'Premium Hosting', 'Nom de domaine', 'Messagerie professionnelle', 'n8n hébergé', 'Renouvellement SSL', 'Sauvegarde', 'Ticket support', 'Incident DNS', 'Scan public', 'Écart HSTS', 'TTFB accueil', 'Visuel Business Hosting', 'Vidéo promo Starter', 'Plan trafic /order', 'Accroches campagne Muse'],
    amount: [6, 240],
    stages: ['Commande', 'Paiement', 'Provisionnement', 'DNS / SSL', 'Livraison'],
    assetsTitle: 'Nœuds & comptes',
    tasks: {
      desk: ['Relance renouvellement FOSSBilling', 'Rapprochement facture Ledger', 'Revue SKU Pulse', 'Brief Muse + Flare (prix live)'],
      counter: ['Ticket Nova', 'Onboarding Starter', 'Orchestrer DEVOID', 'Statut commande boutique'],
      rack: ['Contrôle quota Vega', 'Vérifier AutoSSL', 'Mesure TTFB Swift', 'Scan en-têtes Radar'],
      meeting: ['Escalade Orion', 'Revue capacité', 'Checklist Aegis HSTS/CSP', 'Hand-off Cipher'],
      lab: ['Durcissement Aegis (lecture seule)', 'Scan surface Radar', 'Aucun PoC'],
      creative_studio: ['Image Flare Business Hosting', 'Vidéo Clip Starter', 'Plan trafic Boost /order', 'Copy Muse campagne', 'Prix FOSSBilling exact'],
    },
  },
  corporate: {
    recordsTitle: 'Factures',
    prefix: 'F',
    client: 'companies',
    subjects: ['Mission de conseil', 'Audit', 'Accompagnement', 'Formation', 'Abonnement', 'Prestation mensuelle'],
    amount: [900, 18000],
    stages: ['Demande', 'Analyse', 'Exécution', 'Validation', 'Clôture'],
    assetsTitle: 'Projets',
    tasks: {
      desk: ['Analyse dossier', 'Rédaction rapport', 'Relance client', 'Préparation réunion'],
      meeting: ['Réunion client'],
    },
  },
}

const KIND_LABEL: Record<string, string> = {
  workshop: 'Atelier · ponts élévateurs', showroom: 'Showroom', parts_store: 'Magasin', service_desk: 'Accueil clients',
  parking: 'Extérieur', delivery_bay: 'Livraison', creative_studio: 'Open space créatif', photo_studio: 'Studio',
  pitch_room: 'Salle de réunion', war_room: 'Pilotage', kitchen_pro: 'Cuisine professionnelle', dining_room: 'Salle',
  terrace: 'Extérieur', cold_room: 'Stockage froid', waiting_room: 'Accueil', exam_room: 'Consultations', lab: 'Laboratoire',
  pharmacy: 'Stock médical', warehouse: 'Entrepôt', loading_dock: 'Quais', packing_area: 'Préparation', truck_yard: 'Cour',
  sales_floor: 'Surface de vente', checkout: 'Caisses', stockroom: 'Réserve', fitting_rooms: 'Cabines', server_room: 'Infrastructure',
  listing_wall: 'Front office', production_line: 'Production', quality_lab: 'Qualité', lobby: 'Accueil', reception: 'Accueil',
  private_office: 'Bureau fermé', cubicle: 'Bureaux semi-cloisonnés', open_space: 'Open space', team_zone: 'Zone d’équipe',
  meeting_medium: 'Salle de réunion', project_room: 'Salle projet', enclave: 'Enclave', focus_room: 'Focus', phone_booth: 'Cabine',
  cafeteria: 'Cafétéria', lounge: 'Lounge', kitchen: 'Cuisine', archive: 'Archives', storage: 'Stock',
}

const PROP_LABEL: Record<string, string> = {
  car: 'Véhicule', van: 'Utilitaire', truck: 'Camion', ambulance: 'Ambulance', forklift: 'Chariot élévateur', car_lift: 'Pont élévateur',
  tool_cabinet: 'Servante d’atelier', tire_stack: 'Pneus', display_podium: 'Podium', counter: 'Comptoir', chairs_row: 'Assises',
  moodboard: 'Moodboard', easel: 'Chevalet', big_screen: 'Écran mural', backdrop: 'Fond studio', camera_tripod: 'Caméra', softbox: 'Éclairage',
  stove: 'Piano de cuisson', prep_table: 'Plan de travail inox', fridge_pro: 'Armoire froide', dining_table: 'Table', bar_counter: 'Bar',
  parasol_table: 'Table parasol', exam_bed: 'Table d’examen', medical_cart: 'Chariot de soins', lab_bench: 'Paillasse', pallet_rack: 'Rayonnage',
  pallet: 'Palette', conveyor: 'Convoyeur', pack_table: 'Poste d’emballage', box_stack: 'Cartons', dock_door: 'Porte de quai',
  cnc_machine: 'Centre d’usinage', robot_arm: 'Robot', measure_machine: 'Machine de mesure', shelving: 'Étagères', retail_shelf: 'Gondole',
  display_table: 'Table de présentation', mannequin: 'Mannequin', checkout_counter: 'Caisse', fitting_booth: 'Cabine d’essayage',
  server_rack: 'Baie serveur', listing_board: 'Vitrine annonce', model_table: 'Maquette', reception_desk: 'Banque d’accueil',
  round_table: 'Table de réunion', sofa: 'Canapé', printer: 'Imprimante', whiteboard: 'Tableau blanc', tv: 'Écran', coffee: 'Machine à café',
}

const INVENTORY: Record<string, { title: string; rows: Array<[string, string, string]> }> = {
  parts_store: { title: 'Inventaire pièces', rows: [['Huile 5W-30 · 5 L', 'HU-530', 'bidons'], ['Plaquettes avant', 'PL-FR', 'jeux'], ['Filtre à huile', 'FH-210', 'pcs'], ['Pneus 205/55 R16', 'PN-2055', 'pcs'], ['Balais essuie-glace', 'BE-60', 'paires'], ['Liquide de frein DOT4', 'LF-4', 'flacons']] },
  workshop: { title: 'Consommables atelier', rows: [['Vernis HS 2K · 5 L', 'VE-2K', 'bidons'], ['Mastic polyester 2 kg', 'MP-2', 'pots'], ['Disques abrasifs P80', 'DA-80', 'boîtes'], ['Papier de masquage', 'PM-45', 'rouleaux']] },
  kitchen_pro: { title: 'Mise en place', rows: [['Filets de perche', 'POI-01', 'kg'], ['Gruyère AOP', 'FRO-02', 'kg'], ['Pommes de terre', 'LEG-03', 'kg'], ['Crème 35 %', 'LAI-04', 'L']] },
  cold_room: { title: 'Chambre froide', rows: [['Viande de bœuf', 'VIA-01', 'kg'], ['Légumes de saison', 'LEG-02', 'caisses'], ['Produits laitiers', 'LAI-03', 'caisses'], ['Poisson du lac', 'POI-04', 'kg']] },
  pharmacy: { title: 'Stock médical', rows: [['Gants nitrile M', 'GN-M', 'boîtes'], ['Compresses stériles', 'CS-10', 'paquets'], ['Seringues 5 ml', 'SE-5', 'pcs'], ['Désinfectant', 'DE-1', 'flacons']] },
  lab: { title: 'Réactifs', rows: [['Tubes EDTA', 'TU-ED', 'pcs'], ['Réactif CRP', 'RE-CRP', 'kits'], ['Lames', 'LA-01', 'boîtes']] },
  warehouse: { title: 'Stock entrepôt', rows: [['Palettes EUR', 'PAL-EUR', 'pcs'], ['Cartons 60×40', 'CAR-64', 'pcs'], ['Film étirable', 'FIL-23', 'rouleaux'], ['Références actives', 'SKU', 'réf.']] },
  packing_area: { title: 'Consommables', rows: [['Cartons S', 'CAR-S', 'pcs'], ['Cartons M', 'CAR-M', 'pcs'], ['Étiquettes transport', 'ETI-01', 'rouleaux'], ['Calage papier', 'CAL-01', 'rouleaux']] },
  stockroom: { title: 'Réserve', rows: [['Manteaux laine', 'MAN-01', 'pcs'], ['Robes soie', 'ROB-02', 'pcs'], ['Sneakers cuir', 'SNE-03', 'paires'], ['Sacs cabas', 'SAC-04', 'pcs']] },
  sales_floor: { title: 'En rayon', rows: [['Nouvelle collection', 'COL-AH', 'pcs'], ['Accessoires', 'ACC-01', 'pcs'], ['Promotions', 'PRO-01', 'pcs']] },
  server_room: { title: 'Infrastructure', rows: [['Nœuds de calcul', 'K8S-N', 'nœuds'], ['Stockage', 'SSD-TB', 'To'], ['Sauvegardes', 'BKP-D', 'jours']] },
  production_line: { title: 'Matière & outils', rows: [['Barres aluminium', 'ALU-6082', 'barres'], ['Inox 316L', 'INX-316', 'barres'], ['Fraises carbure', 'FRA-8', 'pcs'], ['Huile de coupe', 'HUC-20', 'L']] },
  quality_lab: { title: 'Contrôle', rows: [['Lots à contrôler', 'LOT', 'lots'], ['Calibres', 'CAL', 'pcs']] },
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function swissDate(d: Date) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const RECORDS = 36
const FINANCE = /financ|compta|factur|tr[ée]sor|caiss|account|billing|admin/i

function listNumbers(records: OpsRecord[]) {
  const shown = records.slice(0, 3).map((record) => record.number).join(', ')
  return records.length > 3 ? `${shown} et ${records.length - 3} autres` : shown
}

/**
 * Opérations produit ZTC : uniquement des données observées.
 * Pas de factures inventées, pas de CA fantôme, pas de tâches aléatoires.
 */
export function liveProductOperations(
  layout: OfficeLayout,
  opts: { live?: OpsLive | null; product?: OpsProductLive | null } = {},
): OfficeOps {
  const product = opts.product ?? {}
  const live = opts.live
  const products = product.products ?? []
  const realTasks = product.realTasks ?? {}
  const journey = ['Commande', 'Paiement', 'Provisionnement', 'DNS / SSL', 'Livraison']

  const tasks: Record<string, string> = {}
  for (const agent of layout.agents) {
    tasks[agent.id] = realTasks[agent.id]?.trim()
      || (agent.status === 'working' ? `Mission ${agent.role}` : `En poste · ${agent.role}`)
  }

  const zones: Record<string, OpsZone> = {}
  for (const room of layout.rooms) {
    const inRoom = layout.agents.filter((agent) => agent.roomId === room.id)
    const busy = inRoom.filter((agent) => agent.status === 'working' || Boolean(realTasks[agent.id])).length
    const roomTasks = inRoom.map((agent) => realTasks[agent.id]).filter(Boolean) as string[]
    const catalogLines: OpsInventoryLine[] = /marketing|produit|studio|cr[eé]a/i.test(room.name)
      ? products.slice(0, 8).map((item) => ({
          name: item.title,
          ref: item.comingSoon ? 'SOON' : (item.priceFrom == null ? '—' : `$${item.priceFrom}`),
          qty: 1,
          unit: item.unit || 'sku',
          low: Boolean(item.comingSoon),
        }))
      : []
    zones[room.id] = {
      roomId: room.id,
      departmentId: room.departmentId,
      finance: { records: 0, billed: 0, pending: 0, overdue: 0 },
      title: room.name,
      subtitle: KIND_LABEL[room.kind] ?? room.kind,
      metrics: [
        { label: 'Agents', value: String(inRoom.length) },
        { label: 'En mission', value: String(busy) },
        { label: 'Missions live', value: String(roomTasks.length) },
      ],
      inventory: catalogLines,
      inventoryTitle: catalogLines.length ? 'SKU FOSSBilling (live)' : 'Équipements',
    }
  }

  const skuLive = products.filter((item) => !item.comingSoon).length
  const orderSpeed = product.speed?.find((point) => point.path === '/order')
  const missing = product.scan?.missing?.length ?? 0
  const kpis: OpsKpi[] = [
    {
      id: 'sku',
      label: 'SKU live',
      value: products.length ? String(skuLive) : '—',
      hint: products.length ? `${products.length} au catalogue` : 'FOSSBilling…',
      tone: 'accent',
      live: true,
    },
    {
      id: 'devoid',
      label: 'DEVOID',
      value: product.devoidOk == null ? '—' : product.devoidOk ? 'En ligne' : 'Hors ligne',
      hint: product.devoidModel || undefined,
      tone: product.devoidOk ? 'good' : product.devoidOk === false ? 'warn' : 'neutral',
      live: true,
    },
    {
      id: 'ttfb',
      label: 'TTFB /order',
      value: orderSpeed ? `${orderSpeed.ttfbMs} ms` : '—',
      tone: orderSpeed && !orderSpeed.ok ? 'warn' : 'neutral',
      live: true,
    },
    {
      id: 'scan',
      label: 'Scan public',
      value: product.scan?.status != null ? `HTTP ${product.scan.status}` : '—',
      hint: missing ? `${missing} en-tête${missing > 1 ? 's' : ''} manquant${missing > 1 ? 's' : ''}` : product.scan?.server || undefined,
      tone: missing ? 'warn' : 'good',
      live: true,
    },
  ]
  if (live) {
    kpis.push(
      { id: 'tasks', label: 'Tâches ouvertes', value: String(live.openTasks), tone: 'neutral', live: true },
      { id: 'agents', label: 'Agents actifs', value: `${live.activeAgents}/${layout.agents.length}`, tone: 'good', live: true },
    )
  } else {
    const working = layout.agents.filter((agent) => agent.status === 'working' || Boolean(realTasks[agent.id])).length
    kpis.push({ id: 'agents', label: 'Agents actifs', value: `${working}/${layout.agents.length}`, tone: 'good', live: true })
  }

  const homeRoom = layout.rooms.find((room) => /produit|marketing|studio/i.test(room.name))?.id
    ?? layout.rooms[0]?.id
    ?? ''
  const assets: OpsAsset[] = products.slice(0, 12).map((item, index) => ({
    id: `sku-${index}`,
    name: item.title,
    detail: item.comingSoon ? 'Coming soon (observé)' : 'Catalogue FOSSBilling',
    status: item.comingSoon ? 'soon' : item.priceFrom == null ? '—' : item.priceFrom === 0 ? 'gratuit' : `$${item.priceFrom}${item.unit ? `/${item.unit}` : ''}`,
    tone: item.comingSoon ? 'warn' : 'good',
    roomId: homeRoom,
    agentName: undefined,
  }))

  const stages: OpsStage[] = journey.map((label, index) => ({ id: `stage-${index}`, label, count: 0 }))

  const actions: OpsAction[] = []
  const byName = (re: RegExp) => layout.agents.find((agent) => re.test(`${agent.name} ${agent.role}`))
  if (orderSpeed && orderSpeed.ttfbMs > 800) {
    const swift = byName(/swift|perf/i)
    actions.push({
      id: 'live-swift-ttfb',
      kind: 'dispatch',
      title: 'Swift · TTFB /order élevé',
      detail: `${orderSpeed.ttfbMs} ms observés`,
      priority: 'high',
      agentId: swift?.id ?? null,
      agentName: swift?.name ?? 'Swift',
      roomId: swift?.roomId ?? null,
      recordIds: [],
      mission: `Mesure et diagnostique le TTFB de ztchosting.com/order (${orderSpeed.ttfbMs} ms observés). Chiffres live seulement, aucune écriture.`,
    })
  }
  if (missing > 0) {
    const radar = byName(/radar|aegis|s[eé]curit/i)
    actions.push({
      id: 'live-radar-headers',
      kind: 'dispatch',
      title: 'Radar · en-têtes manquants',
      detail: (product.scan?.missing ?? []).slice(0, 3).join(', '),
      priority: 'normal',
      agentId: radar?.id ?? null,
      agentName: radar?.name ?? 'Radar',
      roomId: radar?.roomId ?? null,
      recordIds: [],
      mission: `Scan public : liste les en-têtes manquants (${(product.scan?.missing ?? []).join(', ')}). Lecture seule, aucun PoC.`,
    })
  }
  if (product.devoidOk === false) {
    const devoid = byName(/devoid|nova|support/i)
    actions.push({
      id: 'live-devoid-down',
      kind: 'dispatch',
      title: 'DEVOID hors ligne',
      detail: 'Health check en échec',
      priority: 'high',
      agentId: devoid?.id ?? null,
      agentName: devoid?.name ?? 'Devoid',
      roomId: devoid?.roomId ?? null,
      recordIds: [],
      mission: 'Vérifie DEVOID /health et le chat client ztchosting.com. Ne simule pas un agent en ligne.',
    })
  }
  for (const agent of layout.agents) {
    const mission = realTasks[agent.id]
    if (!mission) continue
    actions.push({
      id: `live-task-${agent.id}`,
      kind: 'dispatch',
      title: `${agent.name.split(' ')[0]} · mission live`,
      detail: mission,
      priority: 'normal',
      agentId: agent.id,
      agentName: agent.name,
      roomId: agent.roomId,
      recordIds: [],
      mission,
    })
  }
  actions.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1))

  const open = live?.openTasks ?? Object.keys(realTasks).length
  const active = live?.activeAgents ?? layout.agents.filter((agent) => agent.status === 'working' || Boolean(realTasks[agent.id])).length
  const summary = products.length
    ? `Produit live · ${skuLive} SKU FOSSBilling · DEVOID ${product.devoidOk ? 'en ligne' : product.devoidOk === false ? 'hors ligne' : '…'} · ${active}/${layout.agents.length} agents · ${open} mission${open > 1 ? 's' : ''} · ${actions.length} action${actions.length > 1 ? 's' : ''}`
    : `Équipe ${layout.agents.length} · lecture produit en cours · aucune donnée inventée`

  return {
    atlas: { summary, actions: actions.slice(0, 12) },
    archetype: layout.archetype,
    label: layout.archetypeLabel,
    currency: 'CHF',
    simulated: false,
    kpis,
    recordsTitle: 'Factures FOSSBilling',
    records: [],
    stages,
    assetsTitle: 'Catalogue live',
    assets,
    zones,
    tasks,
  }
}

/** @deprecated Démo uniquement — le bureau ZTC utilise `liveProductOperations`. */
export function generateOperations(layout: OfficeLayout, opts: { live?: OpsLive | null; now?: Date } = {}): OfficeOps {
  const archetype = layout.archetype
  const tpl = TEMPLATES[archetype]
  const rand = rng(`${layout.organizationId}:${archetype}`)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!
  const now = opts.now ?? new Date()
  const year = now.getFullYear()

  const clientName = (i: number) => {
    if (tpl.client === 'companies') return pick(COMPANIES)
    if (tpl.client === 'patients') return `Patient #${(1040 + i * 7) % 9000}`
    if (tpl.client === 'tables') return i % 3 === 0 ? pick(COMPANIES) : `Table ${1 + (i % 12)}`
    return pick(PEOPLE)
  }

  // ---- Porteurs : ATLAS répartit les dossiers entre les métiers, la finance encaisse
  const roomName = new Map(layout.rooms.map((room) => [room.id, room.name]))
  const finance = layout.agents.find((agent) => FINANCE.test(agent.role) || FINANCE.test(roomName.get(agent.roomId) ?? ''))
    ?? layout.agents.find((agent) => /direct|ceo|g[ée]rant|manager/i.test(agent.role))
    ?? layout.agents[0]
  const billers = layout.agents.filter((agent) => agent !== finance)
  const owners = billers.length ? billers : layout.agents

  // ---- Dossiers / factures
  const records: OpsRecord[] = []
  const start = 146 + Math.floor(rand() * 40) + RECORDS
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let back = 0
  for (let i = 0; i < RECORDS; i += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - back)
    back += Math.floor(rand() * 3.2)
    const due = new Date(date)
    due.setDate(date.getDate() + 30)
    const [min, max] = tpl.amount
    const amount = Math.round((min + rand() * rand() * (max - min)) / 5) * 5
    const roll = rand()
    const age = (today.getTime() - date.getTime()) / 86_400_000
    let status: OpsRecordStatus
    if (i < 2) status = 'draft'
    else if (age > 30) status = roll < 0.82 ? 'paid' : 'pending'
    else status = roll < 0.38 ? 'paid' : roll < 0.78 ? 'pending' : roll < 0.92 ? 'progress' : 'draft'
    if (status === 'pending' && due < today) status = 'overdue'
    const subject = archetype === 'car_dealership' ? `${pick(CARS)} · ${pick(tpl.subjects)}` : pick(tpl.subjects)
    const owner = owners.length ? owners[(i * 7 + Math.floor(rand() * 3)) % owners.length]! : null
    const room = owner ? layout.rooms.find((r) => r.id === owner.roomId) : undefined
    records.push({
      id: `rec-${i}`,
      number: `${tpl.prefix}-${year}-${String(start - i).padStart(4, '0')}`,
      date: swissDate(date),
      isoDate: isoDate(date),
      dueDate: swissDate(due),
      dueIso: isoDate(due),
      client: clientName(i),
      subject,
      amount,
      vat: Math.round((amount * 8.1) / 108.1 * 20) / 20,
      status,
      agentId: owner?.id ?? null,
      agentName: owner?.name ?? null,
      roomId: room?.id ?? null,
      departmentId: owner?.departmentId ?? null,
      departmentName: room?.name ?? null,
    })
  }

  // ---- Actifs (véhicules, machines, biens…) tirés de la scène
  const rooms = new Map<string, OfficeRoom>(layout.rooms.map((room) => [room.id, room]))
  const assets: OpsAsset[] = []
  const assetProps = layout.props.filter((prop) => prop.assetId)
  const nearestAgent = (prop: OfficeProp) => {
    let best: { name: string; dist: number } | null = null
    for (const agent of layout.agents) {
      if (agent.roomId !== prop.roomId) continue
      const dist = Math.hypot(agent.x - prop.x, agent.z - prop.z)
      if (dist < 2.6 && (!best || dist < best.dist)) best = { name: agent.name, dist }
    }
    return best?.name
  }
  const carNames = new Map<string, string>()
  assetProps.forEach((prop, index) => {
    const room = rooms.get(prop.roomId)
    const agentName = nearestAgent(prop)
    let name = PROP_LABEL[prop.kind] ?? prop.kind
    let detail = room?.name ?? ''
    let status = 'Disponible'
    let tone: OpsAsset['tone'] = 'neutral'
    if (prop.kind === 'car' || prop.kind === 'van' || prop.kind === 'truck' || prop.kind === 'ambulance') {
      if (archetype === 'car_dealership' || prop.kind === 'car') {
        name = CARS[(index * 5 + Math.floor(rand() * 3)) % CARS.length]!
        carNames.set(prop.id, name)
      } else if (prop.kind === 'truck') name = `Camion ${String.fromCharCode(65 + (index % 26))}${pad(index + 1)}`
      else if (prop.kind === 'van') name = `Utilitaire ${pad(index + 1)}`
      else name = `Ambulance ${pad(index + 1)}`
      if (prop.label === 'lift') { status = 'En réparation'; tone = 'accent' }
      else if (prop.label === 'show') { status = formatChf(Math.round((22 + rand() * 48) * 1000 / 100) * 100); tone = 'good'; detail = 'En vente · showroom' }
      else if (prop.label === 'delivery') { status = 'Prête à livrer'; tone = 'good' }
      else if (prop.kind === 'truck') { status = rand() > 0.4 ? 'Au quai' : 'En tournée'; tone = status === 'Au quai' ? 'neutral' : 'accent' }
      else { status = archetype === 'car_dealership' ? 'Attente atelier' : 'Stationné'; tone = 'warn' }
    } else if (prop.kind === 'listing_board') {
      name = pick(tpl.subjects)
      status = formatChf(Math.round((650 + rand() * 1900) * 1000 / 1000) * 1000)
      tone = 'good'
      detail = rand() > 0.5 ? 'Vente' : 'Location'
    } else if (prop.kind === 'cnc_machine' || prop.kind === 'robot_arm') {
      name = `${PROP_LABEL[prop.kind]} ${pad(index + 1)}`
      status = rand() > 0.15 ? `TRS ${Math.round(78 + rand() * 18)} %` : 'Arrêt maintenance'
      tone = status.startsWith('TRS') ? 'good' : 'warn'
    } else if (prop.kind === 'server_rack') {
      name = `Baie ${String.fromCharCode(65 + (index % 6))}${index + 1}`
      status = `${Math.round(30 + rand() * 60)} % CPU`
      tone = 'neutral'
    } else if (prop.kind === 'forklift') {
      name = `Chariot ${pad(index + 1)}`
      status = 'En mission'
      tone = 'accent'
    }
    assets.push({ id: prop.assetId!, name, detail, status, tone, roomId: prop.roomId, agentName })
  })
  if (assets.length === 0) {
    for (let i = 0; i < 6; i += 1) {
      assets.push({ id: `proj-${i}`, name: `${pick(tpl.subjects)}`, detail: clientName(i), status: pick(['En cours', 'Validation', 'Planifié']), tone: 'neutral', roomId: layout.rooms[0]?.id ?? '' })
    }
  }

  // ---- Tâches en cours par agent
  const tasks: Record<string, string> = {}
  for (const agent of layout.agents) {
    const pool = tpl.tasks[agent.station] ?? tpl.tasks.desk ?? Object.values(tpl.tasks)[0] ?? ['Mission en cours']
    let task = pick(pool)
    if (agent.station === 'lift') {
      const car = layout.props.find((prop) => prop.kind === 'car' && prop.roomId === agent.roomId && Math.hypot(prop.x - agent.x, prop.z - agent.z) < 2.6)
      const carName = car ? carNames.get(car.id) : undefined
      if (carName) task = `${task} · ${carName}`
    }
    tasks[agent.id] = agent.status === 'idle' ? 'En pause' : agent.status === 'offline' ? 'Hors ligne' : task
  }

  // ---- Étapes du flux
  const stages: OpsStage[] = tpl.stages.map((label, index) => ({
    id: `stage-${index}`,
    label,
    count: Math.max(1, Math.round(2 + rand() * 9 - index * 0.6)),
  }))

  // ---- Zones
  const zones: Record<string, OpsZone> = {}
  for (const room of layout.rooms) {
    const inRoom = layout.agents.filter((agent) => agent.roomId === room.id)
    const equipment = new Map<string, number>()
    for (const prop of layout.props) {
      if (prop.roomId !== room.id || !PROP_LABEL[prop.kind]) continue
      equipment.set(prop.kind, (equipment.get(prop.kind) ?? 0) + 1)
    }
    const inv = INVENTORY[room.kind]
    const inventory: OpsInventoryLine[] = inv
      ? inv.rows.map(([name, ref, unit]) => {
          const qty = Math.round(2 + rand() * 60)
          return { name, ref: `${ref}-${Math.floor(10 + rand() * 89)}`, qty, unit, low: qty < 8 }
        })
      : [...equipment.entries()].map(([kind, qty]) => ({ name: PROP_LABEL[kind]!, ref: kind.toUpperCase().slice(0, 6), qty, unit: 'pcs' }))
    const busy = inRoom.filter((agent) => agent.status === 'working').length
    const owned = records.filter((record) => record.roomId === room.id)
    zones[room.id] = {
      roomId: room.id,
      departmentId: room.departmentId,
      finance: {
        records: owned.length,
        billed: owned.reduce((sum, record) => sum + record.amount, 0),
        pending: owned.filter((r) => r.status === 'pending' || r.status === 'overdue').reduce((sum, r) => sum + r.amount, 0),
        overdue: owned.filter((r) => r.status === 'overdue').length,
      },
      title: room.name,
      subtitle: KIND_LABEL[room.kind] ?? room.kind,
      metrics: [
        { label: 'Agents', value: String(inRoom.length) },
        { label: 'Actifs', value: inRoom.length ? `${Math.round((busy / inRoom.length) * 100)} %` : '—' },
        { label: inv ? 'Références' : 'Équipements', value: String(inv ? inventory.reduce((sum, line) => sum + line.qty, 0) : [...equipment.values()].reduce((a, b) => a + b, 0)) },
      ],
      inventory,
      inventoryTitle: inv?.title ?? 'Équipements',
    }
  }

  // ---- Indicateurs
  const paid = records.filter((record) => record.status === 'paid').reduce((sum, record) => sum + record.amount, 0)
  const pending = records.filter((record) => record.status === 'pending' || record.status === 'overdue')
  const monthRevenue = Math.round(paid * (6 + rand() * 4))
  const working = layout.agents.filter((agent) => agent.status === 'working').length
  const occupancy = layout.agents.length ? (working / layout.agents.length) * 100 : 0
  const kpis: OpsKpi[] = []
  const vehicles = assets.filter((asset) => /Véhicule|Utilitaire|Camion|Ambulance/.test(PROP_LABEL[layout.props.find((p) => p.assetId === asset.id)?.kind ?? ''] ?? '')).length
  switch (archetype) {
    case 'car_dealership': {
      const lifts = layout.props.filter((p) => p.kind === 'car_lift').length
      const busyLifts = layout.props.filter((p) => p.kind === 'car' && p.label === 'lift').length
      kpis.push(
        { id: 'veh', label: 'Véhicules sur site', value: String(vehicles), tone: 'neutral' },
        { id: 'occ', label: 'Occupation atelier', value: `${(lifts ? (busyLifts / lifts) * 100 : 0).toFixed(1)} %`, tone: 'accent' },
      )
      break
    }
    case 'marketing_agency':
      kpis.push(
        { id: 'camp', label: 'Campagnes actives', value: String(5 + Math.round(rand() * 9)), tone: 'neutral' },
        { id: 'valid', label: 'Livrables à valider', value: String(3 + Math.round(rand() * 8)), tone: 'accent' },
      )
      break
    case 'restaurant':
      kpis.push(
        { id: 'cov', label: 'Couverts du jour', value: String(60 + Math.round(rand() * 90)), tone: 'neutral' },
        { id: 'occ', label: 'Taux d’occupation', value: `${(62 + rand() * 30).toFixed(1)} %`, tone: 'accent' },
      )
      break
    case 'clinic':
      kpis.push(
        { id: 'rdv', label: 'RDV du jour', value: String(24 + Math.round(rand() * 30)), tone: 'neutral' },
        { id: 'wait', label: 'Attente moyenne', value: `${8 + Math.round(rand() * 14)} min`, tone: 'accent' },
      )
      break
    case 'logistics':
    case 'manufacturing':
      kpis.push(
        { id: 'out', label: archetype === 'logistics' ? 'Colis expédiés' : 'Unités produites', value: String(400 + Math.round(rand() * 2400)), tone: 'neutral' },
        { id: 'svc', label: archetype === 'logistics' ? 'Taux de service' : 'TRS', value: `${(86 + rand() * 12).toFixed(1)} %`, tone: 'accent' },
      )
      break
    case 'retail':
      kpis.push(
        { id: 'sales', label: 'Ventes du jour', value: String(30 + Math.round(rand() * 90)), tone: 'neutral' },
        { id: 'conv', label: 'Conversion', value: `${(18 + rand() * 20).toFixed(1)} %`, tone: 'accent' },
      )
      break
    case 'tech':
      kpis.push(
        { id: 'uptime', label: 'Disponibilité', value: `${(99.5 + rand() * 0.49).toFixed(2)} %`, tone: 'good' },
        { id: 'deploy', label: 'Déploiements / sem.', value: String(6 + Math.round(rand() * 20)), tone: 'accent' },
      )
      break
    case 'real_estate':
      kpis.push(
        { id: 'biens', label: 'Biens en portefeuille', value: String(assets.length + 20 + Math.round(rand() * 30)), tone: 'neutral' },
        { id: 'visits', label: 'Visites cette semaine', value: String(8 + Math.round(rand() * 20)), tone: 'accent' },
      )
      break
    default:
      kpis.push(
        { id: 'occ', label: 'Équipe active', value: `${occupancy.toFixed(1)} %`, tone: 'accent' },
      )
  }
  kpis.push(
    { id: 'rev', label: archetype === 'real_estate' ? 'Honoraires du mois' : archetype === 'tech' ? 'MRR' : 'CA du mois', value: formatChf(monthRevenue), tone: 'good' },
    { id: 'pending', label: 'À encaisser', value: formatChf(pending.reduce((sum, record) => sum + record.amount, 0)), hint: `${pending.length} dossiers`, tone: pending.some((r) => r.status === 'overdue') ? 'warn' : 'neutral' },
  )
  if (opts.live) {
    kpis.push(
      { id: 'tasks', label: 'Tâches ouvertes', value: String(opts.live.openTasks), tone: 'neutral', live: true },
      { id: 'agents', label: 'Agents actifs', value: `${opts.live.activeAgents}/${layout.agents.length}`, tone: 'good', live: true },
    )
  }

  // ---- Orchestration ATLAS : relier les dossiers aux agents et aux zones
  const actions: OpsAction[] = []
  const overdue = records.filter((record) => record.status === 'overdue')
  if (overdue.length && finance) {
    const sum = overdue.reduce((acc, record) => acc + record.amount, 0)
    actions.push({
      id: 'atlas-relance',
      kind: 'relance',
      title: `Relancer ${overdue.length} ${overdue.length > 1 ? 'factures échues' : 'facture échue'}`,
      detail: `${formatChf(sum)} en retard · confié à ${finance.name}`,
      priority: 'high',
      agentId: finance.id,
      agentName: finance.name,
      roomId: finance.roomId,
      recordIds: overdue.map((record) => record.id),
      amount: sum,
      mission: `Relance les factures échues ${listNumbers(overdue)} (${formatChf(sum)} au total) : rappel courtois aux clients, nouvelle échéance à 10 jours, et signale-moi les litiges.`,
    })
  }
  const drafts = records.filter((record) => record.status === 'draft')
  const draftOwners = new Map<string, OpsRecord[]>()
  for (const record of drafts) if (record.agentId) draftOwners.set(record.agentId, [...(draftOwners.get(record.agentId) ?? []), record])
  for (const [agentId, list] of draftOwners) {
    const agent = layout.agents.find((a) => a.id === agentId)!
    const sum = list.reduce((acc, record) => acc + record.amount, 0)
    actions.push({
      id: `atlas-envoi-${agentId}`,
      kind: 'envoi',
      title: `Finaliser ${list.length > 1 ? `${list.length} brouillons` : `le brouillon ${list[0]!.number}`}`,
      detail: `${formatChf(sum)} à facturer · ${agent.name}`,
      priority: 'normal',
      agentId,
      agentName: agent.name,
      roomId: agent.roomId,
      recordIds: list.map((record) => record.id),
      amount: sum,
      mission: `Vérifie et envoie ${list.length > 1 ? 'les brouillons' : 'le brouillon'} ${listNumbers(list)} (${formatChf(sum)}) aux clients, avec échéance à 30 jours.`,
    })
  }
  for (const room of layout.rooms) {
    const low = zones[room.id]?.inventory.filter((line) => line.low) ?? []
    if (!low.length) continue
    const keeper = layout.agents.find((agent) => agent.roomId === room.id)
      ?? layout.agents.find((agent) => /stock|logist|op[ée]ration|achat|approvision|supply/i.test(`${agent.role} ${roomName.get(agent.roomId) ?? ''}`))
      ?? finance
    actions.push({
      id: `atlas-reappro-${room.id}`,
      kind: 'reappro',
      title: `Réapprovisionner ${room.name}`,
      detail: `${low.map((line) => line.name).slice(0, 2).join(', ')}${low.length > 2 ? '…' : ''} · stock bas`,
      priority: 'normal',
      agentId: keeper?.id ?? null,
      agentName: keeper?.name ?? null,
      roomId: room.id,
      recordIds: [],
      mission: `Commande le réassort pour ${room.name} : ${low.map((line) => `${line.name} (${line.qty} ${line.unit} restants)`).join(', ')}. Compare deux fournisseurs et soumets-moi le devis.`,
    })
  }
  const idle = layout.agents.filter((agent) => agent.status === 'idle' || agent.status === 'online')
  for (const agent of idle.slice(0, 3)) {
    const pool = tpl.tasks[agent.station] ?? tpl.tasks.desk ?? Object.values(tpl.tasks)[0] ?? ['Mission en cours']
    const task = pool[(agent.name.length + agent.id.length) % pool.length]!
    actions.push({
      id: `atlas-dispatch-${agent.id}`,
      kind: 'dispatch',
      title: `${agent.name} → ${task}`,
      detail: `Disponible · ${roomName.get(agent.roomId) ?? 'poste'}`,
      priority: 'normal',
      agentId: agent.id,
      agentName: agent.name,
      roomId: agent.roomId,
      recordIds: [],
      mission: `${task} : prends en charge cette tâche depuis ton poste (${roomName.get(agent.roomId) ?? 'bureau'}) et fais-moi un point d’avancement.`,
    })
  }
  const jam = stages.reduce((best, stage) => (stage.count > best.count ? stage : best), stages[0]!)
  if (jam && jam.count >= 7) {
    const lead = layout.agents.find((agent) => agent.status === 'working') ?? layout.agents[0]
    actions.push({
      id: 'atlas-flux',
      kind: 'flux',
      title: `Désengorger l’étape « ${jam.label} »`,
      detail: `${jam.count} dossiers en attente`,
      priority: 'high',
      agentId: lead?.id ?? null,
      agentName: lead?.name ?? null,
      roomId: lead?.roomId ?? null,
      recordIds: [],
      mission: `L’étape « ${jam.label} » accumule ${jam.count} dossiers. Priorise les plus anciens et propose une répartition avec l’équipe.`,
    })
  }
  actions.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1))
  const carriers = new Set(records.map((record) => record.agentId).filter(Boolean)).size
  const summary = layout.agents.length
    ? `ATLAS répartit ${records.length} dossiers entre ${carriers} agent${carriers > 1 ? 's' : ''}${finance ? `, ${finance.name} encaisse` : ''} · ${actions.length} action${actions.length > 1 ? 's' : ''} à lancer`
    : `${records.length} dossiers · ajoutez des agents pour qu’ATLAS les répartisse`

  return {
    atlas: { summary, actions },
    archetype,
    label: layout.archetypeLabel,
    currency: 'CHF',
    simulated: true,
    kpis,
    recordsTitle: tpl.recordsTitle,
    records,
    stages,
    assetsTitle: tpl.assetsTitle,
    assets,
    zones,
    tasks,
  }
}
