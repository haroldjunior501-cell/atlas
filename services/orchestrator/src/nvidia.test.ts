import assert from 'node:assert/strict'
import test from 'node:test'
import { forecastLoad, localReply, nvidiaRuntime } from './nvidia'

test('a busy agent is marked overloaded by the local estimator', async () => {
  const result = await forecastLoad([
    { role: 'CMO', openTasks: 6, costEur: 4, latencyMs: 400 },
    { role: 'CFO', openTasks: 1, costEur: 1, latencyMs: 200 },
  ])
  assert.equal(result.engine, 'local')
  assert.equal(result.items[0]?.overloaded, true)
  assert.equal(result.items[1]?.overloaded, false)
})

test('the reply names the team and the calm load', () => {
  const text = localReply(
    [{ firstName: 'Sarah', role: 'Chief Marketing Officer' }],
    [{ role: 'Chief Marketing Officer', score: 0.1, overloaded: false }],
  )
  assert.match(text, /Sarah/)
  assert.match(text, /Aucun employé/)
})

test('ACE expose le pipeline écouter-penser-parler', () => {
  assert.deepEqual([...nvidiaRuntime().ace.pipeline], ['listen', 'think', 'speak'])
})
