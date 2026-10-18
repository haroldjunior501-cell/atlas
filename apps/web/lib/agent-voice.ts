export interface AgentProfile {
  firstName: string
  lastName: string
  role: string
  mission: string
  skills?: string[]
  traits?: string[]
  tone?: string
  hours?: string
  delegation?: string
  objectives?: Array<{ label: string; metric?: string | null; target?: string | null; dueAt?: string | null }>
  tools?: string[]
  voice?: string
  knowledge?: string[]
  memory?: string
}

export function agentSystemPrompt(agent: AgentProfile, organization: string, colleagues: string[]): string {
  const skills = agent.skills?.length ? agent.skills.join(', ') : 'non précisées'
  const traits = agent.traits?.length ? agent.traits.join(', ') : 'professionnel'
  const tone = agent.tone || 'professionnel'
  const hours = agent.hours || '9h–18h, lundi–vendredi'
  const kpis = (agent.objectives ?? [])
    .map((item) => `${item.label}${item.target ? ` : ${item.target}` : ''}${item.metric ? ` ${item.metric}` : ''}${item.dueAt ? ` avant ${item.dueAt}` : ''}`)
    .join(' ; ') || 'non encore chiffrés'
  const tools = agent.tools?.length
    ? `${agent.tools.join(', ')} sont assignés à ton poste mais aucun n’est relié aujourd’hui`
    : 'aucun outil n’est encore assigné'
  const autonomy = agent.delegation === 'autonomous'
    ? 'Tu peux agir seul dans ton périmètre.'
    : agent.delegation === 'restricted'
      ? 'Tu restes dans un périmètre restreint.'
      : 'Toute action sensible passe par l’accord du dirigeant.'
  const voice = agent.voice ? `Voix : ${agent.voice}.` : ''
  const knowledge = agent.knowledge?.length
    ? `Collections ouvertes : ${agent.knowledge.join(', ')}.`
    : 'Aucune collection ne t’est ouverte pour l’instant.'
  const memory = agent.memory ? `Ta mémoire de poste : ${agent.memory}` : 'Ta mémoire de poste n’est pas encore écrite.'
  return `Tu es ${agent.firstName} ${agent.lastName}, ${agent.role} chez ${organization}. Ta mission : ${agent.mission}. Compétences : ${skills}. Personnalité : ${traits}. Ton de communication : ${tone}. Disponibilité : ${hours}. ${voice} Objectifs : ${kpis}. Outils : ${tools}. ${autonomy} ${knowledge} ${memory}
Collègues : ${colleagues.join(', ') || 'aucun'}.
ATLAS est ton orchestrateur : il te supervise, te confie des missions et peut te parler au nom du dirigeant. Tu rapports à ATLAS et au dirigeant. Tu restes dans ton périmètre métier (hébergement / support / sécurité / perf / facturation / etc.). Tu n’inventes aucun prix, SLA, client ni état serveur.
Tu as une mémoire de conversation individuelle avec le dirigeant. Le dossier partagé de l’entreprise n’est lisible que s’il t’a été ouvert. Tu ne dis jamais que tu vas consulter Gmail, le CRM ou les analytics toi-même tant qu’ils ne sont pas reliés.
You speak to the leader in the first person, in two to four short sentences, in English by default (mirror their language if clearly different), in your tone. Stay in your role. Invent no figures or clients: if data is missing, say which and who should provide it or which tool to connect.`
}

export function agentFallback(agent: AgentProfile, question: string): string {
  if (!question.trim()) {
    return `Hello, this is ${agent.firstName}, ${agent.role}. I'm listening.`
  }
  return `This is ${agent.firstName}, ${agent.role}. On “${question.trim()}”, I start from my mission: ${agent.mission} I can propose a first plan as soon as you assign the task.`
}

export interface MeetingOutcome {
  positions: string[]
  decision: string
}

export function meetingFallback(topic: string, people: AgentProfile[]): MeetingOutcome {
  return {
    positions: people.map((agent) => `${agent.firstName} (${agent.role}) : prépare sa partie sur ${topic}.`),
    decision: `Décision proposée : avancer sur ${topic}, chaque participant rend sa partie. Votre accord est requis avant toute dépense.`,
  }
}

export function parseMeeting(raw: string, topic: string, people: AgentProfile[]): MeetingOutcome {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return meetingFallback(topic, people)
  try {
    const body = JSON.parse(match[0]) as { positions?: unknown; decision?: unknown }
    const positions = Array.isArray(body.positions)
      ? body.positions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
      : []
    const decision = typeof body.decision === 'string' ? body.decision.trim() : ''
    if (positions.length === 0 || !decision) return meetingFallback(topic, people)
    return { positions, decision }
  } catch {
    return meetingFallback(topic, people)
  }
}
