import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  alignPrices,
  assignCrew,
  countIn,
  fallbackPlan,
  median,
  perKilo,
  permissionFor,
  planFromModel,
  priceMismatches,
  pricesIn,
  readySteps,
  searchQueries,
  targetsIn,
  topicOf,
} from './crew'

const MISSION = 'Je lance une marque de café en grains. Analyse 5 concurrents comme Lavazza, Malongo, Café Joyeux, Terres de Café et Belleville Brûlerie, compare les prix et fais-moi un site de lancement.'

describe('mission d’équipe', () => {
  it('lit les cibles et le nombre demandés', () => {
    assert.deepEqual(targetsIn(MISSION), ['Lavazza', 'Malongo', 'Café Joyeux', 'Terres de Café', 'Belleville Brûlerie'])
    assert.equal(countIn('analyser cinq concurrents'), 5)
    assert.equal(countIn('analyse 3 marques'), 3)
    assert.equal(topicOf(MISSION), 'café grains')
    assert.deepEqual(searchQueries(fallbackPlan(MISSION).steps[0]!, MISSION), ['Lavazza café grains prix', 'Lavazza avis clients'])
  })

  it('monte un chercheur par concurrent, puis analyste et designer', () => {
    const plan = fallbackPlan(MISSION)
    const roles = plan.steps.map((step) => step.role)
    assert.equal(roles.filter((role) => role === 'chercheur').length, 5)
    assert.ok(roles.includes('analyste') && roles.includes('designer'))
    const analyse = plan.steps.find((step) => step.role === 'analyste')!
    assert.equal(analyse.dependsOn.length, 5)
    assert.deepEqual(plan.steps.find((step) => step.role === 'designer')!.dependsOn, ['analyse'])
    const started = new Set<string>()
    assert.equal(readySteps(plan.steps, new Set(), started).length, 5)
    const research = new Set(plan.steps.filter((step) => step.role === 'chercheur').map((step) => step.id))
    assert.deepEqual(readySteps(plan.steps, research, research).map((step) => step.id), ['analyse'])
  })

  it('accepte le plan du modèle et répare ses dépendances', () => {
    const plan = planFromModel(`Voici : {"summary":"7 agents","steps":[
      {"id":"r1","role":"Chercheur","title":"Lavazza","target":"Lavazza","brief":"Relève les prix de Lavazza en grains","dependsOn":[]},
      {"id":"r2","role":"chercheur","title":"Malongo","brief":"Relève les prix de Malongo en grains","dependsOn":["r1"]},
      {"id":"a","role":"analyst","title":"Tableau","brief":"Compare les prix au kilo","dependsOn":["inconnu"]},
      {"id":"x","role":"pilote","brief":"rôle inconnu ignoré"}]}`, MISSION)!
    assert.equal(plan.steps.length, 3)
    assert.deepEqual(plan.steps[2]!.dependsOn, ['r1', 'r2'])
    assert.equal(planFromModel('pas de json', MISSION), null)
  })

  it('confie chaque métier au poste le plus proche, en répartissant la charge', () => {
    const plan = fallbackPlan(MISSION)
    const map = assignCrew(plan.steps, [
      { id: 'lea', name: 'Léa', role: 'Brand manager' },
      { id: 'sarah', name: 'Sarah', role: 'Growth manager' },
      { id: 'camille', name: 'Camille', role: 'Finance retail' },
    ])
    assert.equal(map.analyse, 'camille')
    const researchers = plan.steps.filter((step) => step.role === 'chercheur').map((step) => map[step.id])
    assert.ok(researchers.includes('lea') && researchers.includes('sarah'))
  })

  it('calcule les prix au kilo et la médiane', () => {
    const hits = pricesIn('Lavazza Qualità Oro grains 1 kg 26,95 € — Crema e Gusto 500 g 9,90 €')
    assert.deepEqual(hits.map((hit) => hit.value), [26.95, 9.9])
    assert.equal(perKilo(hits[0]!), 26.95)
    assert.equal(perKilo(hits[1]!), 19.8)
    assert.equal(median([33.6, 26.95, 81.8, 39.45]), 36.53)
  })

  it('le chef repère les prix non alignés et corrige le site tout seul', () => {
    const html = '<h2>Le Matin</h2><p>250 g <b>11,90 €</b></p><p>1 kg <b>39,90 €</b></p><small>Livraison offerte</small>'
    const recs = [{ label: 'Le Matin 250 g', value: 14.9 }, { label: 'Le Matin 1 kg', value: 47.9 }]
    const issues = priceMismatches(recs, html)
    assert.deepEqual(issues.map((item) => [item.expected, item.found]), [[14.9, 11.9], [47.9, 39.9]])
    const fixed = alignPrices(html, issues)
    assert.match(fixed, /14,90 €/)
    assert.match(fixed, /47,90 €/)
    assert.deepEqual(priceMismatches(recs, fixed), [])
  })

  it('lève la main avant une action sensible', () => {
    assert.match(permissionFor('Envoie la newsletter par Gmail aux clients') ?? '', /accord.*Gmail/)
    assert.equal(permissionFor('Rédige trois posts LinkedIn'), undefined)
  })
})
