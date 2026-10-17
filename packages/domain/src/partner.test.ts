import assert from 'node:assert/strict'
import test from 'node:test'
import { memoryCategoryOf, researchModeOf, PARTNER_CAPABILITIES } from './partner'

test('research modes détectent emploi, hôtel, compare', () => {
  assert.equal(researchModeOf('offre d’emploi développeur React'), 'job')
  assert.equal(researchModeOf('alternance marketing digital'), 'internship')
  assert.equal(researchModeOf('hôtels centre Lyon'), 'hotel')
  assert.equal(researchModeOf('compare iPhone et Pixel'), 'compare')
  assert.equal(researchModeOf('qui est l’entreprise Nebius'), 'company')
})

test('mémoire catégories et catalogue partenaire', () => {
  assert.equal(memoryCategoryOf('je préfère le tutoiement'), 'preference')
  assert.equal(memoryCategoryOf('mon objectif est de réussir mon examen'), 'goal')
  assert.ok(PARTNER_CAPABILITIES.length >= 20)
  assert.ok(PARTNER_CAPABILITIES.some((item) => item.domain === 'tutor'))
  assert.ok(PARTNER_CAPABILITIES.some((item) => item.domain === 'coding'))
})
