import { consultJarvis } from '@/lib/atlas-jarvis'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    text?: string
    studio?: unknown
    memory?: string
  } | null
  const text = body?.text?.trim() ?? ''
  if (text.length < 1) return Response.json({ error: 'vide' }, { status: 400 })
  const brain = await consultJarvis(text, {
    studio: body?.studio,
    memory: body?.memory,
    timeoutMs: 8000,
  })
  return Response.json(brain)
}
