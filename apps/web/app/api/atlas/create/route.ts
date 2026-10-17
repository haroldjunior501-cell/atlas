import { createPresentationFile } from '@/lib/atlas-create'
import { generateAtlasImage } from '@/lib/atlas-image'
import { createWebsiteFile } from '@/lib/atlas-website'
import { nemotron } from '@/lib/nemotron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLIDES_SYSTEM = `Tu prépares une présentation PowerPoint.
Réponds UNIQUEMENT avec un JSON valide (pas de markdown autour) :
{"title":"...","slides":[{"title":"...","bullets":["...","..."]}]}
Règles : 5 à 10 slides, titres courts, 3 à 6 puces max par slide, langue de l'utilisateur.`

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    kind?: 'presentation' | 'image' | 'website'
    topic?: string
    prompt?: string
    outline?: string
    title?: string
    open?: boolean
  } | null
  if (!body?.kind) return Response.json({ error: 'kind requis' }, { status: 400 })

  try {
    if (body.kind === 'presentation') {
      const topic = (body.topic || body.prompt || '').trim()
      if (topic.length < 2) return Response.json({ error: 'sujet requis' }, { status: 400 })
      let outline = (body.outline || '').trim()
      if (!outline || outline.length < 40) {
        const planned = await nemotron(SLIDES_SYSTEM, `Sujet : ${topic}`, 900, 20000)
        outline = planned || `{"title":${JSON.stringify(topic)},"slides":[{"title":${JSON.stringify(topic)},"bullets":["Contexte","Objectifs","Prochaines étapes"]}]}`
      }
      const result = await createPresentationFile({
        topic,
        outline,
        title: body.title || topic,
        open: body.open !== false,
      })
      return Response.json({ ok: true, kind: 'presentation', ...result })
    }

    if (body.kind === 'website') {
      const topic = (body.topic || body.prompt || '').trim()
      if (topic.length < 2) return Response.json({ error: 'sujet requis' }, { status: 400 })
      const result = await createWebsiteFile({
        topic,
        outline: body.outline,
        title: body.title,
        open: body.open !== false,
      })
      return Response.json({ ok: true, kind: 'website', ...result })
    }

    if (body.kind === 'image') {
      const prompt = (body.prompt || body.topic || '').trim()
      if (prompt.length < 3) return Response.json({ error: 'prompt requis' }, { status: 400 })
      const result = await generateAtlasImage({
        prompt,
        title: body.title,
        open: body.open !== false,
      })
      return Response.json({
        ok: true,
        kind: 'image',
        path: result.path,
        title: result.title,
        provider: result.provider,
        summary: result.summary,
        dataUrl: result.dataUrl.slice(0, 200) + '…',
        preview: result.dataUrl,
      })
    }

    return Response.json({ error: 'kind inconnu' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Création impossible'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
