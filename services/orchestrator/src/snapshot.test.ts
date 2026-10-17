import assert from 'node:assert/strict'
import test from 'node:test'
import { databaseFromSnapshot, snapshotDatabase } from './snapshot'
import { createDatabase, ensureUser, materializeDraft } from './store'

test('an organization survives a cloud snapshot', () => {
  const db = createDatabase()
  ensureUser(db, 'harold')
  const organization = materializeDraft(db, 'harold', {
    name: 'Nova',
    intention: 'Une entreprise de cybersécurité.',
    objective: null,
    roles: [
      {
        firstName: 'Sarah',
        lastName: 'Moreau',
        role: 'CMO',
        mission: 'Croissance',
        skills: ['Growth'],
        traits: ['stratégique'],
        department: 'Marketing',
        reportsToRole: null,
        delegation: 'autonomous',
        permissions: [],
      },
    ],
  })

  const restored = databaseFromSnapshot(snapshotDatabase(db))

  assert.equal(restored.organizations.get(organization.id)?.name, 'Nova')
  assert.equal(restored.users.get('harold')?.email, 'harold@atlas.local')
  assert.equal([...restored.agents.values()].filter((agent) => agent.organizationId === organization.id).length, 1)
  assert.equal(restored.audit.filter((entry) => entry.organizationId === organization.id).length, 1)
})
