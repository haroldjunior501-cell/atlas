import { ACTION } from './catalog'
import {
  agentFace,
  agentVoice,
  businessModelOf,
  hoursFor,
  knownObjectives,
  knownTools,
  objectivesFor,
  toneFor,
  toolsFor,
} from './agent-kit'
import type { DelegationLevel, OrganizationDraft, Permission, RoleDraft } from './model'
import { ztcDevoidToolsOf, ztcSkillsOf } from './ztc-hosting'

export interface PlannedAgent {
  firstName: string
  lastName: string
  role: string
  mission: string
  skills?: string[]
  traits?: string[]
  tone?: string
  hours?: string
  tools?: string[]
  objectives?: Array<{ label?: string; metric?: string; target?: string; dueAt?: string }>
  reportsToRole?: string | null
}

export interface PlannedDepartment {
  name: string
  agents: PlannedAgent[]
}

export interface PlannedOrganization {
  name: string
  objective?: string | null
  sector?: string
  businessModel?: string
  departments: PlannedDepartment[]
}

const allow = (action: string, spendLimit: number | null = null): Permission => ({
  action,
  allowed: true,
  requiresApproval: false,
  spendLimit,
})

const blocked = (action: string): Permission => ({
  action,
  allowed: false,
  requiresApproval: false,
  spendLimit: null,
})

function textOf(role: string, department: string): string {
  return `${role} ${department}`.toLowerCase()
}

function accessFor(role: string, department: string): { delegation: DelegationLevel; permissions: Permission[] } {
  const text = textOf(role, department)
  if (/jurid|legal|notaire|contrat/.test(text)) {
    return { delegation: 'restricted', permissions: [allow(ACTION.reviewContract)] }
  }
  if (/financ|trésor|tresor|compta|cfo/.test(text)) {
    return { delegation: 'approval', permissions: [allow(ACTION.finance), allow(ACTION.manageBudget), blocked(ACTION.spend)] }
  }
  if (/market|croissance|cmo|communication/.test(text)) {
    return { delegation: 'approval', permissions: [allow(ACTION.readAnalytics), allow(ACTION.createCampaign), allow(ACTION.spend, 500)] }
  }
  if (/vente|commercial|sales|immobilier/.test(text)) {
    return { delegation: 'approval', permissions: [allow(ACTION.readCrm), allow(ACTION.sendEmail), blocked(ACTION.spend)] }
  }
  if (/sre|whm|cpanel|soc|s[eé]curit|devops|grc|conform|scan|vuln|aegis|radar|perf|swift/.test(text)) {
    return { delegation: 'approval', permissions: [allow(ACTION.readAnalytics), blocked(ACTION.spend), blocked(ACTION.editBilling)] }
  }
  if (/tech|développ|develop|ingén|ingen|cto|logiciel/.test(text)) {
    return { delegation: 'approval', permissions: [allow(ACTION.editCode), blocked(ACTION.spend)] }
  }
  if (/chef|directeur|responsable|lead|chief/.test(text)) {
    return { delegation: 'approval', permissions: [allow(ACTION.readAnalytics)] }
  }
  return { delegation: 'autonomous', permissions: [allow(ACTION.readAnalytics)] }
}

function roleDraft(agent: PlannedAgent, department: string): RoleDraft | null {
  const firstName = agent.firstName?.trim()
  const lastName = agent.lastName?.trim()
  const role = agent.role?.trim()
  if (!firstName || !lastName || !role || !department.trim()) return null
  const access = accessFor(role, department)
  const skills = (agent.skills ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 5)
  const traits = (agent.traits ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 4)
  return {
    firstName,
    lastName,
    role,
    mission: agent.mission?.trim() || role,
    skills,
    traits,
    tone: agent.tone?.trim() || toneFor(role, traits),
    hours: agent.hours?.trim() || hoursFor(role),
    department: department.trim(),
    reportsToRole: agent.reportsToRole?.trim() || null,
    delegation: access.delegation,
    permissions: access.permissions,
    objectives: knownObjectives(agent.objectives, role, department),
    toolIds: knownTools(agent.tools, role, department),
    voiceId: agentVoice(firstName),
    face: agentFace(firstName, lastName),
  }
}

