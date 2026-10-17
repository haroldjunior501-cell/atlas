import assert from 'node:assert/strict'
import test from 'node:test'
import {
  detectExtractFocus,
  detectTransformOp,
  extractInlineSource,
  extractSaveAs,
  extractSourceFile,
  isExtractRequest,
  isImageRequest,
  isTransformRequest,
  transformFileExt,
} from './atlas-docwork'

test('détecte extract / transform et les formats', () => {
  assert.equal(isExtractRequest('extrais les chiffres du fichier Budget'), true)
  assert.equal(isTransformRequest('passe ce document en html'), true)
  assert.equal(detectExtractFocus('liste les actions du CR'), 'actions')
  assert.equal(detectTransformOp('convertis en csv'), 'csv')
  assert.equal(detectTransformOp('traduis en anglais'), 'translate')
  assert.equal(extractSourceFile('extrais les dates du fichier Orelle.txt'), 'Orelle.txt')
  assert.equal(extractSaveAs('transforme Brief en markdown et sauvegarde comme Sortie'), 'Sortie')
  assert.equal(transformFileExt('json'), 'json')
  assert.equal(transformFileExt('reformulate'), 'txt')
  assert.match(extractInlineSource('reformule : Ceci est un long texte à reformuler pour le test Atlas.') || '', /long texte/)
  assert.equal(isImageRequest('dessine un logo minimaliste bleu'), true)
  assert.equal(isImageRequest('crée un fichier nommé Orelle'), false)
})
