import { generateAtlasImage } from '@/lib/atlas-image'
import { ztcLiveFeed, type ZtcLiveProduct } from '@/lib/ztc-live'

function pickSku(products: ZtcLiveProduct[], hint = '') {
  const text = hint.toLowerCase()
  return products.find((item) => text && item.title.toLowerCase().includes(text.replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0] ?? '') && !item.comingSoon)
    || products.find((item) => /business/i.test(item.title) && !item.comingSoon)
    || products.find((item) => !item.comingSoon)
    || products[0]
    || { id: 0, title: 'ZtcHosting', priceFrom: null, comingSoon: false, unit: 'month', description: '', type: '', categoryId: 0 }
}

function priceLabel(product: Pick<ZtcLiveProduct, 'title' | 'priceFrom' | 'comingSoon' | 'unit'>) {
  if (product.comingSoon) return 'coming soon — ne pas inventer un prix'
  if (product.priceFrom === 0) return 'gratuit'
  if (product.priceFrom == null) return 'prix non affiché'
  return `$${product.priceFrom}${product.unit ? ` / ${product.unit}` : ''}`
}

/** Visuel Flare : prix pris sur le catalogue live, jamais inventé. */
export async function advertiseFromLive(hint = '') {
  const feed = await ztcLiveFeed()
  const product = pickSku(feed.products, hint)
  const price = priceLabel(product)
  const prompt = `Premium advertising visual for ${product.title} by ZtcHosting, official brand, live price ${price}, clean luxury datacenter atelier, photoreal, no fake SLA, no invented discount, no watermark, high quality`
  const image = await generateAtlasImage({ prompt, title: `ZTC-${product.title}`, open: false })
  return { product, price, image }
}
