import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectArchetype } from './office-archetype'
import { draftFromIntention } from './organization-plan'
import { businessModelOf } from './agent-kit'
import { fallbackPlan } from './crew'
import { isZtcOrganization, lockToZtc, missingZtcDesks, ztcCompany, ztcDeskForService, ztcDeskOf, ztcScopeOf, ztcSkillsOf, ztcSpecialistDeskOf, ztcWorkflowOf, ZTC_DEPARTMENTS, ZTC_PRODUCTS } from './ztc-hosting'

describe('ZTC Hosting', () => {
  it('reconnaît l’hébergeur plutôt qu’une startup tech', () => {
    assert.equal(detectArchetype({ name: 'ZTC Hosting', sector: 'Hébergement web', intention: 'Orchestrer ZTC Hosting' }), 'hosting')
    assert.equal(businessModelOf('Associe ATLAS à ZTC Hosting et WHM'), 'hosting')
  })

  it('monte l’équipe du dossier, sans inventer un serveur HP', () => {
    const draft = draftFromIntention('ATLAS orchestre ZTC Hosting : support, WHM, domaines, facturation')
    assert.equal(draft.name, 'ZtcHosting')
    assert.ok(draft.roles.some((role) => role.firstName === 'Nova' && /Support/.test(role.role)))
    assert.ok(draft.roles.some((role) => role.firstName === 'Vega' && /WHM/.test(role.role)))
    assert.ok(draft.roles.some((role) => role.firstName === 'Ledger'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Radar'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Aegis'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Swift'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Flare'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Clip'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Boost'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Muse'))
    assert.ok(draft.roles.some((role) => role.firstName === 'Funnel' && /Flux visiteurs/.test(role.department)))
    assert.ok(!/160 ?Go|3 ?To/i.test(JSON.stringify(draft)))
  })

  it('qualifie l’organisation ZTC', () => {
    assert.equal(isZtcOrganization('ZTC Hosting', 'Hébergement web'), true)
    assert.equal(isZtcOrganization('Veut Marque Vêtement', 'Mode'), false)
  })

  it('cartographie la boutique publique sans inventer le VPS', () => {
    assert.ok(ZTC_PRODUCTS.some((item) => item.id === 'hosting-business' && /5,99/.test(item.publicNote)))
    assert.equal(ZTC_PRODUCTS.find((item) => item.id === 'vps')?.status, 'to_confirm')
    assert.equal(ztcDeskOf('mon site est lent')?.firstName, 'Swift')
    assert.equal(ztcDeskOf('renouvellement facture')?.firstName, 'Ledger')
    assert.equal(ztcDeskOf('scan des en-têtes TLS')?.firstName, 'Radar')
    assert.equal(ztcDeskOf('recherche de vulnérabilité HSTS')?.firstName, 'Aegis')
    assert.equal(ztcDeskOf('visuel publicitaire Business Hosting')?.firstName, 'Flare')
    assert.equal(ztcDeskOf('vidéo promo Starter Hosting')?.firstName, 'Clip')
    assert.equal(ztcDeskOf('augmenter le trafic vers /order')?.firstName, 'Boost')
    assert.equal(ztcDeskOf('rédige des accroches campagne')?.firstName, 'Muse')
    assert.equal(ztcDeskOf('rapport flux visiteurs et prospects')?.firstName, 'Funnel')
    assert.equal(ztcDeskOf('escalade au support client')?.firstName, 'Nova')
    assert.equal(ztcSpecialistDeskOf('mon DNS ne pointe pas')?.firstName, 'Lyra')
    assert.equal(ztcSpecialistDeskOf('problème cPanel SSL WordPress')?.firstName, 'Vega')
    assert.equal(ztcSpecialistDeskOf('facture et remboursement')?.firstName, 'Ledger')
    assert.equal(ztcSpecialistDeskOf('boîte mail webmail SMTP')?.firstName, 'Echo')
    assert.equal(ztcDeskForService('domain_dns')?.firstName, 'Lyra')
    assert.equal(ztcDeskForService('hosting')?.firstName, 'Vega')
    assert.equal(ztcDeskOf('DNS nameserver pour mon domaine')?.firstName, 'Lyra')
    assert.equal(ztcDeskOf('site down cPanel hébergement')?.firstName, 'Vega')
    assert.deepEqual(ztcScopeOf('Radar').datasets, ['headers', 'devoid', 'company'])
    assert.ok(!ztcScopeOf('Sage').datasets.includes('catalog'))
    assert.ok(ztcScopeOf('Lyra').devoidTools.includes('create_dns_record'))
    assert.ok(ztcScopeOf('Lyra').devoidTools.includes('prepare_purchase_domain'))
    assert.ok(ztcScopeOf('Vega').devoidTools.includes('prepare_install_wordpress'))
    assert.ok(ztcScopeOf('Vega').devoidTools.includes('prepare_purchase_hosting'))
    assert.ok(ztcScopeOf('Echo').devoidTools.includes('prepare_create_email_account'))
    assert.ok(ztcScopeOf('Ledger').devoidTools.includes('get_customer_invoices'))
    assert.ok(ztcScopeOf('Muse').devoidTools.includes('prepare_purchase_hosting'))
    assert.ok(ztcSkillsOf('Lyra').some((s) => /DNS|domaine/i.test(s)))
  })

  it('monte une mission ZTC en preuve + diagnostic + runbook', () => {
    const plan = fallbackPlan('Ticket ZTC : mon site est lent, lis WHM en lecture seule')
    assert.deepEqual(plan.steps.map((step) => step.id), ['r-speed', 'analyse', 'runbook'])
    const ads = fallbackPlan('Campagne publicitaire ZTC Hosting Business')
    assert.deepEqual(ads.steps.map((step) => step.id), ['r-boutique', 'copy', 'crea'])
    const video = fallbackPlan('Vidéo promo Starter Hosting')
    assert.deepEqual(video.steps.map((step) => step.id), ['r-boutique', 'story', 'film'])
    const traffic = fallbackPlan('Plan trafic SEO vers /order')
    assert.deepEqual(traffic.steps.map((step) => step.id), ['r-boutique', 'plan', 'copy'])
    const funnel = fallbackPlan('Rapport flux visiteurs et prospects ztchosting')
    assert.deepEqual(funnel.steps.map((step) => step.id), ['r-hits', 'qualify', 'report'])
  })

  it('renvoie toute autre agence vers l’équipe ZTC déjà construite', () => {
    assert.match(lockToZtc('Crée une clinique de télémédecine'), /ZTC Hosting/)
    assert.match(lockToZtc('Crée un SaaS de cybersécurité'), /ZTC Hosting/)
    const draft = draftFromIntention(lockToZtc('monte une agence marketing'))
    assert.equal(draft.name, 'ZtcHosting')
    assert.ok(draft.roles.some((role) => role.firstName === 'Nova'))
  })

  it('expose le bureau comme une entreprise, pas comme un second orchestrateur', () => {
    const company = ztcCompany()
    assert.match(company.rule, /ATLAS orchestre/)
    assert.match(company.rule, /DEVOID/)
    assert.equal(company.desks.length, 20)
    assert.ok(company.desks.some((desk) => desk.firstName === 'Devoid'))
    assert.ok(company.desks.some((desk) => desk.firstName === 'Clip'))
    assert.ok(company.desks.some((desk) => desk.firstName === 'Boost'))
    assert.ok(company.desks.some((desk) => desk.firstName === 'Muse'))
    assert.ok(company.desks.some((desk) => desk.firstName === 'Funnel'))
    assert.equal(ztcDeskOf('widget DEVOID du site')?.firstName, 'Devoid')
    assert.deepEqual([...company.journey], ['Commande', 'Paiement', 'Provisionnement', 'DNS / SSL', 'Livraison'])
    assert.equal(company.products.find((item) => item.id === 'vps')?.status, 'to_confirm')
  })

  it('place chaque poste dans un vrai département avec compétences live', () => {
    assert.equal(ZTC_DEPARTMENTS.Radar, 'Sécurité')
    assert.equal(ZTC_DEPARTMENTS.Swift, 'Performance')
    assert.equal(ZTC_DEPARTMENTS.Flare, 'Marketing')
    assert.equal(ZTC_DEPARTMENTS.Clip, 'Marketing')
    assert.equal(ZTC_DEPARTMENTS.Boost, 'Marketing')
    assert.equal(ZTC_DEPARTMENTS.Muse, 'Marketing')
    assert.equal(ZTC_DEPARTMENTS.Funnel, 'Flux visiteurs')
    assert.deepEqual(missingZtcDesks(['Nova', 'Vega']), [
      'Devoid', 'Orion', 'Lyra', 'Echo', 'Helix', 'Cipher', 'Ledger', 'Forge', 'Pulse', 'Sage', 'Radar', 'Aegis', 'Swift', 'Flare', 'Clip', 'Boost', 'Muse', 'Funnel',
    ])
    assert.ok(ztcSkillsOf('Radar').some((skill) => /En-têtes|Scan|TLS/i.test(skill)))
    assert.match(ztcWorkflowOf('Flare'), /FOSSBilling|prix|SKU|image/i)
    assert.match(ztcWorkflowOf('Clip'), /vid[eé]o|promo/i)
    assert.match(ztcWorkflowOf('Boost'), /trafic|order/i)
    assert.match(ztcWorkflowOf('Funnel'), /visiteur|prospect|rapport/i)
    const draft = draftFromIntention(lockToZtc('ZTC'))
    assert.equal(draft.roles.find((role) => role.firstName === 'Swift')?.department, 'Performance')
    assert.equal(draft.roles.find((role) => role.firstName === 'Flare')?.department, 'Marketing')
    assert.equal(draft.roles.find((role) => role.firstName === 'Funnel')?.department, 'Flux visiteurs')
    assert.equal(draft.roles.length, 20)
  })
})
