import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  agentsInRoom,
  buildOrgStudioContext,
  buildOrgSupervisorBrief,
  matchOfficeRoom,
  pickAgentForMission,
  resolveRoomKeys,
  teamRosterLine,
} from './atlas-org-context'

const chart = {
  organization: { id: 'o1', name: 'ZtcHosting', intention: 'Hébergement' },
  departments: [
    { id: 'd1', name: 'Sécurité' },
    { id: 'd2', name: 'Support' },
    { id: 'd3', name: 'Performance' },
  ],
  agents: [
    { id: 'a1', firstName: 'Radar', lastName: 'Ito', role: 'Surface Scan', departmentId: 'd1', presence: 'working', skills: ['Scan'] },
    { id: 'a2', firstName: 'Nova', lastName: 'Diallo', role: 'Support & Customer Success', departmentId: 'd2', presence: 'online' },
    { id: 'a3', firstName: 'Swift', lastName: 'Costa', role: 'Site Performance', departmentId: 'd3', presence: 'idle' },
  ],
}

describe('atlas org context', () => {
  it('expose tous les agents et le produit au studio Jarvis', () => {
    const studio = buildOrgStudioContext(chart, {
      journal: [{ agentId: 'a1', title: 'Scan TLS', status: 'doing' }],
      decisionsPending: 1,
    })
    assert.equal(studio.agentCount, 3)
    assert.equal(studio.product, 'ZtcHosting')
    assert.ok(studio.agents.some((agent) => agent.firstName === 'Radar' && agent.workingOn.length > 0))
    assert.ok(studio.desks.some((desk) => desk.firstName === 'Flare'))
    assert.match(studio.rule, /ATLAS orchestre/)
  })

  it('route les missions vers le bon desk ZTC', () => {
    assert.equal(pickAgentForMission(chart.agents, 'scan des en-têtes TLS')?.firstName, 'Radar')
    assert.equal(pickAgentForMission(chart.agents, 'mon site est lent')?.firstName, 'Swift')
    assert.equal(pickAgentForMission(chart.agents, 'ticket client down')?.firstName, 'Nova')
  })

  it('résout le studio marketing', () => {
    assert.ok(resolveRoomKeys('marketing').some((key) => /Marketing|Studio/i.test(key)))
    assert.ok(resolveRoomKeys('salle vidéo promo').some((key) => /Marketing|Studio/i.test(key)))
  })

  it('briefe et liste toute l’équipe', () => {
    const brief = buildOrgSupervisorBrief(chart, { decisionsPending: 0, journal: [] })
    assert.match(brief, /ZtcHosting/)
    assert.match(brief, /3 employés/)
    assert.match(teamRosterLine(chart.agents), /Radar/)
    assert.match(teamRosterLine(chart.agents), /Nova/)
  })

  it('résout et pilote une salle du bureau', () => {
    assert.ok(resolveRoomKeys('salle de sécurité').some((key) => /S[eé]curit/i.test(key)))
    const rooms = [
      { id: 'r1', name: 'Sécurité', departmentId: 'd1' },
      { id: 'r2', name: 'Support', departmentId: 'd2' },
      { id: 'r3', name: 'Performance', departmentId: 'd3' },
    ]
    assert.equal(matchOfficeRoom(rooms, 'ouvre la sécurité')?.name, 'Sécurité')
    assert.equal(matchOfficeRoom(rooms, 'support')?.name, 'Support')
    const staff = agentsInRoom(chart.agents, rooms[0]!, ['a1'])
    assert.deepEqual(staff.map((agent) => agent.firstName), ['Radar'])
  })
})
