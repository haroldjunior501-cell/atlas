import {
  enqueueStudioCommand,
  peekStudioCommands,
  takeStudioCommands,
  type StudioRemoteAction,
} from '@/lib/atlas-studio-queue'

export const runtime = 'nodejs'

/** File de pilotage Studio : le mobile pousse, l’onglet /bureau consomme. */
export async function GET(request: Request) {
  const userId = request.headers.get('x-atlas-user') || 'harold'
  const url = new URL(request.url)
  const since = Number(url.searchParams.get('since') || '0') || 0
  const peek = url.searchParams.get('peek') === '1'
  const organizationId = url.searchParams.get('organizationId')
  const items = peek
    ? peekStudioCommands(userId, since, organizationId)
    : takeStudioCommands(userId, since, organizationId)
  return Response.json({
    ok: true,
    commands: items,
    cursor: items.length ? items[items.length - 1]!.at : since,
  })
}

export async function POST(request: Request) {
  const userId = request.headers.get('x-atlas-user') || 'harold'
  const body = await request.json().catch(() => null) as {
    action?: StudioRemoteAction
    organizationId?: string | null
    source?: string
  } | null
  if (!body?.action || typeof body.action !== 'object' || !('kind' in body.action)) {
    return Response.json({ error: 'action requise' }, { status: 400 })
  }
  const command = enqueueStudioCommand({
    userId,
    organizationId: body.organizationId,
    action: body.action,
    source: body.source || 'api',
  })
  return Response.json({ ok: true, command })
}
