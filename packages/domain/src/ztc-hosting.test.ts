import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectArchetype } from './office-archetype'
import { draftFromIntention } from './organization-plan'
import { businessModelOf } from './agent-kit'
import { isZtcOrganization } from './ztc-hosting'

describe('ZTC Hosting', () => {
  it('reconnaît l’hébergeur plutôt qu’une startup tech', () => {
    assert.equal(detectArchetype({ name: 'ZTC Hosting', sector: 'Hébergement web', intention: 'Orchestrer ZTC Hosting' }), 'hosting')
    assert.equal(businessModelOf('Associe ATLAS à ZTC Hosting et WHM'), 'hosting')
  })

  it('monte l’équipe du dossier, sans inventer un serveur HP', () => {
    const draft = draftFromIntention('ATLAS orchestre ZTC Hosting : support, WHM, domaines, facturation')
    assert.equal(draft.name, 'ZTC Hosting')
    assert.ok(draft.roles.some((role) => role.firstName === 'Nova' && /Support/.test(role.role)))
    assert.ok(draft.roles.some((role) => role.firstName === 'Vega' && /WHM/.test(role.role)))
    assert.ok(draft.roles.some((role) => role.firstName === 'Ledger'))
    assert.ok(!/160 ?Go|3 ?To/i.test(JSON.stringify(draft)))
  })

  it('qualifie l’organisation ZTC', () => {
    assert.equal(isZtcOrganization('ZTC Hosting', 'Hébergement web'), true)
    assert.equal(isZtcOrganization('Veut Marque Vêtement', 'Mode'), false)
  })
})
