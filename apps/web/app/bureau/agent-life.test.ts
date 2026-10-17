import assert from 'node:assert/strict'
import test from 'node:test'
import { generateLayout } from '@atlas/domain'
import { handoverErrand, pickErrand, route } from './agent-life'

const layout = generateLayout({
  id: 'org-test',
  name: 'Maison Test',
  sector: 'Commerce de vêtements',
  departments: [
    { id: 'd1', name: 'Offre', agents: [{ id: 'a1', firstName: 'Léa', lastName: 'Martin', role: 'Responsable offre', status: 'online' }] },
    { id: 'd2', name: 'Acquisition', agents: [{ id: 'a2', firstName: 'Sarah', lastName: 'Moreau', role: 'Marketing', status: 'online' }] },
    { id: 'd3', name: 'Opérations', agents: [{ id: 'a3', firstName: 'Noah', lastName: 'Petit', role: 'Logistique', status: 'working' }] },
    { id: 'd4', name: 'Finance', agents: [{ id: 'a4', firstName: 'Camille', lastName: 'Rousseau', role: 'Comptable', status: 'online' }] },
  ],
})

const { building } = layout
const insideBuilding = (p: { x: number; z: number }) =>
  p.x >= building.x && p.x <= building.x + building.w && p.z >= building.z && p.z <= building.z + building.d

test('chaque agent peut aller voir chaque collègue en restant dans le bâtiment', () => {
  for (const from of layout.agents) {
    for (const to of layout.agents) {
      if (from.id === to.id) continue
      const errand = handoverErrand(layout, to, 'son rapport')
      const path = route(layout, { x: from.x, z: from.z }, from.roomId, errand.to, errand.roomId)
      assert.ok(path.length >= 2)
      assert.deepEqual(path[0], { x: from.x, z: from.z })
      assert.deepEqual(path.at(-1), errand.to)
      const fromRoom = layout.rooms.find((room) => room.id === from.roomId)!
      const toRoom = layout.rooms.find((room) => room.id === to.roomId)!
      if (!fromRoom.outdoor && !toRoom.outdoor) for (const p of path) assert.ok(insideBuilding(p), `${from.name} → ${to.name} sort du bâtiment en ${p.x},${p.z}`)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!
        const b = path[i]!
        assert.ok(Math.abs(a.x - b.x) < 0.01 || Math.abs(a.z - b.z) < 0.01 || i === 1 || i === path.length - 1, `diagonale au milieu du trajet ${from.name} → ${to.name}`)
      }
    }
  }
})

test('les déplacements ont un sujet métier', () => {
  let n = 0
  const seen = new Set<string>()
  const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280)
  for (let i = 0; i < 40; i++) {
    const errand = pickErrand(layout, layout.agents[i % layout.agents.length]!, { busy: new Set(), random })
    if (errand) seen.add(errand.kind)
    if (errand?.kind === 'colleague') assert.match(errand.there, /^Avec (Léa|Sarah|Noah|Camille) : /)
  }
  assert.ok(seen.has('colleague'))
  assert.ok(seen.size >= 2)
})

test('une vraie tâche devient le sujet de la visite', () => {
  const errand = pickErrand(layout, layout.agents[0]!, { busy: new Set(), task: 'Relancer 3 factures échues', random: () => 0.01 })
  assert.equal(errand?.kind, 'colleague')
  assert.match(errand!.there, /relancer 3 factures échues/)
})
