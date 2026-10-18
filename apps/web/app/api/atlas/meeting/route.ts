import { meetingFallback, parseMeeting, type AgentProfile } from '@/lib/agent-voice'
import { nemotron } from '@/lib/nemotron'

const SYSTEM = `You facilitate a meeting between AI employees of a company. Each participant states their position based on their role, then you write the decision. Reply only with a JSON object, no surrounding text.
Shape: {"positions":["FirstName (role): one-sentence position"],"decision":"decision in one or two sentences, including what needs the leader's approval"}
One position per participant, one sentence each. No external tools are connected. Invent no figures. Primary language: English.`

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { topic?: string; organization?: string; people?: AgentProfile[] } | null
  const topic = body?.topic?.trim() || 'le point d’équipe'
  const people = (body?.people ?? []).filter((agent) => agent?.firstName && agent.role).slice(0, 6)
  if (people.length === 0) return Response.json(meetingFallback(topic, people))
  const roster = people.map((agent) => `${agent.firstName} ${agent.lastName}, ${agent.role} — ${agent.mission}`).join('\n')
  const raw = await nemotron(SYSTEM, `Entreprise : ${body?.organization ?? ''}\nSujet : ${topic}\nParticipants :\n${roster}`, 800, 40000)
  const outcome = raw ? parseMeeting(raw, topic, people) : meetingFallback(topic, people)
  return Response.json({ ...outcome, source: raw ? 'nemotron' : 'local' })
}
