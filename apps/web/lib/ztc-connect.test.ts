import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { connectModeOf, tokenFieldsFor } from './atlas-connect-modes'
import { ingestForDesk, ingestLines, serviceUrl, ztcIngest } from './ztc-connect'

describe('pont ZTC → LLM', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ztc-ingest-'))
  before(() => {
    process.env.ZTC_INGEST_PATH = join(dir, 'facts.json')
  })
  after(() => {
    delete process.env.ZTC_INGEST_PATH
    rmSync(dir, { recursive: true, force: true })
  })

  it('Relier ZTC est un formulaire d’URL, pas un MCP générique', () => {
    assert.equal(connectModeOf('ztc_core'), 'token')
    assert.equal(connectModeOf('devoid'), 'token')
    assert.deepEqual(tokenFieldsFor('ztc_core').map((field) => field.key), ['ZTC_CORE_API', 'ZTC_BRIDGE_TOKEN'])
    assert.ok(tokenFieldsFor('fossbilling').some((field) => field.key === 'ZTC_FOSSBILLING_URL'))
  })

  it('refuse les URL avec mot de passe', () => {
    assert.equal(serviceUrl('https://user:secret@ztchosting.com/api'), '')
    assert.equal(serviceUrl('https://ztchosting.com/devoid-api'), 'https://ztchosting.com/devoid-api')
  })

  it('n’accepte que des faits observés, et les filtre par bureau', () => {
    const stored = ztcIngest('Radar', 'devoid', [
      { label: 'CSP', value: 'absente', source: 'https://ztchosting.com/', certainty: 'observed' },
      { label: 'prix inventé', value: '1 $', source: 'tête', certainty: 'planned' },
    ])
    assert.equal(stored.accepted, 1)
    assert.equal(ingestForDesk('Radar').length, 1)
    assert.equal(ingestForDesk('Sage').length, 0)
    assert.match(ingestLines('Radar'), /CSP/)
  })
})
