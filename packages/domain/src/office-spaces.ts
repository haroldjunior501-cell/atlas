import type { OfficeArchetype } from './office-archetype'
import type { OfficeSpaceKind } from './office-layout'

export interface SpaceOption {
  kind: OfficeSpaceKind
  label: string
  test: RegExp
  /** Environnements où l’espace est proposé en priorité (vide = partout). */
  for?: OfficeArchetype[]
}

/** Espaces qu’ATLAS sait ajouter au Bureau 3D, du plus précis au plus générique. */
export const SPACE_CATALOG: SpaceOption[] = [
  { kind: 'creative_studio', label: 'Studio créa', test: /studio cr[ée]a|espace cr[ée]atif|open.?space cr[ée]atif|studio marketing/, for: ['marketing_agency', 'hosting'] },
  { kind: 'photo_studio', label: 'Studio photo', test: /studio(?: photo| vid[ée]o)?\b|shooting|plateau (?:photo|tournage)/, for: ['marketing_agency', 'retail'] },
  { kind: 'pitch_room', label: 'Salle de pitch', test: /pitch/, for: ['marketing_agency'] },
  { kind: 'kitchen_pro', label: 'Cuisine professionnelle', test: /cuisine pro|grande cuisine|cuisine du restaurant/, for: ['restaurant'] },
  { kind: 'dining_room', label: 'Salle de restaurant', test: /salle (?:[àa] manger|de restaurant)|salle des clients/, for: ['restaurant'] },
  { kind: 'terrace', label: 'Terrasse', test: /terrasse/, for: ['restaurant'] },
  { kind: 'cold_room', label: 'Chambre froide', test: /chambre froide|frigo/, for: ['restaurant'] },
  { kind: 'waiting_room', label: 'Salle d’attente', test: /salle d.attente|attente/, for: ['clinic'] },
  { kind: 'exam_room', label: 'Cabinet de consultation', test: /cabinet|consultation|salle d.examen/, for: ['clinic'] },
  { kind: 'pharmacy', label: 'Pharmacie', test: /pharmacie/, for: ['clinic'] },
  { kind: 'lab', label: 'Laboratoire', test: /labo(?:ratoire)?(?! qualit)/, for: ['clinic'] },
  { kind: 'quality_lab', label: 'Labo qualité', test: /labo(?:ratoire)? qualit|contr[ôo]le qualit/, for: ['manufacturing'] },
  { kind: 'production_line', label: 'Ligne de production', test: /ligne de production|atelier de production|usine/, for: ['manufacturing'] },
  { kind: 'parts_store', label: 'Magasin de pièces', test: /magasin (?:de )?pi[eè]ces|pi[eè]ces d[ée]tach/, for: ['car_dealership'] },
  { kind: 'workshop', label: 'Atelier', test: /atelier|garage/, for: ['car_dealership'] },
  { kind: 'showroom', label: 'Showroom', test: /showroom|salle d.exposition|exposition/, for: ['car_dealership'] },
  { kind: 'delivery_bay', label: 'Zone de livraison', test: /zone de livraison|livraison v[ée]hicule/, for: ['car_dealership'] },
  { kind: 'parking', label: 'Parking', test: /parking/, for: ['car_dealership', 'retail'] },
  { kind: 'loading_dock', label: 'Quais de chargement', test: /quai/, for: ['logistics'] },
  { kind: 'warehouse', label: 'Entrepôt', test: /entrep[ôo]t|stockage palettes/, for: ['logistics'] },
  { kind: 'packing_area', label: 'Zone de préparation', test: /pr[ée]paration (?:de )?commandes?|emballage|packing/, for: ['logistics'] },
  { kind: 'truck_yard', label: 'Cour camions', test: /cour (?:des )?camions|camions/, for: ['logistics'] },
  { kind: 'sales_floor', label: 'Surface de vente', test: /surface de vente|espace de vente|boutique|magasin/, for: ['retail'] },
  { kind: 'checkout', label: 'Caisses', test: /caisses?\b/, for: ['retail'] },
  { kind: 'fitting_rooms', label: 'Cabines d’essayage', test: /cabines? d.essayage|essayage/, for: ['retail'] },
  { kind: 'stockroom', label: 'Réserve', test: /r[ée]serve/, for: ['retail'] },
  { kind: 'server_room', label: 'Salle serveurs', test: /serveurs?|datacenter|salle machine|noc|h[eé]bergement/, for: ['tech', 'hosting'] },
  { kind: 'war_room', label: 'Salle des opérations', test: /\bnoc\b|salle des op[eé]rations|war room/, for: ['tech', 'hosting'] },
  { kind: 'service_desk', label: 'Accueil support', test: /support|accueil client|tickets?/, for: ['hosting', 'car_dealership'] },
  { kind: 'lab', label: 'Salle de sécurité', test: /\bsoc\b|salle de s[eé]curit/, for: ['hosting', 'clinic'] },
  { kind: 'war_room', label: 'War room', test: /war.?room|salle de pilotage|pilotage/, for: ['tech'] },
  { kind: 'listing_wall', label: 'Vitrine annonces', test: /vitrine|annonces/, for: ['real_estate'] },
  { kind: 'project_room', label: 'Salle projet', test: /salle (?:de )?projet|projet/ },
  { kind: 'meeting_medium', label: 'Salle de réunion', test: /salle de r[ée]union|r[ée]union|conf[ée]rence/ },
  { kind: 'focus_room', label: 'Salle focus', test: /focus|concentration|calme/ },
  { kind: 'phone_booth', label: 'Cabine téléphonique', test: /cabine t[ée]l|phone.?booth|cabine/ },
  { kind: 'cafeteria', label: 'Cafétéria', test: /caf[ée]t[ée]ria|cantine|caf[ée]\b/ },
  { kind: 'lounge', label: 'Lounge', test: /lounge|d[ée]tente|repos/ },
  { kind: 'kitchen', label: 'Cuisine', test: /cuisine|kitchenette/ },
  { kind: 'archive', label: 'Archives', test: /archives?/ },
  { kind: 'storage', label: 'Stock', test: /stock|rangement/ },
  { kind: 'lobby', label: 'Accueil', test: /accueil|r[ée]ception|hall/ },
  { kind: 'open_space', label: 'Open space', test: /open.?space|plateau|bureaux? partag/ },
  { kind: 'private_office', label: 'Bureau', test: /bureau/ },
]

/** Reconnaît l’espace demandé (« ajoute une salle de réunion », « un atelier »…). */
export function spaceFromText(text: string): SpaceOption | null {
  const heard = text.toLowerCase()
  return SPACE_CATALOG.find((option) => option.test.test(heard)) ?? null
}

/** Espaces proposés dans l’interface pour un environnement donné. */
export function spacesFor(archetype: OfficeArchetype): SpaceOption[] {
  const own = SPACE_CATALOG.filter((option) => option.for?.includes(archetype))
  const shared = SPACE_CATALOG.filter((option) => !option.for)
  return [...own, ...shared]
}
