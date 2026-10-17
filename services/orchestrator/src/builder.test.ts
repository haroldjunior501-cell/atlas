import assert from 'node:assert/strict'
import test from 'node:test'
import { AtlasOrchestrator } from './orchestrator'

test('the organization builder moves, links and removes employees', async () => {
  const atlas = new AtlasOrchestrator()
  const created = await atlas.createOrganization('harold', 'Une équipe marketing et produit.')
  const [first, second] = created.agents
  assert.ok(first && second)

  const moved = atlas.updateAgent('harold', second.id, {
    role: 'Responsable contenu',
    departmentName: 'Contenu',
    reportsToId: first.id,
  })
  assert.equal(moved?.role, 'Responsable contenu')
  assert.equal(moved?.reportsToId, first.id)
  assert.equal(atlas.chart(created.organization.id)?.departments.some((item) => item.name === 'Contenu'), true)

  assert.throws(
    () => atlas.updateAgent('harold', first.id, { reportsToId: second.id }),
    /dépend de lui/,
  )

  const link = atlas.collaborate('harold', created.organization.id, first.id, second.id)
  assert.equal(link?.kind, 'collaborates')
  assert.equal(atlas.collaborate('harold', created.organization.id, second.id, first.id)?.id, link?.id)

  const department = atlas.createDepartment('harold', created.organization.id, 'Juridique')
  assert.equal(atlas.removeDepartment('harold', department.id), true)
  assert.equal(atlas.removeAgent('harold', second.id), true)
  assert.equal(atlas.chart(created.organization.id)?.relations.length, 0)
})
