import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleOrganization } from './office-archetype'
import { generateLayout } from './office-layout'
import { liveProductOperations } from './office-ops'

describe('liveProductOperations', () => {
  it('n’invente ni factures ni CA', () => {
    const layout = generateLayout({ id: 'ztc', ...sampleOrganization('hosting') })
    const ops = liveProductOperations(layout, {
      live: { openTasks: 2, pendingDecisions: 0, activeAgents: 3 },
      product: {
        products: [
          { title: 'Business Hosting', priceFrom: 5.99, comingSoon: false, unit: 'mo' },
          { title: 'VPS hosting', priceFrom: null, comingSoon: true },
        ],
        devoidOk: true,
        devoidModel: 'qwen',
        speed: [{ path: '/order', ttfbMs: 593, ok: true }],
        scan: { status: 200, server: 'cloudflare', missing: ['content-security-policy'] },
        realTasks: { [layout.agents[0]!.id]: 'Scan TLS en cours' },
      },
    })
    assert.equal(ops.simulated, false)
    assert.equal(ops.records.length, 0)
    assert.ok(!ops.kpis.some((kpi) => /CA du mois|À encaisser/i.test(kpi.label)))
    assert.ok(ops.kpis.some((kpi) => kpi.id === 'sku' && kpi.value === '1'))
    assert.ok(ops.kpis.some((kpi) => kpi.id === 'devoid' && kpi.value === 'En ligne'))
    assert.ok(ops.atlas.actions.some((action) => /Radar|en-têtes/i.test(action.title)))
    assert.equal(ops.tasks[layout.agents[0]!.id], 'Scan TLS en cours')
  })
})
