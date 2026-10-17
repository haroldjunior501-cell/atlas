import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createDatabase, ensureUser, materializeDraft } from '../../orchestrator/src/store'
import { PostgresState, type Sql, type SqlSession } from './postgres-state'
import { hashPassword, verifyPassword } from './passwords'

function sessionFrom(db: PGlite): SqlSession {
  const sql = (client: { query: PGlite['query']; exec: PGlite['exec'] }): Sql => ({
    query: async <T = Record<string, unknown>>(text: string, values?: unknown[]) => {
      const result = await client.query(text, values)
      return { rows: result.rows as T[] }
    },
    exec: async (text) => {
      await client.exec(text)
    },
  })
  return {
    ...sql(db),
    tx: (run) => db.transaction((tx) => run(sql(tx))),
  }
}

test('postgres keeps an organization and a password after a restart', async () => {
  const engine = new PGlite()
  const first = new PostgresState(sessionFrom(engine))
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
        permissions: [{ action: 'email.send', allowed: true, requiresApproval: false, spendLimit: null }],
      },
    ],
  })
  const agent = [...db.agents.values()][0]
  assert.ok(agent)
  db.tasks.push({
    id: 'task-1',
    organizationId: organization.id,
    agentId: agent.id,
    title: 'Préparer le brief',
    status: 'doing',
    missionId: null,
  })
  db.conversations.push({
    id: 'conversation-1',
    organizationId: organization.id,
    participantIds: [agent.id],
    kind: 'ceo_agent',
  })
  db.messages.push({
    id: 'message-1',
    conversationId: 'conversation-1',
    authorId: 'harold',
    body: 'Bonjour Sarah',
    createdAt: '2026-09-27T00:00:00.000Z',
  })
  const passwordHash = await hashPassword('atlas-demo')
  first.rememberAccount('harold', passwordHash, 'nova')
  await first.save(db)

  const second = new PostgresState(sessionFrom(engine))
  const restored = await second.load()
  assert.equal(second.runtime, 'postgres')
  assert.equal(restored.organizations.get(organization.id)?.name, 'Nova')
  assert.equal([...restored.agents.values()][0]?.skills[0], 'Growth')
  assert.equal(restored.tasks[0]?.title, 'Préparer le brief')
  assert.equal(restored.messages[0]?.body, 'Bonjour Sarah')
  const account = second.accountFor('harold@atlas.local', restored.users.values())
  assert.equal(account?.organizationName, 'nova')
  assert.equal(await verifyPassword('atlas-demo', account?.passwordHash ?? ''), true)
  assert.equal(await verifyPassword('autre', account?.passwordHash ?? ''), false)

  await second.save(restored)
  const third = await new PostgresState(sessionFrom(engine)).load()
  assert.equal(third.organizations.get(organization.id)?.name, 'Nova')
  assert.equal(third.users.size, 1)
})
