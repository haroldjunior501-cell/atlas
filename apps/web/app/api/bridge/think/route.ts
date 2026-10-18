import { bridgeAuthorized, ztcThink } from '@/lib/ztc-connect'

/** Alias ZTC : POST /api/bridge/think → même pont que /api/atlas/ztc/connect (op=think). */
export async function POST(request: Request) {
  const auth = bridgeAuthorized(request)
  if (!auth.ok) return Response.json({ error: 'Jeton ATLAS_BRIDGE_TOKEN / ZTC_BRIDGE_TOKEN requis.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { desk?: string; text?: string; prompt?: string; message?: string }
  try {
    return Response.json(await ztcThink(body.desk || '', body.text || body.prompt || body.message || ''))
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'think' }, { status: 400 })
  }
}
