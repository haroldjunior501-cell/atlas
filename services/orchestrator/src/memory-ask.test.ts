import assert from 'node:assert/strict'
import test from 'node:test'
import { AtlasOrchestrator } from './orchestrator'

test('a question crosses memory before the model, then the reply is stored', async () => {
  const previousKey = process.env.NVIDIA_API_KEY
  const previousFetch = globalThis.fetch
  const bodies: string[] = []
  process.env.NVIDIA_API_KEY = 'test-key'
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(String(init?.body ?? ''))
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Marc suit le produit.' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const atlas = new AtlasOrchestrator()
    const created = await atlas.createOrganization('harold', 'Une équipe produit.')
    const first = await atlas.askMemory('harold', created.organization.id, 'Qui suit le produit ?')
    assert.equal(first?.source, 'nim')
    assert.equal(first?.reply, 'Marc suit le produit.')
    assert.match(bodies[0] ?? '', /Marc Lefèvre/)
    assert.match(bodies[0] ?? '', /Qui suit le produit/)

    const second = await atlas.askMemory('harold', created.organization.id, 'Et ensuite ?')
    assert.equal(second?.source, 'nim')
    assert.match(bodies[1] ?? '', /Marc suit le produit/)

    const thread = atlas.db.conversations.find((item) => item.kind === 'briefing')
    assert.ok(thread)
    const stored = atlas.db.messages.filter((message) => message.conversationId === thread.id)
    assert.equal(stored.length, 4)
    assert.equal(await atlas.askMemory('sarah', created.organization.id, 'Qui suit le produit ?'), null)
  } finally {
    globalThis.fetch = previousFetch
    if (previousKey === undefined) delete process.env.NVIDIA_API_KEY
    else process.env.NVIDIA_API_KEY = previousKey
  }
})

test('without a model the answer still comes from organization memory', async () => {
  const previousKey = process.env.NVIDIA_API_KEY
  delete process.env.NVIDIA_API_KEY
  try {
    const atlas = new AtlasOrchestrator()
    const created = await atlas.createOrganization('harold', 'Une équipe produit.')
    const result = await atlas.askMemory('harold', created.organization.id, 'Où en est l’équipe ?')
    assert.equal(result?.source, 'local')
    assert.match(result?.reply ?? '', /Marc/)
    assert.match(result?.reply ?? '', /mémoire/)
  } finally {
    if (previousKey === undefined) delete process.env.NVIDIA_API_KEY
    else process.env.NVIDIA_API_KEY = previousKey
  }
})
