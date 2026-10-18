import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { connectModeOf, tokenFieldsFor } from './atlas-connect-modes'
import { amdGemmaModel, amdVllmModel, amdVllmUrl } from './amd-vllm'
import { evolusConfigured, evolusHealth } from './evolus'
import { hackathonStack } from './hackathon-stack'

describe('outils de compétition', () => {
  it('pointe Nemotron Super et Gemma par défaut', () => {
    process.env.AMD_VLLM_URL = 'http://instinct.local:8000/v1'
    assert.equal(amdVllmUrl(), 'http://instinct.local:8000/v1')
    assert.equal(amdVllmModel(), 'nvidia/Nemotron-3-Super-120B-A12B')
    assert.equal(amdGemmaModel(), 'google/gemma-3-12b-it')
  })

  it('Evolus reste optionnel sans clés', async () => {
    delete process.env.EVOLUS_API_KEY
    delete process.env.EVOLUS_APP_ID
    assert.equal(connectModeOf('evolus'), 'token')
    assert.deepEqual(tokenFieldsFor('evolus').map((field) => field.key), ['EVOLUS_API_KEY', 'EVOLUS_APP_ID', 'EVOLUS_AGENT_ID'])
    if (!evolusConfigured()) {
      const health = await evolusHealth()
      assert.equal(health.ok, false)
      assert.match(health.note, /manquent/)
    }
  })

  it('stack AMD obligatoire, partenaires optionnels, NVIDIA intact', async () => {
    process.env.AMD_VLLM_URL = 'http://instinct.local:8000/v1'
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/models')) {
        return new Response(JSON.stringify({
          data: [
            { id: 'nvidia/Nemotron-3-Super-120B-A12B' },
            { id: 'google/gemma-3-12b-it' },
          ],
        }), { status: 200 })
      }
      return new Response('no', { status: 404 })
    }) as typeof fetch
    try {
      const stack = await hackathonStack()
      assert.equal(stack.required.amd.required, true)
      assert.equal(stack.required.amd.live, true)
      assert.equal(stack.partners.gemma.live, true)
      assert.equal(stack.partners.evolus.required, false)
      assert.equal(stack.nvidiaUntouched, true)
      assert.ok(stack.partners.evolus.blocks.some((item) => /summarize/i.test(item)))
    } finally {
      globalThis.fetch = original
    }
  })
})
