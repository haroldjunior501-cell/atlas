import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateLayout, officeOrgFromChart, primarySpaceForDept } from './office-layout'
import { ARCHETYPE_IDS, detectArchetype, sampleOrganization } from './office-archetype'
import { formatChf, generateOperations } from './office-ops'
import { spaceFromText } from './office-spaces'

describe('archétypes', () => {
  it('reconnaît le métier demandé', () => {
    assert.equal(detectArchetype({ intention: 'Je veux créer une concession automobile à Lausanne' }), 'car_dealership')
    assert.equal(detectArchetype({ intention: 'Une agence de marketing digital pour PME' }), 'marketing_agency')
    assert.equal(detectArchetype({ sector: 'Immobilier', businessModel: 'agence' }), 'real_estate')
    assert.equal(detectArchetype({ sector: 'Santé', businessModel: 'clinique' }), 'clinic')
    assert.equal(detectArchetype({ intention: 'Ouvrir un restaurant au bord du lac' }), 'restaurant')
    assert.equal(detectArchetype({ businessModel: 'saas', sector: 'Logiciel B2B' }), 'tech')
    assert.equal(detectArchetype({ name: 'ZTC Hosting', sector: 'Hébergement web' }), 'hosting')
    assert.equal(detectArchetype({ name: 'Nebula', departments: ['Direction', 'Production'] }), 'corporate')
  })

  it('une concession a un showroom, un atelier à ponts, un parking et des véhicules', () => {
    const sample = sampleOrganization('car_dealership')
    const layout = generateLayout({ id: 'garage', ...sample })
    assert.equal(layout.archetype, 'car_dealership')
    for (const kind of ['showroom', 'workshop', 'parts_store', 'parking']) {
      assert.ok(layout.rooms.some((r) => r.kind === kind), kind)
    }
    assert.ok(layout.props.filter((p) => p.kind === 'car').length >= 6)
    assert.ok(layout.props.some((p) => p.kind === 'car_lift'))
    assert.ok(layout.props.some((p) => p.motion === 'drive'))
    const mechanics = layout.agents.filter((a) => a.station === 'lift')
    assert.ok(mechanics.length >= 4)
    assert.ok(layout.rooms.find((r) => r.kind === 'parking')?.outdoor)
  })

  it('une agence marketing ne ressemble pas à une concession', () => {
    const agency = generateLayout({ id: 'agency', ...sampleOrganization('marketing_agency') })
    const kinds = new Set(agency.rooms.map((r) => r.kind))
    assert.equal(agency.archetype, 'marketing_agency')
    assert.ok(kinds.has('creative_studio') && kinds.has('photo_studio') && kinds.has('pitch_room'))
    assert.ok(!kinds.has('workshop') && !agency.props.some((p) => p.kind === 'car'))
  })

  it('chaque archétype produit des agents placés et des données en CHF', () => {
    for (const id of ARCHETYPE_IDS) {
      const sample = sampleOrganization(id)
      const layout = generateLayout({ id: `org-${id}`, ...sample, archetype: id })
      const people = sample.departments.reduce((sum, d) => sum + d.agents.length, 0)
      assert.equal(layout.agents.length, people, id)
      for (const agent of layout.agents) {
        const room = layout.rooms.find((r) => r.id === agent.roomId)!
        assert.ok(agent.x >= room.x - 0.5 && agent.x <= room.x + room.w + 0.5, `${id} ${agent.name} x`)
        assert.ok(agent.z >= room.z - 0.5 && agent.z <= room.z + room.d + 0.5, `${id} ${agent.name} z`)
      }
      const ops = generateOperations(layout, { now: new Date('2026-10-14T10:00:00Z') })
      assert.ok(ops.kpis.some((k) => k.value.startsWith('CHF ')), id)
      assert.equal(ops.records.length, 36)
      assert.ok(Object.keys(ops.zones).length === layout.rooms.length)
      assert.ok(layout.agents.every((a) => ops.tasks[a.id]))
    }
  })

  it('ATLAS relie chaque dossier à un agent et planifie les actions', () => {
    const sample = sampleOrganization('car_dealership')
    const layout = generateLayout({ id: 'org-garage', ...sample, archetype: 'car_dealership' })
    const now = new Date('2026-10-14T10:00:00Z')
    const ops = generateOperations(layout, { now })
    const ids = new Set(layout.agents.map((a) => a.id))
    for (const record of ops.records) {
      assert.ok(record.agentId && ids.has(record.agentId), record.number)
      assert.ok(record.isoDate <= '2026-10-14' && record.dueIso > record.isoDate)
      if (record.status === 'overdue') assert.ok(record.dueIso < '2026-10-14', record.number)
    }
    assert.ok(ops.atlas.actions.length > 0)
    for (const action of ops.atlas.actions) assert.ok(action.mission.length > 20 && (!action.agentId || ids.has(action.agentId)))
    const relance = ops.atlas.actions.find((a) => a.kind === 'relance')
    if (relance) assert.deepEqual(relance.recordIds.sort(), ops.records.filter((r) => r.status === 'overdue').map((r) => r.id).sort())
    const billed = Object.values(ops.zones).reduce((sum, z) => sum + z.finance.billed, 0)
    assert.equal(billed, ops.records.reduce((sum, r) => sum + r.amount, 0))
  })

  it('ajoute et retire des zones à la demande', () => {
    const sample = sampleOrganization('marketing_agency')
    const base = generateLayout({ id: 'org-zones', ...sample, archetype: 'marketing_agency' })
    const signature = base.rooms.find((r) => r.id.includes('-room-__') && r.kind !== 'lobby')!
    const dept = base.rooms.find((r) => r.departmentId && r.id.endsWith(`-room-${r.departmentId}`))!
    const next = generateLayout({
      id: 'org-zones',
      ...sample,
      archetype: 'marketing_agency',
      spaces: { added: [{ id: 'a1', kind: 'meeting_medium', name: 'Salle Léman' }], removed: [signature.id, dept.id] },
    })
    assert.ok(next.rooms.some((r) => r.id === 'org-zones-room-x-a1' && r.name === 'Salle Léman'))
    assert.ok(!next.rooms.some((r) => r.id === signature.id))
    assert.ok(next.rooms.some((r) => r.id === dept.id), 'un département ne disparaît que côté organisation')
    assert.equal(spaceFromText('ajoute une salle de réunion')?.kind, 'meeting_medium')
    assert.equal(spaceFromText('crée un atelier mécanique')?.kind, 'workshop')
    assert.equal(spaceFromText('ajoute un bureau')?.kind, 'private_office')
  })

  it('formate les francs suisses', () => {
    assert.equal(formatChf(207634), 'CHF 207’634')
    assert.equal(formatChf(980), 'CHF 980')
  })
})

