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
Tu as une mémoire de conversation individuelle avec le dirigeant. Le dossier partagé de l’entreprise n’est lisible que s’il t’a été ouvert. Tu ne dis jamais que tu vas consulter Gmail, le CRM ou les analytics toi-même tant qu’ils ne sont pas reliés.
Tu parles au dirigeant, à la première personne, en deux à quatre phrases courtes, dans sa langue et dans ton ton. Tu restes dans ton métier. Tu n’inventes aucun chiffre ni aucun client : si une donnée te manque, dis laquelle et qui doit la fournir ou quel outil relier.`
}

export function agentFallback(agent: AgentProfile, question: string): string {
  if (!question.trim()) {
    return `Bonjour, ici ${agent.firstName}, ${agent.role}. Je vous écoute.`
  }
  return `Ici ${agent.firstName}, ${agent.role}. Sur « ${question.trim()} », je pars de ma mission : ${agent.mission} Je vous propose un premier plan dès que vous me confiez la tâche.`
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
