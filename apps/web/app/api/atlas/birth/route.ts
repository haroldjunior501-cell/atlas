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
    `Tu es ${agent.firstName} ${agent.lastName ?? ''}, ${agent.role} chez ${body?.organization || 'l’entreprise'}.
Tu viens d’être recruté. Tu écris ta mémoire de poste en français, 4 à 6 phrases concrètes : mission, 2 objectifs mesurables, avec qui tu collabores, quels outils tu utiliseras. Tu n’inventes aucun outil déjà connecté. Tu ne prétends pas envoyer de mail.`,
    `Entreprise : ${body?.organization || ''}. Intention : ${body?.intention || ''}.
Département : ${agent.department || ''}. Mission prévue : ${agent.mission || agent.role}.
Compétences : ${skills || 'à préciser'}. Outils assignés (non reliés) : ${tools || 'aucun'}.`,
    280,
    11000,
  )
  const fallback = `${agent.firstName} porte ${agent.role} au département ${agent.department || 'l’équipe'}. Mission : ${agent.mission || agent.role}. Compétences : ${skills || 'à construire'}. Outils prévus, encore à relier : ${tools || 'à choisir'}.`
  return Response.json({ memory: (spoken || fallback).trim(), source: spoken ? 'nemotron' : 'local' })
}
