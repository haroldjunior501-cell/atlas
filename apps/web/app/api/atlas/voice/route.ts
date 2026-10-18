import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mayaAceClip } from '@atlas/voice'
import { transcribeAudio, thinkWithLlm, speakAudio, voiceEngines } from '@/lib/ace-runtime'
import { directiveFromModel, localVoiceReply } from '@/lib/atlas-voice'

function persistMayaClip(clip: ReturnType<typeof mayaAceClip>) {
  const dir = join(process.cwd(), '..', '..', 'data', 'maya-ace')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'latest.a2f.json'), JSON.stringify(clip, null, 2))
}

const SYSTEM = `You are Atlas, the voice assistant for the ATLAS product. Pipeline: listen, think, speak.
LANGUAGE: The "reply" must be fluent, natural spoken English (2–5 sentences). Never answer in French unless the user clearly spoke French.
You drive the studio. You never run shell commands on the computer. Nothing is connected until the user links it.
Reply only with a JSON object: {"reply":"...","action":{"kind":"listen"}}`

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    stage?: 'transcribe' | 'think' | 'speak' | 'turn'
    text?: string
    audio?: string
    voiceId?: string
    studio?: unknown
  } | null
  const stage = body?.stage ?? 'turn'
  const engines = voiceEngines()
  if (stage === 'transcribe') {
    const heard = await transcribeAudio(body?.audio?.trim() ?? '')
    return Response.json({ stage, heard, engines })
  }
  if (stage === 'speak') {
    const text = body?.text?.trim() ?? ''
    const clip = mayaAceClip(text, body?.voiceId ?? 'Atlas')
    persistMayaClip(clip)
    const audio = await speakAudio(text, body?.voiceId ?? 'French-Female')
    return Response.json({ stage, reply: text, clip, audio: audio?.data ?? null, mime: audio?.mime ?? null, engines })
  }
  const heard = body?.audio ? await transcribeAudio(body.audio) : (body?.text?.trim() ?? '')
  if (heard.length < 1) return Response.json({ error: 'vide', engines }, { status: 400 })
  const answer = await thinkWithLlm(SYSTEM, `Studio : ${JSON.stringify(body?.studio ?? null)}\nDemande : ${heard}`, 560, 28000)
  const directive = directiveFromModel(answer)
  const reply = (directive?.reply || answer.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*\}/g, '').trim() || localVoiceReply(heard)).slice(0, 700)
  const clip = mayaAceClip(reply, body?.voiceId ?? 'Atlas')
  persistMayaClip(clip)
  const audio = stage === 'think' ? null : await speakAudio(reply, body?.voiceId ?? 'French-Female')
  return Response.json({
    stage,
    heard,
    reply,
    action: directive?.action ?? { kind: 'listen' },
    source: answer ? (engines.localLlm ? 'ace-llm' : 'nvidia') : 'local',
    clip,
    audio: audio?.data ?? null,
    mime: audio?.mime ?? null,
    engines,
  })
}

export async function GET() {
  return Response.json({ ok: true, pipeline: ['listen', 'think', 'speak'], engines: voiceEngines() })
}
