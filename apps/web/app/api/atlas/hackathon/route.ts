import { thinkOnAmd } from '@/lib/amd-vllm'
import { evolusChat, evolusCompare, evolusIndexUrl, evolusSummarize } from '@/lib/evolus'
import { hackathonStack } from '@/lib/hackathon-stack'

export async function GET() {
  return Response.json(await hackathonStack())
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    op?: string
    text?: string
    other?: string
    url?: string
    title?: string
    system?: string
  }
  if (body.op === 'amd.think') {
    const text = await thinkOnAmd(body.system || 'Tu es ATLAS, sur AMD Instinct via vLLM.', body.text || 'Réponds en une phrase : es-tu joignable ?', 180, 20000)
    return Response.json({ ok: Boolean(text), text, via: 'amd-vllm' })
  }
  if (body.op === 'evolus.summarize') return Response.json(await evolusSummarize(body.text ?? ''))
  if (body.op === 'evolus.compare') return Response.json(await evolusCompare(body.text ?? '', body.other ?? ''))
  if (body.op === 'evolus.chat') return Response.json(await evolusChat(body.text ?? '', body.system))
  if (body.op === 'evolus.index') return Response.json(await evolusIndexUrl(body.url ?? '', body.title || 'Source ATLAS'))
  return Response.json({ error: 'op: amd.think | evolus.summarize | evolus.compare | evolus.chat | evolus.index' }, { status: 400 })
}
