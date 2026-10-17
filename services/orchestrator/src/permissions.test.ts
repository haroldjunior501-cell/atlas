import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTION, type Agent } from '@atlas/domain'
import { evaluatePermission } from './permissions'

const cmo: Agent = {
  id: 'sarah',
  organizationId: 'org',
  departmentId: 'marketing',
  reportsToId: null,
  firstName: 'Sarah',
  lastName: 'Moreau',
  role: 'Chief Marketing Officer',
  mission: 'Croissance',
  presence: 'idle',
  personality: { traits: ['stratégique'] },
  skills: ['Growth'],
  objectives: [],
  toolIds: [],
  delegation: 'autonomous',
  avatar: { appearance: 'portrait', age: null, style: 'enterprise', voiceId: 'Ava' },
  permissions: [
    { action: ACTION.createCampaign, allowed: true, requiresApproval: false, spendLimit: null },
    { action: ACTION.spend, allowed: true, requiresApproval: false, spendLimit: 500 },
    { action: ACTION.editBilling, allowed: false, requiresApproval: false, spendLimit: null },
  ],
}

test('a campaign at the spend ceiling is allowed', () => {
  const decision = evaluatePermission(cmo, { type: ACTION.spend, kind: 'act', amount: 500 })
  assert.equal(decision.outcome, 'allowed')
})

test('a campaign above the spend ceiling waits for the CEO', () => {
  const decision = evaluatePermission(cmo, { type: ACTION.spend, kind: 'act', amount: 1200 })
  assert.equal(decision.outcome, 'approval_required')
})

test('a forbidden action is denied', () => {
  const decision = evaluatePermission(cmo, { type: ACTION.editBilling, kind: 'act', amount: null })
  assert.equal(decision.outcome, 'denied')
})

test('an agent under approval analyzes freely and waits before acting', () => {
  const careful: Agent = { ...cmo, delegation: 'approval' }
  assert.equal(evaluatePermission(careful, { type: ACTION.createCampaign, kind: 'analyze', amount: null }).outcome, 'allowed')
  assert.equal(evaluatePermission(careful, { type: ACTION.createCampaign, kind: 'act', amount: null }).outcome, 'approval_required')
  assert.equal(evaluatePermission(careful, { type: ACTION.spend, kind: 'analyze', amount: 100 }).outcome, 'approval_required')
})

test('restricted agents can analyze and cannot act', () => {
  const legal: Agent = { ...cmo, delegation: 'restricted', firstName: 'Legal' }
  assert.equal(
    evaluatePermission(legal, { type: ACTION.createCampaign, kind: 'analyze', amount: null }).outcome,
    'allowed',
  )
  assert.equal(
    evaluatePermission(legal, { type: ACTION.createCampaign, kind: 'act', amount: null }).outcome,
    'denied',
  )
})
