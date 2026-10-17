import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWebsiteHtml, parseSiteBrief, pickTheme } from './atlas-website'
import { interpretAtlas } from './atlas-voice'

test('choisit un thème selon le sujet', () => {
  assert.equal(pickTheme('parfum de luxe').id, 'nocturne')
  assert.equal(pickTheme('saas fintech').id, 'signal')
  assert.equal(pickTheme('festival sport').id, 'kinetic')
  assert.equal(pickTheme('studio architecture').id, 'atelier')
})

test('parse un brief JSON et produit un HTML brand-first', () => {
  const brief = parseSiteBrief(JSON.stringify({
    brand: 'Nimbus',
    tagline: 'Clarté nette',
    headline: 'L’outil qui respire',
    subhead: 'Moins de bruit, plus de décisions.',
    cta: 'Essayer',
    ctaSecondary: 'Voir la démo',
    theme: 'signal',
    sections: [
      { title: 'Produit', body: 'Un cockpit simple.', points: ['Vue unique', 'Alertes utiles'] },
      { title: 'Pourquoi', body: 'Parce que le temps compte.', points: ['Rapide', 'Sobre'] },
      { title: 'Suite', body: 'On démarre ensemble.', points: ['Brief', 'Livraison'] },
    ],
    footer: '© Nimbus',
  }), 'saas')

  assert.equal(brief.brand, 'Nimbus')
  assert.equal(brief.theme, 'signal')
  const html = buildWebsiteHtml(brief)
  assert.match(html, /<h1>L’outil qui respire<\/h1>/)
  assert.match(html, /Nimbus/)
  assert.match(html, /Syne/)
  assert.match(html, /min-height:\s*100svh/)
  assert.doesNotMatch(html, /\bInter\b|\bRoboto\b|\bArial\b/)
})

test('la voix route « site hyper stylé » vers draft website', () => {
  const action = interpretAtlas('crée un site web hyper stylé pour une marque de café')
  assert.equal(action.kind, 'draft')
  if (action.kind === 'draft') {
    assert.equal(action.format, 'website')
    assert.match(action.topic, /café|cafe/i)
  }
  const landing = interpretAtlas('fais une landing page pour mon studio photo')
  assert.equal(landing.kind, 'draft')
  if (landing.kind === 'draft') assert.equal(landing.format, 'website')
})
