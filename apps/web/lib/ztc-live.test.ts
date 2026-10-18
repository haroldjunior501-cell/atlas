import assert from 'node:assert/strict'
import test from 'node:test'
import { liveForDesk, parseDevoidHealth, parseLiveProducts } from './ztc-live'

test('lit le catalogue FOSSBilling sans inventer un prix', () => {
  const products = parseLiveProducts({
    result: {
      list: [
        { id: 2, title: 'Starter Hosting', type: 'hosting', product_category_id: 3, price_starting_from: 0, unit: 'month', pricing: { type: 'free' } },
        { id: 3, title: 'Business Hosting', type: 'hosting', product_category_id: 3, price_starting_from: 5.99, unit: 'month', pricing: { type: 'recurrent', recurrent: { '1M': { price: 5.99 } } } },
        { id: 5, title: 'VPS hosting (coming soon)', type: 'custom', product_category_id: 4, price_starting_from: 0, unit: 'product', pricing: { type: 'free' } },
      ],
    },
  })
  assert.equal(products[0]?.comingSoon, false)
  assert.equal(products[0]?.priceFrom, 0)
  assert.equal(products[1]?.priceFrom, 5.99)
  assert.equal(products[2]?.comingSoon, true)
})

test('DEVOID health reste un opérateur, pas un second ATLAS', () => {
  const health = parseDevoidHealth({
    status: 'ok',
    version: '0.3.0',
    operator: 'DEVOID',
    model: 'qwen3.5:9b-q4_K_M',
    fossbilling: true,
    tools: ['list_shop_products', 'get_customer_orders'],
  })
  assert.equal(health.ok, true)
  assert.match(health.note, /ATLAS orchestre/)
  assert.equal(health.tools.length, 2)
})

test('un bureau ne voit que ses jeux de données', () => {
  const feed = {
    companyName: 'ZTCHosting',
    signature: 'x',
    www: 'https://ztchosting.com/',
    products: [{ id: 3, title: 'Business Hosting', type: 'hosting', categoryId: 3, priceFrom: 5.99, unit: 'month', comingSoon: false, description: '' }],
    tlds: [{ tld: '.com', register: '12', renew: '14' }],
    cart: { items: 0, total: 0, currency: 'USD', note: '' },
    news: [{ tag: 'promo', title: 'offre' }],
    drift: ['écart'],
    devoid: { ok: true, status: 'ok', operator: 'DEVOID', tools: ['list_shop_products'], note: '', certainty: 'observed' as const },
  }
  const sage = liveForDesk(feed, 'Sage')
  assert.equal(sage.products.length, 0)
  assert.equal(sage.company?.name, 'ZTCHosting')
  const flare = liveForDesk(feed, 'Flare')
  assert.equal(flare.products[0]?.priceFrom, 5.99)
  assert.equal(flare.devoid.ok, false)
})
