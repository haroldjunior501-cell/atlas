import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPptxBuffer, parsePresentationDeck } from './atlas-create'
import { isImageRequest } from './atlas-docwork'
import { interpretAtlas } from './atlas-voice'

test('parse un deck JSON ou markdown', () => {
  const json = parsePresentationDeck(
    '{"title":"Lancement","slides":[{"title":"Vision","bullets":["A","B"]},{"title":"Roadmap","bullets":["Q1"]}]}',
    'Fallback',
  )
  assert.equal(json.title, 'Lancement')
  assert.equal(json.slides.length, 2)
  assert.equal(json.slides[0].title, 'Vision')

  const md = parsePresentationDeck(
    '## Marché\n- Taille\n- Croissance\n\n## Offre\n- Produit\n- Prix',
    'Deck',
  )
  assert.ok(md.slides.length >= 2)
})

test('buildPptxBuffer produit un fichier OOXML', async () => {
  const buffer = await buildPptxBuffer({
    title: 'Test ATLAS',
    slides: [
      { title: 'Intro', bullets: ['Un', 'Deux'] },
      { title: 'Suite', bullets: ['Trois'] },
    ],
  })
  assert.ok(buffer.length > 2000)
  assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK')
})

test('intent image et présentation', () => {
  assert.equal(isImageRequest('génère une image d’une robe rouge'), true)
  assert.equal(interpretAtlas('génère une image d’une robe rouge').kind, 'image')
  assert.equal(interpretAtlas('prépare une présentation sur la cybersécurité').kind, 'draft')
  const draft = interpretAtlas('crée une présentation pitch startup')
  assert.equal(draft.kind, 'draft')
  if (draft.kind === 'draft') assert.equal(draft.format, 'presentation')
})
