import { amdVllmModel } from '@/lib/amd-vllm'
import { bridgeToken } from '@/lib/ztc-connect'

/** Santé publique pour Cloudflare / ZTC. */
export async function GET() {
  return Response.json({
    ok: true,
    service: 'atlas',
    model: amdVllmModel(),
    bridge: Boolean(bridgeToken()),
    connect: '/api/atlas/ztc/connect',
    think: '/api/bridge/think',
  })
}
