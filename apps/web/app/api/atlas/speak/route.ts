import { speakAudio } from '@/lib/ace-runtime'

export const runtime = 'nodejs'

/** WAV Magpie (voix humaine) pour le visage mobile. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { text?: string } | null
  const text = body?.text?.trim() ?? ''
  if (!text) return new Response('vide', { status: 400 })
  const audio = await speakAudio(text)
  if (!audio?.data) return new Response('silence', { status: 503 })
  const bytes = Buffer.from(audio.data, 'base64')
  return new Response(bytes, {
    headers: {
      'content-type': audio.mime || 'audio/wav',
      'cache-control': 'no-store',
    },
  })
}
