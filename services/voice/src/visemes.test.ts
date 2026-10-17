import assert from 'node:assert/strict'
import test from 'node:test'
import { ARKIT_BLENDSHAPES, mayaAceClip, visemesFromSpeech, VOICE_PIPELINE } from './visemes'

test('le pipeline vocal est écouter, penser, parler', () => {
  assert.deepEqual([...VOICE_PIPELINE], ['listen', 'think', 'speak'])
})

test('une phrase produit des visèmes Audio2Face et un clip Maya-ACE', () => {
  const frames = visemesFromSpeech('Bonjour Atlas')
  assert.ok(frames.length > 8)
  assert.equal(frames[0]?.weights.length, ARKIT_BLENDSHAPES.length)
  assert.ok(frames.some((frame) => frame.viseme === 'aa' || frame.viseme === 'oh' || frame.viseme === 'ou'))
  assert.ok(frames.every((frame) => typeof frame.charIndex === 'number'))
  const clip = mayaAceClip('Bonjour Atlas', 'Hortense')
  assert.equal(clip.player, 'maya-ace-a2f')
  assert.equal(clip.voiceId, 'Hortense')
  assert.equal(clip.frames.length, frames.length)
  assert.ok(clip.durationMs > 100)
  // "ou" digraph in Bonjour → rounded mouth, not open "aa"
  assert.ok(frames.some((frame) => frame.viseme === 'ou'))
})

test('un silence ne casse pas le lecteur de visage', () => {
  const clip = mayaAceClip('   ')
  assert.equal(clip.visemes[0]?.viseme, 'sil')
  assert.equal(clip.frames[0]?.length, 52)
})
