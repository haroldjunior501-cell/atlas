'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { Agent, DelegationLevel } from '@atlas/domain'
import type { CreateAgentRequest, OrganizationChartResponse, UpdateAgentRequest } from '@atlas/contracts'
import { gateway } from '@/lib/atlas'

function initials(agent: Agent): string {
  return `${agent.firstName.charAt(0)}${agent.lastName.charAt(0)}`.toUpperCase()
}

function Branch({
  agent,
  childrenByManager,
  selectedId,
  onSelect,
}: {
  agent: Agent
  childrenByManager: Map<string, Agent[]>
  selectedId: string | null
  onSelect: (agent: Agent) => void
}) {
  const children = childrenByManager.get(agent.id) ?? []
  return (
    <li>
      <button
        type="button"
        className={agent.id === selectedId ? 'node selected' : 'node'}
        onClick={() => onSelect(agent)}
      >
        <span className="person">
          <span className="avatar">{initials(agent)}</span>
          <span>
            <strong>{agent.firstName} {agent.lastName}</strong>
            <em>{agent.role}</em>
          </span>
        </span>
      </button>
      {children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <Branch
              key={child.id}
              agent={child}
              childrenByManager={childrenByManager}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function Builder() {
  const orgId = useSearchParams().get('org')
  const [chart, setChart] = useState<OrganizationChartResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [mission, setMission] = useState('')
  const [traits, setTraits] = useState('')
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    role: '',
    mission: '',
    departmentName: 'Marketing',
    reportsToId: '',
  })

  useEffect(() => {
    if (!orgId) return
    gateway<OrganizationChartResponse>(`/v1/organizations/${orgId}`)
      .then(setChart)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Organisation introuvable.'))
  }, [orgId])

  const selected = chart?.agents.find((agent) => agent.id === selectedId) ?? null

  useEffect(() => {
    setMission(selected?.mission ?? '')
    setTraits(selected?.personality.traits.join(', ') ?? '')
  }, [selected])

  const childrenByManager = useMemo(() => {
    const map = new Map<string, Agent[]>()
    for (const agent of chart?.agents ?? []) {
      if (!agent.reportsToId) continue
      const list = map.get(agent.reportsToId) ?? []
      list.push(agent)
      map.set(agent.reportsToId, list)
    }
    return map
  }, [chart])

  const roots = (chart?.agents ?? []).filter((agent) => agent.reportsToId === null)

  async function saveProfile() {
    if (!selected) return
    const patch: UpdateAgentRequest = {
      mission,
      traits: traits.split(',').map((trait) => trait.trim()).filter(Boolean),
    }
    const updated = await gateway<Agent>(`/v1/agents/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    setChart((current) => current && ({
      ...current,
      agents: current.agents.map((agent) => (agent.id === updated.id ? updated : agent)),
    }))
  }

  async function createAgent() {
    if (!orgId || !chart) return
    const body: CreateAgentRequest = {
      organizationId: orgId,
      departmentName: draft.departmentName,
      firstName: draft.firstName,
      lastName: draft.lastName,
      role: draft.role,
      mission: draft.mission,
      skills: [],
      traits: [],
      delegation: 'approval' satisfies DelegationLevel,
      permissions: [],
      reportsToId: draft.reportsToId || null,
    }
    const created = await gateway<Agent>('/v1/agents', { method: 'POST', body: JSON.stringify(body) })
    setChart({ ...chart, agents: [...chart.agents, created] })
    setCreating(false)
    setSelectedId(created.id)
  }

  if (!orgId) {
    return <main className="studio"><p>Décris l’entreprise depuis le Studio.</p></main>
  }

  return (
    <main className="workspace">
      <header className="workspace-bar">
        <div>
          <p className="brand">ATLAS STUDIO</p>
          <p>{chart?.organization.intention ?? 'Chargement de l’organisation…'}</p>
        </div>
        <div>
          <Link href="/">Retour</Link>
          <button type="button" onClick={() => setCreating(true)}>Ajouter un agent</button>
        </div>
      </header>
      <div className="workspace-body">
        <section className="chart">
          {error ? <p className="studio-error">{error}</p> : null}
          <ul className="org">
            <li>
              <div className="founder">
                <strong>Vous</strong>
                <em>CEO</em>
              </div>
              <ul>
                {roots.map((agent) => (
                  <Branch
                    key={agent.id}
                    agent={agent}
                    childrenByManager={childrenByManager}
                    selectedId={selectedId}
                    onSelect={(item) => {
                      setCreating(false)
                      setSelectedId(item.id)
                    }}
                  />
                ))}
              </ul>
            </li>
          </ul>
        </section>
        <aside className="dossier">
          {creating ? (
            <>
              <h2>Nouvel employé</h2>
              <div className="row">
                <label>Prénom<input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /></label>
                <label>Nom<input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></label>
              </div>
              <label>Rôle<input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} /></label>
              <label>Département<input value={draft.departmentName} onChange={(event) => setDraft({ ...draft, departmentName: event.target.value })} /></label>
              <label>
                Rattaché à
                <select value={draft.reportsToId} onChange={(event) => setDraft({ ...draft, reportsToId: event.target.value })}>
                  <option value="">Le CEO</option>
                  {(chart?.agents ?? []).map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</option>
                  ))}
                </select>
              </label>
              <label>Mission<textarea value={draft.mission} onChange={(event) => setDraft({ ...draft, mission: event.target.value })} /></label>
              <button type="button" onClick={() => void createAgent()} disabled={!draft.firstName || !draft.role}>Créer</button>
            </>
          ) : selected ? (
            <>
              <p className="kicker">{selected.delegation}</p>
              <h2>{selected.firstName} {selected.lastName}</h2>
              <p>{selected.role}</p>
              <div className="chips">{selected.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
              <label>Mission<textarea value={mission} onChange={(event) => setMission(event.target.value)} /></label>
              <label>Personnalité<textarea value={traits} onChange={(event) => setTraits(event.target.value)} /></label>
              <button type="button" onClick={() => void saveProfile()}>Enregistrer</button>
            </>
          ) : (
            <>
              <h2>Organigramme</h2>
              <p className="lead">Sélectionne un employé pour ajuster sa mission et sa personnalité.</p>
            </>
          )}
        </aside>
      </div>
    </main>
  )
}
