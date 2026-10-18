import { ztcSkillsOf, ztcWorkflowOf } from '@atlas/domain'
import { agentFallback, agentSystemPrompt, type AgentProfile } from '@/lib/agent-voice'
import { deskSnapshot, formatDeskPrompt } from '@/lib/ztc-live'
import { nemotron } from '@/lib/nemotron'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    agent?: AgentProfile
    organization?: string
    colleagues?: string[]
    question?: string
    history?: string[]
    /** true = exécuter la mission maintenant avec compétences + données live */
    execute?: boolean
  } | null
  const agent = body?.agent
  if (!agent?.firstName || !agent.role) return Response.json({ error: 'agent' }, { status: 400 })
  const question = body?.question?.trim() ?? ''
  const history = (body?.history ?? []).slice(-6).join('\n')
  const skills = agent.skills?.length ? agent.skills : ztcSkillsOf(agent.firstName)
  const enriched: AgentProfile = {
    ...agent,
    skills,
    mission: agent.mission || ztcWorkflowOf(agent.firstName),
  }
  let liveBlock = ''
  try {
    const snap = await deskSnapshot(agent.firstName)
    liveBlock = formatDeskPrompt(snap)
  } catch {
    liveBlock = 'Données produit temporairement indisponibles — n’invente rien.'
  }
  const system = `${agentSystemPrompt(enriched, body?.organization ?? 'ZtcHosting', body?.colleagues ?? [])}

COMPÉTENCES ACTIVES : ${skills.join(', ')}.
FLUX MÉTIER : ${ztcWorkflowOf(agent.firstName)}
DONNÉES PRODUIT LIVE (seule vérité) :
${liveBlock}
${body?.execute ? 'MODE EXÉCUTION : traite la mission maintenant dans ton périmètre. Cite les preuves live. Dis ce que tu fais, ce qui est observé, et la suite (handoff si besoin).' : ''}`
  const prompt = question
    ? `${history ? `Échanges récents :\n${history}\n\n` : ''}${body?.execute ? 'Mission à exécuter' : 'Le dirigeant'} : ${question}`
    : 'Le dirigeant vous fait entrer dans la conversation. Présentez-vous en une phrase et dites sur quoi vous travaillez avec vos compétences.'
  const reply = await nemotron(system, prompt, body?.execute ? 900 : 640, body?.execute ? 45000 : 28000)
  return Response.json({
    reply: (reply || agentFallback(enriched, question)).slice(0, body?.execute ? 1400 : 800),
    source: reply ? 'nemotron' : 'local',
    skills,
    desk: agent.firstName,
  })
}
