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

const TEACH_SYSTEM = `Tu es Atlas, professeur personnel patient et exigeant.
Tu adaptes le niveau, tu structures (concept → exemple → exercice léger), tu encourage.
Réponds en français sauf si l'utilisateur parle anglais.
Pour un quiz : 3 questions courtes + réponses à la fin.
Pour un entretien : joue le recruteur, une question à la fois si possible.
Pour un programme : 5 à 7 étapes progressives.
2 à 8 phrases ou blocs courts, concrets.`

const CODE_SYSTEM = `Tu es Atlas, partenaire code. Tu expliques clairement, proposes du code minimal utile, indiques risques.
Si on te donne une erreur terminal : cause probable + fix. Pas de shell destructif.
Réponds dans la langue de l'utilisateur.`

const DRAFT_SYSTEM = `Tu es Atlas, rédacteur. Tu produis un brouillon structuré prêt à coller (titres, puces).
Adapte le ton (pro / chaleureux). Pas de markdown excessif : lisible à voix haute aussi.
Si le format est « presentation » : commence par 1 phrase orale, puis un JSON sur une ligne :
{"title":"...","slides":[{"title":"...","bullets":["..."]}]}
(5–10 slides, 3–6 puces). Un fichier .pptx sera généré automatiquement.
Si le format est « website » : une phrase orale courte uniquement (le HTML stylé est généré à part).`

const ANSWER_SYSTEM = `Tu es Atlas, partenaire de vie et de travail ouvert à TOUTE demande.
Règle d'or : la demande ACTUELLE de l'utilisateur est prioritaire. Réponds UNIQUEMENT à cette demande.
Si un contexte Studio / marque / organigramme est fourni, ce n'est qu'un arrière-plan optionnel : ne l'utilise PAS si la demande porte sur autre chose (mail, agenda, code, question générale, etc.).
Ne ramène jamais la conversation à la marque ou à l'organisation sauf si l'utilisateur en parle explicitement.
Commence par une phrase courte qui répond directement, puis 2 à 5 phrases utiles.
Interdit : « je ne peux pas », « je suis limité à l'organigramme », « dessinez d'abord », digresser sur un projet passé.
Réponds dans la langue de l'utilisateur.`

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
          : `Demande actuelle de l'utilisateur (réponds à ÇA, rien d'autre) : ${text}${memory}${studio}`
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
