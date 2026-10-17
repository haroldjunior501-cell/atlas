import assert from 'node:assert/strict'
import test from 'node:test'
import { draftFromIntention, kitFor, parseOrganizationPlan } from '@atlas/domain'

test('une clinique et une agence immobilière ne donnent pas la même équipe', () => {
  const clinic = draftFromIntention('Crée une clinique de télémédecine pour patients âgés')
  const agency = draftFromIntention('Crée une agence immobilière de luxe à Paris')
  const saas = draftFromIntention('Crée un SaaS B2B de cybersécurité en abonnement')
  const market = draftFromIntention('Crée une marketplace qui met en relation artisans et clients')
  assert.notEqual(clinic.name, 'Nouvelle organisation')
  assert.notEqual(agency.name, clinic.name)
  assert.ok(clinic.roles.some((role) => /médec|infirm/i.test(role.role)))
  assert.ok(agency.roles.some((role) => /immobilier|commercial/i.test(role.role)))
  assert.equal(saas.businessModel, 'saas')
  assert.ok(saas.roles.some((role) => /marketing|success|technology|product/i.test(`${role.role} ${role.department}`)))
  assert.equal(market.businessModel, 'marketplace')
  assert.ok(saas.roles[0]?.objectives?.length)
  assert.ok(saas.roles[0]?.toolIds?.length)
  const cmo = kitFor('Sarah', 'Moreau', 'CMO', 'Marketing')
  assert.ok(cmo.objectives.length)
  assert.ok(cmo.toolIds.includes('analytics'))
  assert.equal(cmo.voiceId, 'Hortense')
  assert.notDeepEqual(clinic.roles.map((role) => role.role), agency.roles.map((role) => role.role))
  assert.notDeepEqual(saas.roles.map((role) => role.role), market.roles.map((role) => role.role))
})

test('un JSON d’organisation est accepté et un JSON cassé est refusé', () => {
  const parsed = parseOrganizationPlan(JSON.stringify({
    name: 'IndieGameStudio',
    objective: 'Créer un jeu',
    departments: [
      { name: 'Création', agents: [{ firstName: 'Noah', lastName: 'Petit', role: 'Game designer', mission: 'Définir le jeu', skills: ['Design'], traits: ['curieux'], reportsToRole: null }] },
      { name: 'Technique', agents: [{ firstName: 'Marc', lastName: 'Lefèvre', role: 'Lead développeur', mission: 'Construire le jeu', skills: ['Code'], traits: ['calme'], reportsToRole: null }] },
    ],
  }), 'studio de jeux')
  assert.equal('draft' in parsed, true)
  if ('draft' in parsed) assert.equal(parsed.draft.roles.length, 2)
  assert.equal('error' in parseOrganizationPlan('pas de json', 'studio'), true)
})
