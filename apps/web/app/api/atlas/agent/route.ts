import { agentFallback, agentSystemPrompt, type AgentProfile } from '@/lib/agent-voice'
import { nemotron } from '@/lib/nemotron'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    agent?: AgentProfile
    organization?: string
    colleagues?: string[]
    question?: string
    history?: string[]
  } | null
  const agent = body?.agent
  if (!agent?.firstName || !agent.role) return Response.json({ error: 'agent' }, { status: 400 })
  const question = body?.question?.trim() ?? ''
  const history = (body?.history ?? []).slice(-6).join('\n')
  const system = agentSystemPrompt(agent, body?.organization ?? 'l’organisation', body?.colleagues ?? [])
  const prompt = question
    ? `${history ? `Échanges récents :\n${history}\n\n` : ''}Le dirigeant : ${question}`
    : 'Le dirigeant vous fait entrer dans la conversation. Présentez-vous en une phrase et dites sur quoi vous travaillez.'
  const reply = await nemotron(system, prompt, 260)
  return Response.json({ reply: (reply || agentFallback(agent, question)).slice(0, 800), source: reply ? 'nemotron' : 'local' })
}
