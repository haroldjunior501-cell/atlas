import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createDatabase } from '@atlas/orchestrator'
import { createCloudState } from './state-store'

test('a local cloud file keeps the organization after a restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-state-'))
  try {
    const first = createCloudState({ ATLAS_STATE_DIR: directory })
    const db = createDatabase()
    db.organizations.set('org-1', {
      id: 'org-1',
      ownerId: 'harold',
      name: 'Nova',
      intention: 'Cybersécurité',
      objective: null,
    })
    await first.save(db)

    const second = createCloudState({ ATLAS_STATE_DIR: directory })
    const restored = await second.load()
    assert.equal(second.runtime, 'local')
    assert.equal(restored.organizations.get('org-1')?.name, 'Nova')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('local auth accounts survive a restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-accounts-'))
  try {
    const first = createCloudState({ ATLAS_STATE_DIR: directory })
    const db = createDatabase()
    db.users.set('u1', { id: 'u1', name: 'Ada', email: 'ada@atlas.test' })
    first.rememberAccount?.('u1', 'hash', 'Ada Org')
    await first.save(db)

    const second = createCloudState({ ATLAS_STATE_DIR: directory })
    await second.load()
    const account = second.accountFor?.('ada@atlas.test', db.users.values())
    assert.equal(account?.organizationName, 'Ada Org')
    assert.equal(account?.passwordHash, 'hash')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
