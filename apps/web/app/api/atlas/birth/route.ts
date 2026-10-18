import { nemotron } from '@/lib/nemotron'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    organization?: string
    intention?: string
    agent?: {
      firstName?: string
      lastName?: string
      role?: string
      mission?: string
      skills?: string[]
      tools?: string[]
      department?: string
    }
  } | null
  const agent = body?.agent
  if (!agent?.firstName || !agent.role) return Response.json({ error: 'agent' }, { status: 400 })
  const skills = (agent.skills ?? []).join(', ')
  const tools = (agent.tools ?? []).join(', ')
  const spoken = await nemotron(
    `You are ${agent.firstName} ${agent.lastName ?? ''}, ${agent.role} at ${body?.organization || 'the company'}.
You were just hired. Write your role memory in English, 4 to 6 concrete sentences: mission, 2 measurable goals, who you collaborate with, which tools you will use. Invent no already-connected tools. Do not claim to send email.`,
    `Entreprise : ${body?.organization || ''}. Intention : ${body?.intention || ''}.
Département : ${agent.department || ''}. Mission prévue : ${agent.mission || agent.role}.
Compétences : ${skills || 'à préciser'}. Outils assignés (non reliés) : ${tools || 'aucun'}.`,
    640,
    28000,
  )
  const fallback = `${agent.firstName} porte ${agent.role} au département ${agent.department || 'l’équipe'}. Mission : ${agent.mission || agent.role}. Compétences : ${skills || 'à construire'}. Outils prévus, encore à relier : ${tools || 'à choisir'}.`
  return Response.json({ memory: (spoken || fallback).trim(), source: spoken ? 'nemotron' : 'local' })
}
