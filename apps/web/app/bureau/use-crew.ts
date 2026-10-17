'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CREW_CONNECTORS,
  CREW_ROLES,
  assignCrew,
  fallbackPlan,
  readySteps,
  type CrewMember,
  type CrewPlan,
  type CrewStep,
  type Recommendation,
  ZTC_ATLAS_RULES,
  isZtcOrganization,
} from '@atlas/domain'

export type CrewStatus = 'waiting' | 'working' | 'permission' | 'done' | 'failed' | 'skipped'

export interface CrewAction {
  at: number
  tool: string
  label: string
  url?: string
  ok?: boolean
}

export interface CrewSource {
  url: string
  host: string
  title: string
}

export interface CrewStepRun {
  step: CrewStep
  agentId: string | null
  agentName: string
  status: CrewStatus
  current: string
  actions: CrewAction[]
  sources: CrewSource[]
  report?: string
  table?: { columns: string[]; rows: string[][] }
  recommendations?: Recommendation[]
  html?: string
  startedAt?: number
  endedAt?: number
  tokens: number
}

export interface ChiefLine {
  at: number
  kind: 'info' | 'warn' | 'fix' | 'ask' | 'done'
  text: string
  stepId?: string
}

export interface CrewRun {
  id: string
  mission: string
  startedAt: number
  endedAt?: number
  status: 'planning' | 'running' | 'review' | 'done' | 'stopped'
  planSummary: string
  planSource: 'model' | 'local'
  steps: CrewStepRun[]
  chief: ChiefLine[]
  summary?: string
  site?: string
  report?: string
  tokens: number
  replay?: boolean
}

type WorkReply = {
  report: string
  tokens: number
  table?: CrewStepRun['table']
  recommendations?: Recommendation[]
  html?: string
}

const TOOL_ACTIONS = new Set(['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Calcul', 'Connecteur'])

export function toolsUsed(step: CrewStepRun) {
  return step.actions.filter((action) => TOOL_ACTIONS.has(action.tool)).length
}

export function durationOf(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')}`
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/atlas/crew', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`crew ${response.status}`)
  return response.json() as Promise<T>
}

function clone(run: CrewRun): CrewRun {
  return { ...run, steps: run.steps.map((step) => ({ ...step, actions: [...step.actions] })), chief: [...run.chief] }
}

function first(name: string) {
  return name.split(' ')[0] ?? name
}

/**
 * Mission d’équipe : ATLAS planifie, des agents spécialisés travaillent en parallèle
 * avec de vrais outils (recherche et lecture web, rédaction, calcul), puis ATLAS relit.
 */
