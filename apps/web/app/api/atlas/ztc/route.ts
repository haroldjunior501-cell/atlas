import { ztcDeskOf, ztcScopeOf } from '@atlas/domain'
import { advertiseFromLive } from '@/lib/ztc-creative'
import { ztcThink } from '@/lib/ztc-connect'
import { liveForDesk, measurePublicSpeed, scanPublicHeaders, ztcInventory, ztcPublicOps } from '@/lib/ztc-live'

export async function GET(request: Request) {
  const desk = new URL(request.url).searchParams.get('desk') || ''
  const inventory = await ztcInventory()
  if (!desk) return Response.json(inventory)
  const scope = ztcScopeOf(desk)
  return Response.json({
    ...inventory,
    desk: scope.firstName,
    datasets: scope.datasets,
    scoped: liveForDesk(inventory.live, scope.firstName),
    ops: {
      scan: scope.datasets.includes('headers') ? inventory.ops.scan : null,
      speed: scope.datasets.includes('speed') ? inventory.ops.speed : null,
    },
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { op?: string; desk?: string; sku?: string; prompt?: string; text?: string }
  const op = body.op || 'inventory'
  if (op === 'think') {
    try {
      return Response.json(await ztcThink(body.desk || '', body.text || body.prompt || body.sku || ''))
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'think' }, { status: 400 })
    }
  }
  if (op === 'scan') return Response.json({ desk: 'Radar', ...(await scanPublicHeaders()) })
  if (op === 'speed') return Response.json({ desk: 'Swift', points: await measurePublicSpeed() })
  if (op === 'observe') return Response.json(await ztcPublicOps())
  if (op === 'advertise') {
    const ad = await advertiseFromLive(body.sku || body.prompt || '')
    return Response.json({
      desk: 'Flare',
      sku: ad.product.title,
      price: ad.price,
      comingSoon: ad.product.comingSoon,
      image: { title: ad.image.title, provider: ad.image.provider, dataUrl: ad.image.dataUrl, summary: ad.image.summary },
    })
  }
  if (op === 'desk') {
    const desk = ztcDeskOf(body.desk || body.prompt || '')?.firstName ?? 'Nova'
    const inventory = await ztcInventory()
    const scope = ztcScopeOf(desk)
    return Response.json({
      desk,
      datasets: scope.datasets,
      scoped: liveForDesk(inventory.live, desk),
      ops: {
        scan: scope.datasets.includes('headers') ? inventory.ops.scan : null,
        speed: scope.datasets.includes('speed') ? inventory.ops.speed : null,
      },
    })
  }
  if (op !== 'inventory') {
    return Response.json({ error: 'ATLAS lit FOSSBilling guest, DEVOID /health, scan public et TTFB. Les écritures client / WHM / registrar restent en approbation.' }, { status: 403 })
  }
  return Response.json(await ztcInventory())
}