function uniqueRoles(roles: RoleDraft[]): RoleDraft[] {
  const seen = new Map<string, number>()
  return roles.map((role) => {
    const count = seen.get(role.role) ?? 0
    seen.set(role.role, count + 1)
    if (count === 0) return role
    return { ...role, role: `${role.role} ${count + 1}` }
  })
}

function knownRoles(roles: RoleDraft[]): RoleDraft[] {
  const names = new Set(roles.map((role) => role.role))
  return roles.map((role) => (
    role.reportsToRole && names.has(role.reportsToRole) ? role : { ...role, reportsToRole: null }
  ))
}

export function parseOrganizationPlan(raw: unknown, intention: string): { draft: OrganizationDraft } | { error: string } {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { error: 'Aucun objet JSON.' }
  let body: PlannedOrganization
  try {
    body = JSON.parse(match[0]) as PlannedOrganization
  } catch {
    return { error: 'JSON invalide.' }
  }
  const rawName = body.name?.trim()
  if (!rawName) return { error: 'Le champ name est vide.' }
  const name = /^(je|veux|crée|creer|créer)\b/i.test(rawName) ? named(intention, rawName) : rawName
  if (!Array.isArray(body.departments) || body.departments.length === 0) {
    return { error: 'Le champ departments est vide.' }
  }
  const roles = uniqueRoles(knownRoles(body.departments.slice(0, 6).flatMap((department) => {
    const departmentName = department?.name?.trim() ?? ''
    return (department?.agents ?? []).slice(0, 4).map((agent) => roleDraft(agent, departmentName))
  }).filter((role): role is RoleDraft => Boolean(role)).slice(0, 12)))
  if (roles.length < 2) return { error: 'Il faut au moins deux employés.' }
  return {
    draft: guard(intention, {
      name: name.slice(0, 48),
      intention,
      objective: body.objective?.trim() || intention,
      sector: body.sector?.trim() || undefined,
      businessModel: body.businessModel?.trim() || businessModelOf(intention),
      roles,
    }),
  }
}

function person(
  firstName: string,
  lastName: string,
  role: string,
  mission: string,
  department: string,
  reportsToRole: string | null,
  skills: string[],
  traits: string[],
): RoleDraft {
  const access = accessFor(role, department)
  const connectors = toolsFor(role, department)
  const ztcTools = ztcDevoidToolsOf(firstName)
  const toolIds = ztcTools.length
    ? [...new Set([...connectors, 'devoid' as const])]
    : connectors
  const ztcSkill = ztcTools.length ? ztcSkillsOf(firstName) : []
  return {
    firstName,
    lastName,
    role,
    mission,
    skills: [...new Set([...(ztcSkill.length ? ztcSkill : skills), ...skills])].slice(0, 8),
    traits,
    tone: toneFor(role, traits),
    hours: hoursFor(role),
    department,
    reportsToRole,
    delegation: access.delegation,
    permissions: access.permissions,
    objectives: objectivesFor(role, department),
    toolIds,
    voiceId: agentVoice(firstName),
    face: agentFace(firstName, lastName),
  }
}

function named(intention: string, fallback: string): string {
  const stop = new Set(['une', 'des', 'les', 'pour', 'avec', 'dans', 'crée', 'creer', 'créer', 'créez', 'monte', 'organisation', 'entreprise', 'équipe', 'equipe', 'veux', 'vouloir', 'nous', 'votre', 'cette', 'startup', 'spécialisee', 'spécialisée', 'specialisee'])
  const words = intention
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stop.has(word.toLowerCase()))
    .slice(0, 3)
  if (words.length === 0) return fallback
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').slice(0, 48)
}

