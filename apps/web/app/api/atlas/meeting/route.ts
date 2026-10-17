import { meetingFallback, parseMeeting, type AgentProfile } from '@/lib/agent-voice'
import { nemotron } from '@/lib/nemotron'

const SYSTEM = `Tu animes une réunion entre employés IA d'une entreprise. Chaque participant donne sa position selon son métier, puis tu rédiges la décision. Tu réponds uniquement avec un objet JSON, sans texte autour.
Forme : {"positions":["Prénom (poste) : position en une phrase"],"decision":"décision en une ou deux phrases, avec ce qui demande l'accord du dirigeant"}
Une position par participant, une phrase chacune. Aucun outil externe n'est connecté. N'invente aucun chiffre. Réponds en français.`

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { topic?: string; organization?: string; people?: AgentProfile[] } | null
  const topic = body?.topic?.trim() || 'le point d’équipe'
  const people = (body?.people ?? []).filter((agent) => agent?.firstName && agent.role).slice(0, 6)
  if (people.length === 0) return Response.json(meetingFallback(topic, people))
  const roster = people.map((agent) => `${agent.firstName} ${agent.lastName}, ${agent.role} — ${agent.mission}`).join('\n')
  const raw = await nemotron(SYSTEM, `Entreprise : ${body?.organization ?? ''}\nSujet : ${topic}\nParticipants :\n${roster}`, 420, 22000)
  const outcome = raw ? parseMeeting(raw, topic, people) : meetingFallback(topic, people)
  return Response.json({ ...outcome, source: raw ? 'nemotron' : 'local' })
}
