import assert from 'node:assert/strict'
import test from 'node:test'
import { absorbAnswer, composeIntention, isIntakeCancel, nextIntakeSlot } from './atlas-intake'

test('un SaaS déjà précisé n’attend plus de brief', () => {
  assert.equal(nextIntakeSlot('Crée un SaaS B2B de cybersécurité en abonnement'), null)
})

test('une demande trop courte pose les questions dans l’ordre', () => {
  assert.equal(nextIntakeSlot('Crée une entreprise'), 'sector')
  const afterSector = absorbAnswer({ base: 'Crée une entreprise' }, 'cybersécurité')
  assert.equal(nextIntakeSlot(composeIntention(afterSector)), null)
})

test('une équipe déjà ciblée suffit pour lancer le plan', () => {
  assert.equal(nextIntakeSlot('Monte une équipe cybersécurité pour des PME'), null)
})

test('une marque de vêtements est un besoin complet, quel que soit le secteur', () => {
  assert.equal(nextIntakeSlot('je veut crée une marque de vêtement pour femme'), null)
  assert.equal(nextIntakeSlot('Je veux créer une marque de vêtement pour femme. Secteur : c’est une mode'), null)
  assert.equal(nextIntakeSlot('Crée une boîte de livraison de sushis à Lyon'), null)
})

test('annuler le brief est reconnu', () => {
  assert.equal(isIntakeCancel('annule'), true)
  assert.equal(isIntakeCancel('ouvre les missions'), false)
})