export function draftFromIntention(intention: string): OrganizationDraft {
  const heard = intention.toLowerCase()
  const model = businessModelOf(intention)
  if (model === 'hosting' || /h[eé]berg|hosting|\bztc\b|cpanel|\bwhm\b|fossbilling/.test(heard)) {
    return {
      name: /ztc/i.test(intention) ? 'ZtcHosting' : named(intention, 'ZtcHosting'),
      intention,
      objective: 'Faire fonctionner l’hébergement, coordonner les employés IA et garder les décisions sensibles sous contrôle humain.',
      sector: 'Hébergement web et cloud',
      businessModel: 'hosting',
      roles: [
        person('Nova', 'Diallo', 'Support & Customer Success', 'Traiter les tickets, recevoir les escalades DEVOID et renvoyer la réponse au chat client.', 'Support', null, ['Tickets', 'DEVOID', 'Escalades'], ['à l’écoute', 'prudent']),
        person('Devoid', 'ZTC', 'Customer AI Operator', 'Chat client du site. Escalade vers Nova si besoin, puis restitue la réponse Support.', 'Support', 'Support & Customer Success', ['Chat site', 'Escalade Support'], ['clair', 'prudent']),
        person('Funnel', 'Moreau', 'Visitor Flow & Prospects', 'Compter les visiteurs ztchosting.com, les qualifier en prospects et produire des rapports détaillés.', 'Flux visiteurs', null, ['Visiteurs', 'Prospects', 'Rapports'], ['analytique', 'méthodique']),
        person('Orion', 'Keller', 'SRE / Infrastructure', 'Surveiller incidents, latence et capacité. Lecture des métriques seulement.', 'Opérations', null, ['Incidents', 'Latence WHM'], ['calme', 'précis']),
        person('Vega', 'Moreau', 'Hosting & WHM', 'Comptes cPanel, quotas et erreurs de provisionnement, dans un périmètre borné.', 'Hébergement', null, ['WHM', 'Quotas', 'SSL'], ['méthodique', 'prudent']),
        person('Lyra', 'Benali', 'Domains & DNS', 'Domaines, DNS et certificats. Changements sensibles en approbation.', 'Domaines & DNS', null, ['Registrar', 'DNS', 'SSL'], ['précis', 'rigoureux']),
        person('Echo', 'Santos', 'Mail & Deliverability', 'Boîtes, MX/SPF/DKIM et diagnostics e-mail limités au domaine prouvé.', 'Messagerie', null, ['MX', 'Délivrabilité'], ['méthodique', 'calme']),
        person('Helix', 'Park', 'Cloud / VPS / LLM', 'VPS seulement si la boutique n’est plus « coming soon ». LLM privés = lecture du SKU, pas un déploiement fantôme.', 'Cloud / VPS', null, ['VPS', 'LLM privés'], ['prudent', 'clair']),
        person('Cipher', 'Nguyen', 'Security & SOC', 'Alertes et investigations. Confinement selon runbooks approuvés.', 'Sécurité', null, ['SOC', 'Vulnérabilités'], ['vigilant', 'discret']),
        person('Ledger', 'Rousseau', 'Billing & Finance Ops', 'Factures et renouvellements en lecture. Remboursements sous validation.', 'Facturation', null, ['FOSSBilling', 'Rapprochement'], ['prudent', 'précis']),
        person('Forge', 'Martin', 'DevOps & Release', 'n8n / OpenClaw hébergés, CI et rollback. Production seulement avec contrôle.', 'DevOps', null, ['n8n', 'OpenClaw', 'CI'], ['rigoureux', 'calme']),
        person('Pulse', 'Favre', 'Growth & Product', 'Parcours clients et analyses agrégées. Jamais d’envoi massif non approuvé.', 'Produit', null, ['Parcours', 'Produit'], ['curieux', 'clair']),
        person('Sage', 'Aubert', 'GRC / Compliance', 'Risques et preuves. Pas de validation juridique autonome.', 'Conformité', null, ['RGPD', 'Preuves'], ['prudent', 'documenté']),
        person('Radar', 'Ito', 'Surface Scan', 'Scanner la surface publique de ztchosting.com : en-têtes, TLS, endpoints guest. Aucun exploit.', 'Sécurité', 'Security & SOC', ['Scan public', 'En-têtes TLS', 'devoid'], ['vigilant', 'méthodique']),
        person('Aegis', 'Khan', 'Vulnerability Research', 'Lister les écarts de durcissement observés (HSTS, CSP). Lecture seule, pas de PoC offensif.', 'Sécurité', 'Security & SOC', ['Durcissement', 'HSTS', 'CSP'], ['prudent', 'précis']),
        person('Swift', 'Costa', 'Site Performance', 'Mesurer TTFB et disponibilité de l’accueil, /order, /login et des APIs guest.', 'Performance', 'SRE / Infrastructure', ['TTFB', 'Disponibilité', 'HTTP'], ['précis', 'calme']),
        person('Flare', 'Morel', 'Ads Visual Designer', 'Générer les images marketing (FLUX) des offres ZTC avec le prix live FOSSBilling. Jamais un prix inventé.', 'Marketing', null, ['Images FLUX', 'SKU live', 'Bannières'], ['créatif', 'exigeant']),
        person('Clip', 'Nguyen', 'Promo Video Producer', 'Produire les vidéos et clips promotionnels du produit (hébergement, SKU IA). Pas de SLA inventé.', 'Marketing', 'Ads Visual Designer', ['Vidéo promo', 'Storyboard', 'Film'], ['visuel', 'rythmé']),
        person('Boost', 'Keller', 'Traffic & Acquisition', 'Augmenter le trafic client vers ztchosting.com et /order : SEO, landing, campagnes. Mesure avant promesse.', 'Marketing', 'Ads Visual Designer', ['Trafic', 'SEO', 'Acquisition'], ['analytique', 'orienté résultat']),
        person('Muse', 'Bernard', 'Campaign Copywriter', 'Rédiger accroches, posts et briefs campagne à partir du catalogue live. Ton marque ZTC.', 'Marketing', 'Ads Visual Designer', ['Copy', 'Campagnes', 'Contenu'], ['clair', 'créatif']),
      ],
    }
  }
  if (model === 'clinique' || /clinique|télémédecine|telemedecine|médec|medec|patient|santé|sante|hôpital|hopital/.test(heard)) {
    return {
      name: named(intention, 'Clinique Télémédecine'),
      intention,
      objective: 'Délivrer des consultations à distance avec un suivi patient mesurable.',
      sector: 'Santé',
      businessModel: 'clinique',
      roles: [
        person('Camille', 'Rossi', 'Médecin chef', 'Superviser les consultations à distance.', 'Médical', null, ['Médecine', 'Téléconsultation'], ['calme', 'rigoureux']),
        person('Inès', 'Bernard', 'Infirmier coordinateur', 'Coordonner le suivi des patients.', 'Médical', 'Médecin chef', ['Soins', 'Coordination'], ['attentif', 'méthodique']),
        person('Sarah', 'Moreau', 'Responsable accueil', 'Organiser les admissions et le lien avec les familles.', 'Patients', null, ['Accueil', 'Relation patient'], ['clair', 'patient']),
        person('Marc', 'Lefèvre', 'Responsable technique', 'Faire tenir la téléconsultation.', 'Technique', null, ['Logiciel', 'Sécurité'], ['précis', 'prudent']),
      ],
    }
  }
  if (model === 'immobilier' || /immobilier|immo|logement|notaire/.test(heard)) {
    return {
      name: named(intention, 'Agence immobilière'),
      intention,
      objective: 'Vendre et louer des biens avec un pipeline commercial chiffré.',
      sector: 'Immobilier',
      businessModel: 'immobilier',
      roles: [
        person('Thomas', 'Klein', 'Directeur commercial', 'Conduire les ventes.', 'Ventes', null, ['Négociation', 'Mandats'], ['persuasif', 'direct']),
        person('Léa', 'Martin', 'Agent immobilier', 'Accompagner les acquéreurs.', 'Ventes', 'Directeur commercial', ['Visites', 'Estimation'], ['à l’écoute', 'organisé']),
        person('Sarah', 'Moreau', 'Responsable marketing', 'Rendre les biens visibles.', 'Marketing', null, ['Annonces', 'Image'], ['créatif', 'exigeant']),
        person('Adam', 'Benali', 'Conseil juridique', 'Sécuriser les compromis.', 'Juridique', null, ['Contrats', 'Conformité'], ['prudent', 'précis']),
      ],
    }
  }
  if (model === 'jeu' || /jeu|game|vidéo|video/.test(heard) && /studio|jeu|game/.test(heard)) {
    return {
      name: named(intention, 'Studio de jeux'),
      intention,
      objective: 'Livrer un jeu jouable avec un calendrier de production tenu.',
      sector: 'Jeux vidéo',
      businessModel: 'jeu',
      roles: [
        person('Noah', 'Petit', 'Game designer', 'Définir le jeu et son rythme.', 'Création', null, ['Game design', 'Narration'], ['curieux', 'précis']),
        person('Marc', 'Lefèvre', 'Lead développeur', 'Construire le jeu.', 'Technique', null, ['Moteur', 'Gameplay'], ['méthodique', 'calme']),
        person('Inès', 'Bernard', 'QA', 'Trouver les défauts avant la sortie.', 'Technique', 'Lead développeur', ['Tests', 'Qualité'], ['rigoureux', 'patient']),
        person('Camille', 'Rousseau', 'Producer', 'Tenir le planning et le budget.', 'Business', null, ['Production', 'Planning'], ['organisé', 'direct']),
      ],
    }
  }
  if (model === 'saas') {
    return {
      name: named(intention, 'SaaS'),
      intention,
      objective: 'Faire croître un ARR récurrent avec un produit B2B fiable.',
      sector: 'Logiciel B2B',
      businessModel: 'saas',
      roles: [
        person('Marc', 'Lefèvre', 'Chief Technology Officer', 'Tenir la plateforme et les releases.', 'Produit', null, ['Architecture', 'Livraison'], ['méthodique', 'exigeant']),
        person('Inès', 'Bernard', 'Product manager', 'Prioriser la roadmap selon la valeur client.', 'Produit', 'Chief Technology Officer', ['Discovery', 'Priorisation'], ['clair', 'curieuse']),
        person('Sarah', 'Moreau', 'Chief Marketing Officer', 'Générer une acquisition prévisible.', 'Croissance', null, ['SEO', 'Contenu', 'Demand gen'], ['créatif', 'analytique']),
        person('Thomas', 'Klein', 'Account executive', 'Closer le pipeline qualifié.', 'Revenu', null, ['Négociation', 'CRM'], ['direct', 'persuasif']),
        person('Camille', 'Rousseau', 'Customer success', 'Réduire le churn et étendre les comptes.', 'Succès client', null, ['Rétention', 'Onboarding'], ['à l’écoute', 'structuré']),
      ],
    }
  }
  if (model === 'marketplace') {
    return {
      name: named(intention, 'Marketplace'),
      intention,
      objective: 'Équilibrer offre et demande et fluidifier les transactions.',
      sector: 'Place de marché',
      businessModel: 'marketplace',
      roles: [
        person('Sarah', 'Moreau', 'Head of supply', 'Recruter et activer les offreurs.', 'Offre', null, ['Acquisition offreurs', 'Qualité'], ['persuasive', 'organisée']),
        person('Thomas', 'Klein', 'Head of demand', 'Faire venir les acheteurs.', 'Demande', null, ['Acquisition', 'Conversion'], ['analytique', 'direct']),
        person('Marc', 'Lefèvre', 'Ops marketplace', 'Sécuriser les transactions et les litiges.', 'Opérations', null, ['Ops', 'Confiance'], ['prudent', 'précis']),
        person('Inès', 'Bernard', 'Product marketplace', 'Faire matcher les deux versants.', 'Produit', null, ['Produit', 'Matching'], ['curieuse', 'méthodique']),
      ],
    }
  }
  if (model === 'ecommerce') {
    return {
      name: named(intention, 'Marque e-commerce'),
      intention,
      objective: 'Vendre en ligne avec une marge et une logistique tenues.',
      sector: /v[eê]tement|\bmode\b|textile|cosm[eé]tique/.test(intention.toLowerCase()) ? 'Mode' : 'Commerce',
      businessModel: 'ecommerce',
      roles: [
        person('Léa', 'Martin', 'Brand manager', 'Porter l’offre et le merchandising.', 'Offre', null, ['Marque', 'Catalogue'], ['créatif', 'exigeant']),
        person('Sarah', 'Moreau', 'Growth manager', 'Acquérir du trafic rentable.', 'Acquisition', null, ['Paid', 'SEO', 'Email'], ['analytique', 'énergique']),
        person('Noah', 'Petit', 'Ops e-commerce', 'Tenir stocks, livraison et SAV.', 'Opérations', null, ['Logistique', 'SAV'], ['organisé', 'calme']),
        person('Camille', 'Rousseau', 'Finance retail', 'Suivre marge, CAC et trésorerie.', 'Finance', null, ['Marge', 'Trésorerie'], ['prudent', 'précis']),
      ],
    }
  }
  if (model === 'agence') {
    return {
      name: named(intention, 'Agence'),
      intention,
      objective: 'Livrer les clients dans les délais avec une marge d’agence saine.',
      sector: 'Services',
      businessModel: 'agence',
      roles: [
        person('Sarah', 'Moreau', 'Directrice de clientèle', 'Piloter le portefeuille et les briefs.', 'Clients', null, ['Relation client', 'Pilotage'], ['clair', 'exigeant']),
        person('Marc', 'Lefèvre', 'Directeur de création', 'Tenir la qualité de production.', 'Production', null, ['Création', 'Direction artistique'], ['créatif', 'exigeant']),
        person('Inès', 'Bernard', 'Chef de projet', 'Livrer dans le temps et le budget.', 'Production', 'Directeur de création', ['Planning', 'Coordination'], ['organisé', 'calme']),
        person('Thomas', 'Klein', 'Business developer', 'Remplir le pipeline d’affaires.', 'Croissance', null, ['Prospection', 'Propositions'], ['direct', 'persuasif']),
      ],
    }
  }
  if (model === 'freelance') {
    return {
      name: named(intention, 'Studio solo'),
      intention,
      objective: 'Vendre du conseil et de la production avec une équipe courte.',
      sector: 'Conseil',
      businessModel: 'freelance',
      roles: [
        person('Alex', 'Martin', 'Fondateur', 'Vendre, livrer et prioriser.', 'Studio', null, ['Offre', 'Vente', 'Livraison'], ['direct', 'organisé']),
        person('Emma', 'Bernard', 'Ops et finance', 'Facturation, contrat et suivi.', 'Studio', 'Fondateur', ['Admin', 'Trésorerie'], ['prudent', 'méthodique']),
        person('Léa', 'Moreau', 'Production', 'Exécuter les missions clients.', 'Studio', 'Fondateur', ['Production', 'Qualité'], ['précis', 'calme']),
      ],
    }
  }
  return {
    name: named(intention, 'Organisation'),
    intention,
    objective: intention,
    sector: 'Général',
    businessModel: model,
    roles: [
      person('Marc', 'Lefèvre', 'Responsable produit', 'Transformer la demande en offre.', 'Produit', null, ['Produit', 'Priorisation'], ['clair', 'exigeant']),
      person('Inès', 'Bernard', 'Développeuse', 'Construire ce qui a été décidé.', 'Produit', 'Responsable produit', ['Développement', 'Livraison'], ['méthodique', 'précise']),
      person('Sarah', 'Moreau', 'Responsable croissance', 'Faire connaître l’offre.', 'Croissance', null, ['Acquisition', 'Message'], ['créatif', 'énergique']),
      person('Camille', 'Rousseau', 'Responsable operations', 'Faire tourner le quotidien.', 'Opérations', null, ['Process', 'Suivi'], ['organisé', 'calme']),
    ],
  }
}

