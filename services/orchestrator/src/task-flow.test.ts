import assert from 'node:assert/strict'
import test from 'node:test'
import { AtlasOrchestrator } from './orchestrator'

test('une tâche suit son flux et la présence de l’agent avec elle', async () => {
  const previousKey = process.env.NVIDIA_API_KEY
  delete process.env.NVIDIA_API_KEY
  try {
    const atlas = new AtlasOrchestrator()
    const created = await atlas.createOrganization('harold', 'Une équipe produit.')
    const agent = created.agents[0]!
    atlas.updatePermissions('harold', agent.id, 'autonomous', agent.permissions.map((p) => ({ ...p, allowed: true, requiresApproval: false })))
    const result = atlas.submitCommand('harold', {
      organizationId: created.organization.id,
      agentId: agent.id,
      text: 'Analyse le marché suisse',
      action: { type: agent.permissions[0]!.action, kind: 'analyze', amount: null },
    })
    assert.equal(result?.outcome, 'allowed')
    const task = result!.task!
    assert.equal(atlas.db.agents.get(agent.id)?.presence, 'working')

    const done = atlas.updateTask('harold', task.id, 'done')
    assert.equal(done?.status, 'done')
    assert.equal(atlas.db.agents.get(agent.id)?.presence, 'online')
    assert.ok(atlas.db.audit.some((entry) => entry.action === 'task.done' && entry.reason === 'Analyse le marché suisse'))
    assert.equal(atlas.updateTask('harold', 'inconnue', 'done'), null)
  } finally {
    if (previousKey !== undefined) process.env.NVIDIA_API_KEY = previousKey
  }
})
