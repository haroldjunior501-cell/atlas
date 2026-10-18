import { thinkWithLlmStream } from '@/lib/ace-runtime'
import {
  buildExtractUser,
  buildTransformUser,
  EXTRACT_SYSTEM,
  TRANSFORM_SYSTEM,
  type ExtractFocus,
  type TransformOp,
} from '@/lib/atlas-docwork'
import { nemotron } from '@/lib/nemotron'

const TEACH_SYSTEM = `You are Atlas, a patient and rigorous personal tutor.
Adapt the level, structure (concept → example → light exercise), and encourage.
Primary language: English. Reply in English by default; mirror the user if they clearly use another language.
For a quiz: 3 short questions + answers at the end.
For an interview: play the recruiter, one question at a time when possible.
For a program: 5 to 7 progressive steps.
2 to 8 short, concrete sentences or blocks.`

const CODE_SYSTEM = `You are Atlas, a coding partner. Explain clearly, propose minimal useful code, flag risks.
If given a terminal error: likely cause + fix. No destructive shell.
Primary language: English; mirror the user if they clearly use another language.`

const DRAFT_SYSTEM = `You are Atlas, a writer. Produce a structured draft ready to paste (headings, bullets).
Match the tone (pro / warm). Avoid excessive markdown: also readable aloud.
If format is "presentation": start with 1 spoken sentence, then one-line JSON:
{"title":"...","slides":[{"title":"...","bullets":["..."]}]}
(5–10 slides, 3–6 bullets). A .pptx file will be generated automatically.
If format is "website": one short spoken sentence only (styled HTML is generated separately).`

const ANSWER_SYSTEM = `You are Atlas, a life and work partner open to ANY request.
LANGUAGE: Reply in fluent, natural spoken English by default. Never answer in French unless the user clearly wrote in French. Sound warm and human, not like a translation.
Golden rule: the user's CURRENT request is priority. Answer ONLY that request.
If Studio / brand / org chart context is provided, it is optional background: do NOT use it when the request is about something else (mail, calendar, code, general question, etc.).
Never steer the conversation back to the brand or organization unless the user asks.
Start with a short sentence that answers directly, then 2 to 5 useful sentences.
Forbidden: "I can't", "I'm limited to the org chart", "draw first", digressing on a past project.`

function buildPrompt(body: {
  kind?: string
  text?: string
  topic?: string
  style?: string
  intent?: string
  format?: string
  focus?: string
  op?: string
  source?: string
  memory?: string
  studio?: string
}) {
  const kind = body.kind ?? 'answer'
  const text = (body.text || body.topic || '').trim()
  const memory = body.memory?.trim()
    ? `\nMémoire personnelle (optionnelle, n'utilise que si pertinent) :\n${body.memory}`
    : ''
  const studio = body.studio?.trim()
    ? `\nContexte studio en arrière-plan (NE PAS forcer ce sujet) : ${body.studio}`
    : ''
  const source = (body.source || '').trim()

  if (kind === 'extract') {
    const focus = (body.focus || 'general') as ExtractFocus
    return {
      kind,
      text: text || 'extraire',
      system: EXTRACT_SYSTEM,
      user: buildExtractUser(focus, source || text, text) + memory,
      maxTokens: 900,
    }
  }
  if (kind === 'transform') {
    const op = (body.op || 'reformulate') as TransformOp
    return {
      kind,
      text: text || 'transformer',
      system: TRANSFORM_SYSTEM,
      user: buildTransformUser(op, source || text, text) + memory,
      maxTokens: 900,
    }
  }

  const system =
    kind === 'code' ? CODE_SYSTEM
      : kind === 'draft' ? DRAFT_SYSTEM
        : kind === 'teach' ? TEACH_SYSTEM
          : ANSWER_SYSTEM
  const user =
    kind === 'code'
      ? `Intent : ${body.intent ?? 'generate'}\nDemande actuelle : ${text}${memory}${studio}`
      : kind === 'draft'
        ? `Format : ${body.format ?? 'document'}\nSujet : ${text}${memory}${studio}`
        : kind === 'teach'
          ? `Style : ${body.style ?? 'explain'}\nSujet : ${text}${memory}${studio}`
          : `Current user request (answer THIS only, in fluent English unless they clearly used another language): ${text}${memory}${studio}`
  return { kind, text, system, user, maxTokens: 420 }
}

/** Pull complete sentences from a growing buffer; leave trailing incomplete fragment. */
function pullSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = []
  let rest = buffer
  const re = /([^.!?…\n]+[.!?…]+)(?:\s+|$)/g
  let match: RegExpExecArray | null
  let last = 0
  while ((match = re.exec(rest)) !== null) {
    const sentence = match[1]?.trim()
    if (sentence) sentences.push(sentence)
    last = match.index + match[0].length
  }
  rest = rest.slice(last)
  return { sentences, rest }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    kind?: 'teach' | 'code' | 'draft' | 'answer' | 'extract' | 'transform'
    text?: string
    topic?: string
    style?: string
    intent?: string
    format?: string
    focus?: string
    op?: string
    source?: string
    memory?: string
    studio?: string
    stream?: boolean
  } | null
  if (!body) return Response.json({ error: 'vide' }, { status: 400 })
  const { kind, text, system, user, maxTokens } = buildPrompt(body)
  if (text.length < 2) return Response.json({ error: 'vide' }, { status: 400 })
  if ((kind === 'extract' || kind === 'transform') && !(body.source || '').trim() && text.length < 12) {
    return Response.json({
      reply: kind === 'extract'
        ? 'Indiquez le fichier source (ex. « extrais les dates du fichier Orelle ») ou collez le texte à analyser.'
        : 'Indiquez le fichier à transformer ou collez le texte (ex. « reformule le fichier Brief en markdown »).',
      kind,
    })
  }

  if (body.stream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }
        let full = ''
        let pending = ''
        try {
          send({ status: 'thinking' })
          let got = false
          for await (const delta of thinkWithLlmStream(system, user, maxTokens, 20000)) {
            got = true
            full += delta
            pending += delta
            send({ delta })
            const pulled = pullSentences(pending)
            pending = pulled.rest
            for (const sentence of pulled.sentences) send({ sentence })
          }
          if (!got) {
            const fallback = await nemotron(system, user, maxTokens, 14000)
            full = (fallback || 'Je vous aide. Reformulez en une phrase ce que vous voulez obtenir, et j’agis.').slice(0, 4000)
            pending = full
            const pulled = pullSentences(pending + ' ')
            pending = pulled.rest
            for (const sentence of pulled.sentences) send({ sentence })
          }
          const tail = pending.trim()
          if (tail) send({ sentence: tail })
          send({ done: true, reply: full.slice(0, 8000), kind })
        } catch {
          send({
            done: true,
            reply: 'Je traite votre demande. Reformulez en une phrase si besoin.',
            kind,
          })
        }
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const reply = await nemotron(system, user, maxTokens, 14000)
  return Response.json({
    reply: (reply || 'Je vous aide. Reformulez en une phrase ce que vous voulez obtenir, et j’agis.').slice(0, 8000),
    kind,
  })
}