function guard(intention: string, draft: OrganizationDraft): OrganizationDraft {
  const heard = intention.toLowerCase()
  const has = (pattern: RegExp) => draft.roles.some((role) => pattern.test(`${role.role} ${role.department}`.toLowerCase()))
  if (/clinique|télémédecine|telemedecine|médec|medec|santé|sante/.test(heard) && !has(/médec|medec|soin|santé|sante|infirm/)) {
    return { ...draft, roles: [draftFromIntention(intention).roles[0], ...draft.roles].slice(0, 12) }
  }
  if (/immobilier|immo/.test(heard) && !has(/vente|commercial|immobilier/)) {
    return { ...draft, roles: [draftFromIntention(intention).roles[0], ...draft.roles].slice(0, 12) }
  }
  if (/saas|abonnement/.test(heard) && !has(/tech|produit|market|sales|succ[eè]s/)) {
    return { ...draft, roles: [draftFromIntention(intention).roles[0], ...draft.roles].slice(0, 12) }
  }
  if (/marketplace|place de march/.test(heard) && !has(/offre|demand|ops|produit/)) {
    return { ...draft, roles: [draftFromIntention(intention).roles[0], ...draft.roles].slice(0, 12) }
  }
  if (/jeu|game/.test(heard) && !has(/game|créa|crea|développ|develop|tech/)) {
    return { ...draft, roles: [draftFromIntention(intention).roles[0], ...draft.roles].slice(0, 12) }
  }
  return draft
}

