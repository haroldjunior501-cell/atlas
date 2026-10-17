import { ztcInventory } from '@/lib/ztc-live'

export async function GET() {
  return Response.json(await ztcInventory())
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { op?: string }
  if (body.op && body.op !== 'inventory') {
    return Response.json({ error: 'Lecture seule pour l’instant. Les écritures WHM / FOSSBilling / registrar passent par une approbation et un connecteur configuré.' }, { status: 403 })
  }
  return Response.json(await ztcInventory())
}
