'use client'

import { useState } from 'react'
import { CONNECTOR_CATALOG, formatChf, spacesFor, ZTC_CONNECTORS, type OfficeAgentPlacement, type OfficeArchetype, type OfficeSpaceKind } from '@atlas/domain'
import { WORK_LABEL, type ControlResult, type OfficeControl } from './office-control'
import styles from './bureau-live.module.css'

const PRESENCE: Record<string, string> = {
  working: 'En activité',
  online: 'En ligne',
  idle: 'En pause',
  offline: 'Hors ligne',
}

function useAction() {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<ControlResult | null>(null)
  async function go(job: () => Promise<ControlResult>) {
    setBusy(true)
    setNote(null)
    const result = await job()
    setNote(result)
    setBusy(false)
    return result
  }
  return { busy, note, setNote, go }
}

function Note({ note }: { note: ControlResult | null }) {
  if (!note) return null
  return <div className={note.ok ? styles.noteOk : styles.noteBad}>{note.note}</div>
}

export function AgentCard({
  agent,
  room,
  control,
  simulatedTask,
  records,
  billed,
  full,
  onClose,
  onInvoices,
  onExitFull,
}: {
  agent: OfficeAgentPlacement
  room: string | undefined
  control: OfficeControl
  simulatedTask: string | undefined
  records: number
  billed: number
  full: boolean
  onClose: () => void
  onInvoices: () => void
  onExitFull: () => void
}) {
  const { busy, note, go } = useAction()
  const [mission, setMission] = useState('')
  const [confirm, setConfirm] = useState(false)
  const work = control.work(agent.id)
  const tools = control.tools(agent.id)
  const delegation = control.delegation(agent.id)
  const granted = new Set(tools.filter((t) => t.granted).map((t) => t.provider))
  const others = control.departments.filter((d) => d.id !== agent.departmentId)

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.agentHead}>
          <i className={styles.avatar} style={{ background: agent.color }}>{agent.name.slice(0, 1)}</i>
          <div>
            <div className={styles.kicker}>{room}</div>
            <h3>{agent.name}</h3>
            <div className={styles.sub}>{agent.role}</div>
          </div>
        </div>
        <button type="button" className={styles.close} aria-label="Fermer la fiche" onClick={onClose}>×</button>
      </div>
      <div className={styles.metrics}>
        <div><span>Statut</span><strong className={styles.small}><i className={styles.presence} data-status={agent.status} /> {PRESENCE[agent.status] ?? agent.status}</strong></div>
        <div><span>Missions</span><strong>{work.length || '—'}</strong></div>
        <div><span>Facturé</span><strong className={styles.small}>{records > 0 ? formatChf(billed) : '—'}</strong></div>
      </div>

      {control.live && delegation ? (
        <div className={styles.inline}>
          <span>Autonomie</span>
          <div className={styles.segment}>
            <button type="button" className={delegation === 'autonomous' ? styles.segOn : undefined} disabled={busy} onClick={() => void go(() => control.autonomy(agent.id, 'autonomous'))}>Autonome</button>
            <button type="button" className={delegation !== 'autonomous' ? styles.segOn : undefined} disabled={busy} onClick={() => void go(() => control.autonomy(agent.id, 'approval'))}>Sous accord</button>
          </div>
        </div>
      ) : null}

      <div className={styles.section}>Flux de travail</div>
      {work.length ? (
        <ul className={styles.work}>
          {work.map((item) => (
            <li key={item.id} data-status={item.status}>
              <i />
              <span><strong>{item.title}</strong><small>{WORK_LABEL[item.status]}{item.source === 'decision' ? ' · décision' : item.source === 'journal' ? ' · consigne' : ''}</small></span>
              {item.taskId && item.status !== 'done' ? (
                <button type="button" disabled={busy} onClick={() => void go(() => control.setTaskStatus(item.taskId!, 'done'))}>Terminer</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.task}>{simulatedTask?.trim() || 'En poste · en attente d’une mission produit.'}</div>
      )}

      {control.live ? (
        <>
          <form
            className={styles.formRow}
            onSubmit={(event) => {
              event.preventDefault()
              const text = mission.trim()
              if (!text) return
              void go(() => control.mission(agent.id, text)).then((r) => { if (r.ok) setMission('') })
            }}
          >
            <input value={mission} onChange={(event) => setMission(event.target.value)} placeholder={`Mission pour ${agent.name.split(' ')[0]}…`} />
            <button type="submit" disabled={busy || !mission.trim()}>Envoyer</button>
          </form>

          <div className={styles.section}>Outils réels</div>
          <div className={styles.tools2}>
            {tools.map((tool) => (
              <button
                key={tool.provider}
                type="button"
                data-state={tool.granted ? (tool.connected ? 'live' : 'todo') : 'off'}
                disabled={busy}
                title={tool.granted ? (tool.connected ? 'Connecté : l’agent agit sur vos vraies données. Cliquer pour retirer.' : 'Accès donné, connexion à faire dans Intégrations. Cliquer pour retirer.') : 'Connecté pour l’organisation : cliquer pour le confier à l’agent.'}
                onClick={() => void go(() => control.grantTool(agent.id, tool.provider, !tool.granted))}
              >
                {tool.granted ? (tool.connected ? '● ' : '◐ ') : '+ '}{tool.label}
              </button>
            ))}
            <select
              value=""
              disabled={busy}
              aria-label="Donner un outil"
              onChange={(event) => { const p = event.target.value; if (p) void go(() => control.grantTool(agent.id, p, true)) }}
            >
              <option value="">+ Outil…</option>
              {CONNECTOR_CATALOG.filter((item) => !granted.has(item.provider) && (ZTC_CONNECTORS as readonly string[]).includes(item.provider)).map((item) => <option key={item.provider} value={item.provider}>{item.label}</option>)}
            </select>
          </div>
          {tools.some((t) => t.granted && !t.connected) ? (
            <button type="button" className={styles.linkBtn} onClick={control.openIntegrations}>Connecter les outils au monde réel →</button>
          ) : null}

          <div className={styles.section}>Poste</div>
          <div className={styles.formRow}>
            <select
              value=""
              disabled={busy || !others.length}
              aria-label="Déplacer vers"
              onChange={(event) => { const d = event.target.value; if (d) void go(() => control.move(agent.id, d)) }}
            >
              <option value="">Déplacer vers…</option>
              {others.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <button type="button" className={confirm ? styles.danger : styles.ghostBtn} disabled={busy} onClick={() => {
              if (!confirm) { setConfirm(true); return }
              setConfirm(false)
              void go(() => control.fire(agent.id)).then((r) => { if (r.ok) onClose() })
            }}>
              {confirm ? 'Confirmer le retrait' : 'Supprimer le poste'}
            </button>
          </div>
        </>
      ) : null}

      <Note note={note} />
      <div className={styles.cardActions}>
        <button type="button" onClick={onInvoices}>Ses factures</button>
        {full ? <button type="button" onClick={onExitFull}>Fiche complète</button> : null}
      </div>
    </div>
  )
}

export function ZoneForm({
  archetype,
  control,
  onAdd,
  removedCount,
  onRestore,
}: {
  archetype: OfficeArchetype
  control: OfficeControl
  onAdd: (kind: OfficeSpaceKind, name?: string) => string
  removedCount: number
  onRestore: () => void
}) {
  const { busy, note, setNote, go } = useAction()
  const options = spacesFor(archetype)
  const [kind, setKind] = useState<OfficeSpaceKind>(options[0]!.kind)
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  return (
    <div className={styles.addBox}>
      <div className={styles.section}>Ajouter une zone</div>
      <form className={styles.formRow} onSubmit={(event) => {
        event.preventDefault()
        const added = onAdd(kind, name)
        setName('')
        setNote({ ok: true, note: `${added} ajouté au bureau.` })
      }}>
        <select value={kind} onChange={(event) => setKind(event.target.value as OfficeSpaceKind)} aria-label="Type de zone">
          {options.map((o) => <option key={o.kind} value={o.kind}>{o.label}</option>)}
        </select>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom (optionnel)" />
        <button type="submit">Ajouter</button>
      </form>
      {control.live ? (
        <form className={styles.formRow} onSubmit={(event) => {
          event.preventDefault()
          const value = dept.trim()
          if (!value) return
          void go(() => control.addDepartment(value)).then((r) => { if (r.ok) setDept('') })
        }}>
          <input value={dept} onChange={(event) => setDept(event.target.value)} placeholder="Nouveau département…" />
          <button type="submit" disabled={busy || !dept.trim()}>Créer</button>
        </form>
      ) : null}
      {removedCount ? <button type="button" className={styles.linkBtn} onClick={onRestore}>Restaurer {removedCount} zone{removedCount > 1 ? 's' : ''} retirée{removedCount > 1 ? 's' : ''}</button> : null}
      <Note note={note} />
    </div>
  )
}

export function HireForm({ control }: { control: OfficeControl }) {
  const { busy, note, go } = useAction()
  const [role, setRole] = useState('')
  const [dept, setDept] = useState(control.departments[0]?.name ?? '')
  if (!control.live) return <div className={styles.empty}>Créez une organisation pour recruter de vrais agents.</div>
  return (
    <div className={styles.addBox}>
      <div className={styles.section}>Recruter un agent</div>
      <form className={styles.formRow} onSubmit={(event) => {
        event.preventDefault()
        const value = role.trim()
        if (!value) return
        void go(() => control.hire(value, dept || control.departments[0]?.name || 'Général')).then((r) => { if (r.ok) setRole('') })
      }}>
        <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Poste (ex. Mécanicien)" />
        <select value={dept} onChange={(event) => setDept(event.target.value)} aria-label="Département">
          {control.departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <button type="submit" disabled={busy || !role.trim()}>Recruter</button>
      </form>
      <Note note={note} />
    </div>
  )
}

export function ActivityCard({ control }: { control: OfficeControl }) {
  if (!control.live) return null
  return (
    <div className={styles.card}>
      <div className={styles.activityHead}>
        <div className={styles.kicker}>Journal en direct</div>
        <em data-stream={control.stream}>{control.stream === 'live' ? 'temps réel' : control.stream === 'polling' ? 'synchro 20 s' : 'hors ligne'}</em>
      </div>
      {control.activity.length ? (
        <ul className={styles.activity}>
          {control.activity.map((line) => (
            <li key={line.id}>
              <time>{new Date(line.at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</time>
              <span><strong>{line.who}</strong> {line.what}</span>
            </li>
          ))}
        </ul>
      ) : <div className={styles.empty}>Aucune activité pour l’instant.</div>}
    </div>
  )
}

export function DeleteZoneButton({
  label,
  disabledReason,
  onConfirm,
}: {
  label: string
  disabledReason?: string
  onConfirm: () => void
}) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      className={armed ? styles.rowDeleteArmed : styles.rowDelete}
      title={disabledReason ?? (armed ? `Confirmer la suppression de ${label}` : `Supprimer ${label}`)}
      aria-label={`Supprimer ${label}`}
      disabled={Boolean(disabledReason)}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) { setArmed(true); return }
        setArmed(false)
        onConfirm()
      }}
    >
      {armed ? 'Supprimer ?' : '×'}
    </button>
  )
}