export const ORGANIZATION_PLAN_PROMPT = `Tu es le planificateur d'ATLAS. Tu identifies d'abord le secteur et le business model, puis tu dessines l'organisation. Tu réponds uniquement avec un objet JSON, sans texte autour.
Schéma :
{"name":"nom court","sector":"secteur","businessModel":"saas|marketplace|agence|ecommerce|freelance|clinique|immobilier|jeu|autre","objective":"une phrase d'objectif mesurable","departments":[{"name":"département","agents":[{"firstName":"prénom","lastName":"nom","role":"poste","mission":"une phrase","skills":["compétence"],"traits":["analytique"],"tone":"formel|direct|pédagogique|professionnel","hours":"9h–18h, lundi–vendredi","tools":["gmail","analytics"],"objectives":[{"label":"KPI","metric":"unité","target":"chiffre","dueAt":"2026-12-31"}],"reportsToRole":null}]}]}
Rules: 3 to 6 departments, 4 to 12 employees, English first names and last names, roles fit the craft AND the business model. Real hierarchy: reportsToRole is the exact manager role, or null for a department head. Each agent has 2 to 4 skills, 1 to 3 traits, 1 to 2 dated numeric KPIs, and 1 to 3 tools among gmail,outlook,slack,teams,google_calendar,github,gitlab,jira,linear,google_drive,notion,hubspot,stripe,analytics,n8n. Primary language of all text fields: English.
SaaS : Produit, Croissance, Revenu, Succès client. Marketplace : Offre, Demande, Ops, Produit. Agence : Clients, Production, Croissance. E-commerce : Offre, Acquisition, Ops, Finance. Clinique : soins. Immobilier : ventes. Jeux : création + technique.
N'invente aucun outil déjà connecté : tu assigns seulement les outils utiles au poste.
Le champ name est une marque courte (2 à 4 mots), jamais le début de la phrase de l'utilisateur.`