export function useCrew({
  orgId,
  organization,
  members,
  connected,
}: {
  orgId: string | null
  organization: string
  members: CrewMember[]
  connected: Set<string>
}) {
  const historyKey = `atlas-crew-runs:${orgId ?? 'demo'}`
  const rulesKey = `atlas-crew-rules:${orgId ?? 'demo'}`
  const [run, setRun] = useState<CrewRun | null>(null)
  const [history, setHistory] = useState<CrewRun[]>([])
  const [rules, setRulesState] = useState('')
  const ref = useRef<CrewRun | null>(null)
  const answers = useRef(new Map<string, (yes: boolean) => void>())
  const token = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    try {
      setHistory(JSON.parse(window.localStorage.getItem(historyKey) || '[]') as CrewRun[])
    } catch {
      setHistory([])
    }
    const stored = window.localStorage.getItem(rulesKey) ?? ''
    setRulesState(stored || (isZtcOrganization(organization) ? ZTC_ATLAS_RULES : ''))
  }, [historyKey, rulesKey, organization])

  const setRules = useCallback((value: string) => {
    setRulesState(value)
    window.localStorage.setItem(rulesKey, value)
  }, [rulesKey])

  const commit = useCallback((change: (draft: CrewRun) => void, id?: number) => {
    if (!ref.current || (id !== undefined && id !== token.current)) return
    const draft = clone(ref.current)
    change(draft)
    ref.current = draft
    setRun(draft)
  }, [])

  const say = useCallback((kind: ChiefLine['kind'], text: string, id: number, stepId?: string) => {
    commit((draft) => { draft.chief.push({ at: Date.now(), kind, text, stepId }) }, id)
  }, [commit])

  const save = useCallback((finished: CrewRun) => {
    setHistory((current) => {
      const next = [finished, ...current.filter((item) => item.id !== finished.id)].slice(0, 6)
      try {
        window.localStorage.setItem(historyKey, JSON.stringify(next))
      } catch {
        window.localStorage.setItem(historyKey, JSON.stringify(next.slice(0, 2)))
      }
      return next
    })
  }, [historyKey])

  const stop = useCallback(() => {
    token.current += 1
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
    for (const resolve of answers.current.values()) resolve(false)
    answers.current.clear()
    if (ref.current && ref.current.status !== 'done') {
      const draft = clone(ref.current)
      draft.status = 'stopped'
      draft.endedAt = Date.now()
      for (const step of draft.steps) if (step.status === 'working' || step.status === 'waiting' || step.status === 'permission') step.status = 'skipped'
      ref.current = draft
      setRun(draft)
    }
  }, [])

  const answer = useCallback((stepId: string, yes: boolean) => {
    answers.current.get(stepId)?.(yes)
    answers.current.delete(stepId)
  }, [])

  const start = useCallback(async (mission: string) => {
    stop()
    const id = ++token.current
    const text = mission.trim()
    const startedAt = Date.now()
    ref.current = {
      id: `crew-${startedAt.toString(36)}`,
      mission: text,
      startedAt,
      status: 'planning',
      planSummary: '',
      planSource: 'local',
      steps: [],
      chief: [{ at: startedAt, kind: 'info', text: rules.trim() ? 'Je relis le règlement du bureau, puis je fais le plan.' : 'Je fais le plan de la mission.' }],
      tokens: 0,
    }
    setRun(ref.current)

    let plan: CrewPlan
    let source: 'model' | 'local' = 'local'
    try {
      const reply = await post<{ plan: CrewPlan; source: 'model' | 'local'; tokens: number }>({
        op: 'plan',
        mission: text,
        organization,
        rules,
        team: members.map((member) => `${member.name} (${member.role})`),
      })
      plan = reply.plan
      source = reply.source
      commit((draft) => { draft.tokens += reply.tokens }, id)
    } catch {
      plan = fallbackPlan(text)
    }
    if (id !== token.current) return
    const owners = assignCrew(plan.steps, members)
    const byId = new Map(members.map((member) => [member.id, member]))
    const counts = Object.entries(plan.steps.reduce<Record<string, number>>((acc, step) => {
      acc[step.role] = (acc[step.role] ?? 0) + 1
      return acc
    }, {})).map(([role, count]) => `${count} ${CREW_ROLES[role as CrewStep['role']].label.toLowerCase()}${count > 1 ? 's' : ''}`)
    commit((draft) => {
      draft.status = 'running'
      draft.planSummary = plan.summary
      draft.planSource = source
      draft.steps = plan.steps.map((step) => {
        const owner = owners[step.id] ? byId.get(owners[step.id]!) : undefined
        return {
          step,
          agentId: owner?.id ?? null,
          agentName: owner?.name ?? `${CREW_ROLES[step.role].label} (renfort)`,
          status: 'waiting',
          current: step.dependsOn.length ? 'J’attends les rapports de l’équipe' : 'Prêt',
          actions: [],
          sources: [],
          tokens: 0,
        }
      })
      draft.chief.push({ at: Date.now(), kind: 'info', text: `Je monte l’équipe : ${counts.join(', ')}. ${plan.summary}` })
    }, id)

    const total = plan.steps.length
    const finished = new Set<string>()
    const started = new Set<string>()
    const running = new Map<string, Promise<void>>()

    const patch = (stepId: string, change: (step: CrewStepRun) => void) => commit((draft) => {
      const step = draft.steps.find((item) => item.step.id === stepId)
      if (step) change(step)
    }, id)
    const act = (stepId: string, tool: string, label: string, extra: Partial<CrewAction> = {}) => patch(stepId, (step) => {
      step.actions.push({ at: Date.now(), tool, label, ...extra })
      step.current = label
    })
    const stepOf = (stepId: string) => ref.current?.steps.find((item) => item.step.id === stepId)

    const execute = async (step: CrewStep) => {
      const name = stepOf(step.id)?.agentName ?? CREW_ROLES[step.role].label
      if (step.approval) {
        patch(step.id, (item) => { item.status = 'permission'; item.current = 'Lève la main : attend votre accord' })
        say('ask', `${first(name)} lève la main : ${step.approval}`, id, step.id)
        const yes = await new Promise<boolean>((resolve) => answers.current.set(step.id, resolve))
        if (id !== token.current) return
        if (!yes) {
          patch(step.id, (item) => { item.status = 'skipped'; item.current = 'Action refusée par vous' })
          say('info', `D’accord, ${first(name)} ne le fait pas.`, id, step.id)
          return
        }
      }
      patch(step.id, (item) => { item.status = 'working'; item.startedAt = Date.now(); item.current = 'Je lis ma mission' })
      act(step.id, 'Read', 'Je lis la mission écrite par ATLAS')
      if (step.via) {
        const label = CREW_CONNECTORS.find((item) => item.provider === step.via)?.label ?? step.via
        act(step.id, 'Connecteur', connected.has(step.via)
          ? `Je passe par ${label}`
          : `Je passe par ${label} : pas encore relié, je prépare un brouillon`)
      }
      let reply: WorkReply
      if (step.role === 'chercheur') {
        act(step.id, 'WebSearch', 'Je cherche sur le web')
        const search = await post<{ queries: string[]; hits: Array<{ url: string; title: string }>; picks: Array<{ url: string; title: string }> }>({ op: 'search', step, mission: text })
        if (id !== token.current) return
        for (const query of search.queries) act(step.id, 'WebSearch', `« ${query} »`)
        const queue = [...search.picks, ...search.hits.filter((hit) => !search.picks.some((pick) => pick.url === hit.url))].slice(0, 7)
        const pages: Array<{ url: string; title: string; text: string; host: string }> = []
        const read = async (url: string) => {
          let host = url
          try { host = new URL(url).hostname.replace(/^www\./, '') } catch { /* url brute */ }
          act(step.id, 'WebFetch', `Je lis ${host}`, { url })
          const page = await post<{ url: string; host: string; title: string; ok: boolean; text: string; prices: string[] }>({ op: 'fetch', url })
          if (id !== token.current) return
          if (page.ok) {
            pages.push({ url: page.url, title: page.title, text: page.text, host: page.host })
            patch(step.id, (item) => { item.sources.push({ url: page.url, host: page.host, title: page.title }) })
            if (page.prices.length) act(step.id, 'Grep', `${page.prices.length} prix repérés sur ${page.host}`, { ok: true })
          } else {
            act(step.id, 'WebFetch', `${host} refuse la lecture, je passe au suivant`, { ok: false })
          }
        }
        await Promise.all(queue.slice(0, 3).map((hit) => read(hit.url)))
        for (const hit of queue.slice(3)) {
          if (pages.length >= 3 || id !== token.current) break
          await read(hit.url)
        }
        if (!pages.length && id === token.current) {
          const broad = step.target ? [step.target, `${step.target} site officiel`] : [step.title]
          act(step.id, 'WebSearch', 'Rien de lisible : j’élargis la recherche')
          const retry = await post<{ queries: string[]; hits: Array<{ url: string }>; picks: Array<{ url: string }> }>({ op: 'search', step, mission: text, queries: broad })
          for (const query of retry.queries) act(step.id, 'WebSearch', `« ${query} »`)
          const tried = new Set(queue.map((hit) => hit.url))
          for (const hit of [...retry.picks, ...retry.hits].filter((item, index, list) => !tried.has(item.url) && list.findIndex((other) => other.url === item.url) === index).slice(0, 5)) {
            if (pages.length >= 2 || id !== token.current) break
            await read(hit.url)
          }
        }
        if (id !== token.current) return
        act(step.id, 'Write', 'J’écris mon rapport sourcé')
        reply = await post<WorkReply>({ op: 'work', step, agent: name, mission: text, organization, rules, sources: pages })
      } else {
        const wanted = step.role === 'designer' || step.role === 'redacteur'
          ? ref.current!.steps.filter((item) => item.report && (step.dependsOn.includes(item.step.id) || item.step.role === 'chercheur'))
          : ref.current!.steps.filter((item) => item.report && step.dependsOn.includes(item.step.id))
        for (const input of wanted) act(step.id, 'Read', `Je lis le rapport de ${first(input.agentName)} · ${input.step.target ?? input.step.title}`)
        const recommendations = ref.current!.steps.find((item) => item.recommendations?.length)?.recommendations ?? []
        if (step.role === 'analyste') act(step.id, 'Calcul', 'Je ramène les prix au kilo et je calcule les médianes')
        if (step.role === 'designer') act(step.id, 'Write', 'Je construis index.html pour le téléphone')
        else act(step.id, 'Write', step.role === 'analyste' ? 'Je monte le tableau comparatif' : 'Je rédige le livrable')
        reply = await post<WorkReply>({
          op: 'work',
          step,
          agent: name,
          mission: text,
          organization,
          rules,
          recommendations,
          inputs: wanted.map((input) => ({ title: input.step.title, role: input.step.role, agent: input.agentName, target: input.step.target, report: input.report })),
        })
      }
      if (id !== token.current) return
      patch(step.id, (item) => {
        item.report = reply.report
        item.table = reply.table
        item.recommendations = reply.recommendations
        item.html = reply.html
        item.tokens += reply.tokens
        item.status = 'done'
        item.endedAt = Date.now()
        item.current = 'Rapport rendu à ATLAS'
        item.actions.push({ at: Date.now(), tool: 'Rapport', label: 'Rapport rendu à ATLAS' })
      })
      commit((draft) => { draft.tokens += reply.tokens }, id)
    }

    while (finished.size < total && id === token.current) {
      for (const step of readySteps(plan.steps, finished, started)) {
        started.add(step.id)
        running.set(step.id, execute(step)
          .catch(() => {
            patch(step.id, (item) => { item.status = 'failed'; item.endedAt = Date.now(); item.current = 'Je n’ai pas pu terminer' })
          })
          .finally(() => {
            finished.add(step.id)
            running.delete(step.id)
            const done = ref.current?.steps.filter((item) => item.status === 'done').length ?? 0
            const item = stepOf(step.id)
            if (item?.status === 'done') say('info', `${first(item.agentName)} a rendu ${item.step.role === 'chercheur' ? `son rapport${item.step.target ? ` sur ${item.step.target}` : ''}` : item.step.role === 'designer' ? 'le site' : item.step.role === 'analyste' ? 'le tableau comparatif' : `son livrable · ${item.step.title}`}. J’attends l’équipe : ${done} rapport${done > 1 ? 's' : ''} sur ${total}.`, id, step.id)
            if (item?.status === 'failed') say('warn', `${first(item.agentName)} n’a pas pu terminer « ${item.step.title} ». Je continue avec le reste.`, id, step.id)
          }))
      }
      if (!running.size) break
      await Promise.race(running.values())
    }
    if (id !== token.current) return

    commit((draft) => { draft.status = 'review' }, id)
    say('info', 'Tous les rapports sont là. Je relis tout.', id)
    const steps = ref.current!.steps
    const designer = steps.find((item) => item.html)
    const recommendations = steps.find((item) => item.recommendations?.length)?.recommendations ?? []
    try {
      const review = await post<{ mismatches: unknown[]; html: string; fixed: boolean; message: string; summary: string; tokens: number }>({
        op: 'review',
        mission: text,
        recommendations,
        html: designer?.html ?? '',
        inputs: steps.filter((item) => item.report).map((item) => ({ title: item.step.title, role: item.step.role, agent: item.agentName, target: item.step.target, report: item.report })),
      })
      if (id !== token.current) return
      if (review.message) {
        say('warn', review.message, id, designer?.step.id)
        if (designer) patch(designer.step.id, (item) => {
          item.html = review.html
          item.actions.push({ at: Date.now(), tool: 'Edit', label: 'Prix alignés par ATLAS' })
        })
        say('fix', review.fixed ? 'Corrigé par ATLAS, tout seul : le site affiche maintenant les prix de l’analyste.' : 'J’ai corrigé ce que j’ai pu ; vérifiez les prix restants.', id, designer?.step.id)
      } else if (designer && recommendations.length) {
        say('info', 'Les prix du site et du tableau sont cohérents.', id)
      }
      commit((draft) => {
        draft.summary = review.summary
        draft.tokens += review.tokens
      }, id)
    } catch {
      commit((draft) => { draft.summary = 'Mission terminée. La relecture automatique n’a pas répondu : vérifiez les livrables.' }, id)
    }
    commit((draft) => {
      draft.status = 'done'
      draft.endedAt = Date.now()
      draft.site = draft.steps.find((item) => item.html)?.html
      draft.report = [
        `# ${draft.mission}`,
        '',
        `_${draft.steps.length} agents · ${durationOf(draft.endedAt - draft.startedAt)} de travail · ${new Date(draft.startedAt).toLocaleDateString('fr-CH')}_`,
        '',
        '## Résumé d’ATLAS',
        draft.summary ?? '',
        '',
        ...draft.steps.filter((item) => item.report).map((item) => `---\n\n_${item.agentName} · ${CREW_ROLES[item.step.role].label}_\n\n${item.report}`),
      ].join('\n')
      const doneCount = draft.steps.filter((item) => item.status === 'done').length
      draft.chief.push({ at: Date.now(), kind: 'done', text: `Mission terminée : ${doneCount} agent${doneCount > 1 ? 's' : ''}, ${durationOf(draft.endedAt - draft.startedAt)} de travail.` })
    }, id)
    if (ref.current) save(ref.current)
  }, [commit, connected, members, organization, rules, save, say, stop])

  /** Relecture d’une mission passée : rejoue la chronologie sans appeler le modèle. */
  const replay = useCallback((runId: string) => {
    const source = history.find((item) => item.id === runId)
    if (!source) return
    stop()
    const id = ++token.current
    const span = Math.max(1, (source.endedAt ?? Date.now()) - source.startedAt)
    const speed = Math.max(1, span / 30_000)
    const base: CrewRun = {
      ...clone(source),
      replay: true,
      status: 'running',
      endedAt: undefined,
      summary: undefined,
      site: undefined,
      chief: [],
      steps: source.steps.map((step) => ({ ...step, status: 'waiting', actions: [], sources: [], report: undefined, table: undefined, html: undefined, current: 'Prêt', startedAt: undefined, endedAt: undefined })),
    }
    ref.current = base
    setRun(base)
    const events: Array<{ at: number; apply: (draft: CrewRun) => void }> = []
    source.chief.forEach((line) => events.push({ at: line.at, apply: (draft) => { draft.chief.push(line) } }))
    source.steps.forEach((step, index) => {
      if (step.startedAt) events.push({ at: step.startedAt, apply: (draft) => { draft.steps[index]!.status = 'working'; draft.steps[index]!.startedAt = step.startedAt } })
      step.actions.forEach((action) => events.push({ at: action.at, apply: (draft) => {
        draft.steps[index]!.actions.push(action)
        draft.steps[index]!.current = action.label
      } }))
      if (step.endedAt) events.push({ at: step.endedAt, apply: (draft) => { draft.steps[index] = { ...step } } })
    })
    events.push({ at: source.endedAt ?? source.startedAt + span, apply: (draft) => {
      Object.assign(draft, { ...clone(source), replay: true })
    } })
    events.sort((a, b) => a.at - b.at)
    timers.current = events.map((event) => setTimeout(() => commit(event.apply, id), (event.at - source.startedAt) / speed))
  }, [commit, history, stop])

  const view = useCallback((runId: string) => {
    const source = history.find((item) => item.id === runId)
    if (!source) return
    stop()
    ref.current = clone(source)
    setRun(ref.current)
  }, [history, stop])

  useEffect(() => () => { for (const timer of timers.current) clearTimeout(timer) }, [])

  /** Ce que le Bureau 3D affiche au-dessus de chaque employé pendant la mission. */
  const live = useMemo(() => {
    const tasks: Record<string, string> = {}
    const working = new Set<string>()
    const handoffs: Array<{ key: string; from: string; to: string; what: string }> = []
    if (!run || run.status === 'stopped') return { tasks, working, handoffs }
    for (const step of run.steps) {
      if (!step.agentId) continue
      if (step.status === 'done') {
        const what = step.step.role === 'chercheur' ? 'son rapport' : step.step.role === 'analyste' ? 'le tableau' : step.step.role === 'designer' ? 'la maquette' : 'son livrable'
        for (const next of run.steps) {
          if (next.agentId && next.agentId !== step.agentId && next.step.dependsOn.includes(step.step.id)) {
            handoffs.push({ key: `${run.id}:${step.step.id}>${next.step.id}`, from: step.agentId, to: next.agentId, what })
          }
        }
      }
      if (run.status === 'done') continue
      if (step.status === 'working') {
        tasks[step.agentId] = step.current
        working.add(step.agentId)
      } else if (step.status === 'permission' && !tasks[step.agentId]) {
        tasks[step.agentId] = '✋ Attend votre accord'
      }
    }
    return { tasks, working, handoffs }
  }, [run])

  return { run, history, rules, setRules, start, stop, answer, replay, view, live }
}

export type CrewApi = ReturnType<typeof useCrew>