describe('generateLayout', () => {
  it('produit une grammaire riche (open space, annexes, communs)', () => {
    const layout = generateLayout({
      id: 'org-1',
      name: 'Nebula Studio',
      departments: [
        {
          id: 'd1',
          name: 'Direction',
          agents: [
            { id: 'a1', firstName: 'Léa', lastName: 'Martin', role: 'Directrice IA' },
          ],
        },
        {
          id: 'd2',
          name: 'Production',
          agents: [
            { id: 'a2', firstName: 'Max', lastName: 'Durand', role: 'Monteur' },
            { id: 'a3', firstName: 'Inès', lastName: 'Bernard', role: 'Script' },
            { id: 'a4', firstName: 'Noah', lastName: 'Petit', role: 'Graphiste' },
            { id: 'a5', firstName: 'Sacha', lastName: 'Klein', role: 'Motion' },
          ],
        },
        {
          id: 'd3',
          name: 'Ventes',
          agents: [
            { id: 'a6', firstName: 'Emma', lastName: 'Petit', role: 'AE' },
            { id: 'a7', firstName: 'Yanis', lastName: 'Ali', role: 'SDR' },
          ],
        },
        {
          id: 'd4',
          name: 'Finance',
          agents: [
            { id: 'a8', firstName: 'Hugo', lastName: 'Noir', role: 'Comptable' },
          ],
        },
      ],
      swarms: [{ id: 'sw1', name: 'Sprint', agentIds: ['a2', 'a3'] }],
    })

    assert.equal(layout.quality, 'hyper')
    assert.equal(layout.agents.length, 8)
    assert.ok(layout.rooms.some((r) => r.kind === 'lobby'))
    assert.ok(layout.rooms.some((r) => r.kind === 'cafeteria'))
    assert.ok(layout.rooms.some((r) => r.kind === 'lounge'))
    assert.ok(layout.rooms.some((r) => r.kind === 'kitchen'))
    assert.ok(layout.rooms.some((r) => r.kind === 'phone_booth'))
    assert.ok(layout.rooms.some((r) => r.kind === 'meeting_medium'))
    assert.ok(layout.rooms.some((r) => r.kind === 'project_room'))
    assert.ok(layout.rooms.some((r) => r.kind === 'archive'))
    assert.ok(layout.desks.every((d) => d.style))
    assert.ok(layout.props.some((p) => p.kind === 'whiteboard'))
    assert.ok(layout.props.some((p) => p.kind === 'coffee'))
    assert.ok(layout.labels.some((l) => l.floorPrint))
  })

  it('choisit le bon aménagement principal par type', () => {
    assert.equal(primarySpaceForDept('direction', 1), 'private_office')
    assert.equal(primarySpaceForDept('sales', 4), 'cubicle')
    assert.equal(primarySpaceForDept('product', 5), 'open_space')
    assert.equal(primarySpaceForDept('support', 3), 'open_space')
  })

  it('est déterministe', () => {
    const org = officeOrgFromChart({
      organization: { id: 'o', name: 'Atlas' },
      departments: [{ id: 'd', name: 'Produit' }],
      agents: [
        { id: '1', departmentId: 'd', firstName: 'Marc', lastName: 'Lefèvre', role: 'CTO' },
        { id: '2', departmentId: 'd', firstName: 'Inès', lastName: 'Bernard', role: 'PM' },
      ],
    })
    const a = generateLayout(org, 1)
    const b = generateLayout(org, 1)
    assert.deepEqual(
      a.rooms.map((r) => ({ id: r.id, kind: r.kind, x: r.x, z: r.z })),
      b.rooms.map((r) => ({ id: r.id, kind: r.kind, x: r.x, z: r.z })),
    )
  })
})
