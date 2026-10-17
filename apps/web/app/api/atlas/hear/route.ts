import { transcribeAudio } from '@/lib/ace-runtime'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { audio?: string } | null
  const audio = body?.audio?.trim() ?? ''
  if (audio.length < 100) return Response.json({ text: '' })
  try {
    const text = await transcribeAudio(audio)
    return Response.json({ text })
  } catch {
    return Response.json({ text: '', error: 'busy' })
  }
}
