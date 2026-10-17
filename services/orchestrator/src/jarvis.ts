import type { Id } from '@atlas/domain'
import { CONNECTOR_CATALOG } from '@atlas/domain'
import type { AtlasOrchestrator } from './orchestrator'
import { askNim, forecastLoad, localReply } from './nvidia'

export const JARVIS = {
  wakeWord: 'jarvis',
  language: 'fr-FR',
  pipeline: ['listen', 'think', 'speak'],
} as const

export type JarvisIntent =
  | 'listen'
  | 'brief'
  | 'tasks'
  | 'decisions'
  | 'approve'
  | 'reject'
  | 'meetings'
  | 'team'
  | 'load'
  | 'tools'
  | 'mission'
  | 'compose'

export interface JarvisResult {
  heard: string
  intent: JarvisIntent
  reply: string
  organizationId: string | null
}

export function stripWake(text: string): string {
  return text.replace(/jarvis/gi, ' ').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim()
}

export function interpret(text: string): JarvisIntent {
  const heard = stripWake(text).toLowerCase()
  if (!heard) return 'listen'
  if (/approuv|valide/.test(heard)) return 'approve'
  if (/refus|rejet/.test(heard)) return 'reject'
  if (/tâche|tache/.test(heard)) return 'tasks'
  if (/décision|decision|en attente/.test(heard)) return 'decisions'
  if (/réunion|reunion|agenda|calendrier/.test(heard)) return 'meetings'
  if (/surcharge|débord|debord|observ/.test(heard)) return 'load'
  if (/outil|connecteur|gmail|slack|notion/.test(heard)) return 'tools'
  if (/découpe|decoupe|répart|repart|mission/.test(heard)) return 'mission'
  if (/^(montre|liste|qui)\b/.test(heard) && /équipe|equipe|employé|employe/.test(heard)) return 'team'
  if (/brief|bonjour|situation/.test(heard)) return 'brief'
  return 'compose'
}

function latestOrganization(atlas: AtlasOrchestrator, actorId: Id, requested?: string) {
  const owned = [...atlas.db.organizations.values()].filter((item) => item.ownerId === actorId)
  if (requested) return owned.find((item) => item.id === requested) ?? owned.at(-1) ?? null
  return owned.at(-1) ?? null
}

export async function runJarvis(
  atlas: AtlasOrchestrator,
  actorId: Id,
  text: string,
  organizationId?: string,
): Promise<JarvisResult> {
  const heard = stripWake(text)
  const intent = interpret(text)
  const organization = latestOrganization(atlas, actorId, organizationId)
  const missing = 'Aucune organisation n’est encore composée. Dites : Jarvis, monte une équipe.'

  if (intent === 'listen') {
    return { heard, intent, reply: 'Je vous écoute.', organizationId: organization?.id ?? null }
  }

  if (intent === 'compose') {
    const created = await atlas.createOrganization(actorId, heard)
    const roster = created.agents.map((agent) => ({ firstName: agent.firstName, role: agent.role }))
    const forecast = await forecastLoad(roster.map((agent) => ({
      role: agent.role,
      openTasks: 0,
      costEur: 0,
      latencyMs: 0,
    })))
    const nim = await askNim(heard, roster.map((agent) => `${agent.firstName} ${agent.role}`).join(', '))
    return {
      heard,
      intent,
      reply: nim ?? localReply(roster, forecast.items),
      organizationId: created.organization.id,
    }
  }

  if (!organization) return { heard, intent, reply: missing, organizationId: null }
  const state = atlas.memory.recall(organization.id)
  if (!state) return { heard, intent, reply: missing, organizationId: organization.id }

  if (intent === 'brief') {
    return { heard, intent, reply: atlas.memory.briefing(organization.id), organizationId: organization.id }
  }

  if (intent === 'tasks') {
    const open = state.tasks.filter((task) => task.status !== 'done')
    const reply = open.length === 0
      ? 'Aucune tâche en cours.'
      : `${open.length} tâches en cours. ${open.slice(0, 3).map((task) => task.title).join('. ')}.`
    return { heard, intent, reply, organizationId: organization.id }
  }

  if (intent === 'decisions') {
    const pending = state.decisions.filter((decision) => decision.status === 'pending')
    const reply = pending.length === 0
      ? 'Aucune décision en attente.'
      : `${pending.length} décision${pending.length > 1 ? 's' : ''} en attente. ${pending[0]?.title ?? ''}. Dites : Jarvis, approuve.`
    return { heard, intent, reply, organizationId: organization.id }
  }

  if (intent === 'approve' || intent === 'reject') {
    const pending = state.decisions.find((decision) => decision.status === 'pending')
    if (!pending) {
      return { heard, intent, reply: 'Aucune décision en attente.', organizationId: organization.id }
    }
    const status = intent === 'approve' ? 'approved' : 'rejected'
    atlas.resolveDecision(actorId, pending.id, status)
    const reply = status === 'approved'
      ? `Décision approuvée : ${pending.title}.`
      : `Décision refusée : ${pending.title}.`
    return { heard, intent, reply, organizationId: organization.id }
  }

  if (intent === 'meetings') {
    const reply = state.meetings.length === 0
      ? 'Aucune réunion au calendrier.'
      : state.meetings.slice(0, 3).map((meeting) => meeting.title).join('. ') + '.'
    return { heard, intent, reply, organizationId: organization.id }
  }

  if (intent === 'team') {
    const names = state.agents.slice(0, 5).map((agent) => `${agent.firstName}, ${agent.role}`)
    return {
      heard,
      intent,
      reply: names.length ? `${names.join('. ')}.` : 'Aucun employé en poste.',
      organizationId: organization.id,
    }
  }

  if (intent === 'load') {
    const forecast = await forecastLoad(state.agents.map((agent) => ({
      role: agent.role,
      openTasks: state.tasks.filter((task) => task.agentId === agent.id && task.status !== 'done').length,
      costEur: 0,
      latencyMs: 0,
    })))
    const hot = forecast.items.filter((item) => item.overloaded).map((item) => item.role)
    return {
      heard,
      intent,
      reply: hot.length ? `${hot.join(', ')} risque d’être en surcharge.` : 'Aucun employé n’est en surcharge.',
      organizationId: organization.id,
    }
  }

  if (intent === 'tools') {
    const labels = CONNECTOR_CATALOG.slice(0, 4).map((item) => item.label).join(', ')
    return {
      heard,
      intent,
      reply: `${labels} ne sont pas connectés. Aucun secret n’est configuré.`,
      organizationId: organization.id,
    }
  }

  const roles = state.agents.map((agent) => agent.role)
  const steps = atlas.decompose(heard, organization.id).slice(0, 3)
  const reply = steps.length === 0 || roles.length === 0
    ? 'Aucun rôle pour porter cette mission.'
    : steps.map((step) => `${step.role} : ${step.task}`).join(' ')
  return { heard, intent, reply, organizationId: organization.id }
}
