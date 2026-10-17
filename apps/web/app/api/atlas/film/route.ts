import { generateAtlasFilm } from '@/lib/atlas-film'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    prompt?: string
    title?: string
    open?: boolean
  } | null
  const prompt = (body?.prompt || '').trim()
  if (prompt.length < 3) return Response.json({ error: 'Décrivez la vidéo.' }, { status: 400 })
  try {
    const result = await generateAtlasFilm({
      prompt,
      title: body?.title,
      open: body?.open !== false,
    })
    return Response.json({ ok: true, kind: 'film', ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Génération vidéo impossible'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
