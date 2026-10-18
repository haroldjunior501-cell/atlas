import { transcribeAudio, transcribeAudioFile } from '@/lib/ace-runtime'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // Multipart (mobile Expo → fichier .m4a / .wav réel)
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      const language = String(form.get('language') || 'en')
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const blob = file as File
        const buffer = Buffer.from(await blob.arrayBuffer())
        if (buffer.byteLength < 200) return Response.json({ text: '' })
        const text = await transcribeAudioFile(buffer, blob.name || 'speech.m4a', language)
        return Response.json({ text })
      }
      return Response.json({ text: '' })
    }

    // Legacy JSON base64
    const body = await request.json().catch(() => null) as { audio?: string; format?: string } | null
    const audio = body?.audio?.trim() ?? ''
    if (audio.length < 100) return Response.json({ text: '' })
    const text = await transcribeAudio(audio, body?.format || 'm4a')
    return Response.json({ text })
  } catch {
    return Response.json({ text: '', error: 'busy' })
  }
}
