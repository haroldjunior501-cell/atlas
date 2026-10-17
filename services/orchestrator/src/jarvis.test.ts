import assert from 'node:assert/strict'
import test from 'node:test'
import { AtlasOrchestrator } from './orchestrator'
import { interpret, runJarvis } from './jarvis'

test('wake word is ignored and a team request composes the organization', async () => {
  const atlas = new AtlasOrchestrator()
  const result = await runJarvis(atlas, 'harold', 'Jarvis, monte une équipe cybersécurité')
  assert.equal(result.intent, 'compose')
  assert.equal(atlas.db.organizations.size, 1)
  assert.match(result.reply, /prennent leur poste/)
})

test('briefing speaks the organization the CEO just composed', async () => {
  const atlas = new AtlasOrchestrator()
  await runJarvis(atlas, 'harold', 'monte une équipe')
  const result = await runJarvis(atlas, 'harold', 'Jarvis, briefing')
  assert.equal(result.intent, 'brief')
  assert.match(result.reply, /Bonjour/)
})

test('an empty call only listens', () => {
  assert.equal(interpret('Jarvis'), 'listen')
})

test('approval words are not mistaken for a new organization', () => {
  assert.equal(interpret('Jarvis approuve'), 'approve')
  assert.equal(interpret('montre l’équipe'), 'team')
})
