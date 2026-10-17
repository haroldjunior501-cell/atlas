'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatChf, type OpsAction, type OpsRecord, type OpsRecordStatus } from '@atlas/domain'
import { ActionList } from './bureau-live'
import type { OfficeTwin } from './use-office-twin'
import styles from './factures-section.module.css'

const STATUS_LABEL: Record<OpsRecordStatus, string> = {
  overdue: 'Échue',
  pending: 'En attente',
  progress: 'En cours',
  draft: 'Brouillon',
  paid: 'Payée',
}
const STATUS_ORDER: OpsRecordStatus[] = ['overdue', 'pending', 'progress', 'draft', 'paid']

type SortKey = 'number' | 'client' | 'subject' | 'amount' | 'status' | 'date' | 'due' | 'agent'
type Period = 'all' | '30' | '90' | 'month'

export type InvoiceScope = { roomId?: string; agentId?: string; nonce: number }

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'number', label: 'Numéro' },
  { key: 'client', label: 'Client' },
  { key: 'subject', label: 'Objet' },
  { key: 'amount', label: 'Montant', numeric: true },
  { key: 'status', label: 'Statut' },
  { key: 'date', label: 'Date' },
  { key: 'due', label: 'Échéance' },
  { key: 'agent', label: 'Responsable' },
]

function compare(a: OpsRecord, b: OpsRecord, key: SortKey) {
  switch (key) {
    case 'amount': return a.amount - b.amount
    case 'status': return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    case 'date': return a.isoDate.localeCompare(b.isoDate)
    case 'due': return a.dueIso.localeCompare(b.dueIso)
    case 'agent': return (a.agentName ?? '').localeCompare(b.agentName ?? '', 'fr')
    default: return String(a[key]).localeCompare(String(b[key]), 'fr', { numeric: true })
  }
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function exportCsv(rows: OpsRecord[], name: string) {
  const head = ['Numéro', 'Date', 'Échéance', 'Client', 'Objet', 'Montant TTC (CHF)', 'TVA 8.1% (CHF)', 'Statut', 'Responsable', 'Département']
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = rows.map((r) => [r.number, r.date, r.dueDate, r.client, r.subject, r.amount.toFixed(2), r.vat.toFixed(2), STATUS_LABEL[r.status], r.agentName ?? '', r.departmentName ?? ''].map(cell).join(';'))
  const blob = new Blob([`\uFEFF${[head.map(cell).join(';'), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `factures-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${todayIso()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function FacturesSection({
  twin,
  scope,
  onLocate,
}: {
  twin: OfficeTwin
  scope?: InvoiceScope | null
  onLocate: (target: { agentId?: string | null; roomId?: string | null }) => void
}) {
  const { ops, layout } = twin
  const accent = layout.theme.accent
  const today = todayIso()

  const [query, setQuery] = useState('')
  const [statuses, setStatuses] = useState<OpsRecordStatus[]>([])
  const [room, setRoom] = useState('all')
  const [agent, setAgent] = useState('all')
  const [period, setPeriod] = useState<Period>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 })
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!scope) return
    setRoom(scope.roomId ?? 'all')
    setAgent(scope.agentId ?? 'all')
    setStatuses([])
    setQuery('')
  }, [scope])

  const layoutId = useRef(layout.id)
  useEffect(() => {
    if (layoutId.current === layout.id) return
    layoutId.current = layout.id
    setRoom('all')
    setAgent('all')
    setOpen(null)
  }, [layout.id])

  const rooms = useMemo(() => {
    const ids = new Set(ops.records.map((r) => r.roomId).filter(Boolean))
    return layout.rooms.filter((r) => ids.has(r.id))
  }, [ops.records, layout.rooms])
  const agents = useMemo(() => {
    const ids = new Set(ops.records.map((r) => r.agentId).filter(Boolean))
    return layout.agents.filter((a) => ids.has(a.id))
  }, [ops.records, layout.agents])

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ops.records.filter((r) => {
      if (room !== 'all' && r.roomId !== room) return false
      if (agent !== 'all' && r.agentId !== agent) return false
      if (period === 'month' && r.isoDate.slice(0, 7) !== today.slice(0, 7)) return false
      if ((period === '30' || period === '90') && daysBetween(r.isoDate, today) > Number(period)) return false
      if (q && !`${r.number} ${r.client} ${r.subject} ${r.agentName ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [ops.records, room, agent, period, query, today])

  const rows = useMemo(() => {
    const list = statuses.length ? scoped.filter((r) => statuses.includes(r.status)) : scoped
    return [...list].sort((a, b) => compare(a, b, sort.key) * sort.dir)
  }, [scoped, statuses, sort])

  const sum = (list: OpsRecord[]) => list.reduce((acc, r) => acc + r.amount, 0)
  const paid = scoped.filter((r) => r.status === 'paid')
  const unpaid = scoped.filter((r) => r.status === 'pending' || r.status === 'overdue')
  const late = scoped.filter((r) => r.status === 'overdue')
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, scoped.filter((r) => r.status === s).length])) as Record<OpsRecordStatus, number>

  const relance = ops.atlas.actions.find((a) => a.kind === 'relance')
  const collector = relance ? { id: relance.agentId, name: relance.agentName } : null
  const invoiceActions = ops.atlas.actions.filter((a) => (a.kind === 'relance' || a.kind === 'envoi')
    && (room === 'all' || a.recordIds.some((id) => scoped.some((r) => r.id === id))))
  const handled = new Set(Object.entries(twin.runs)
    .filter(([, run]) => run.state === 'done')
    .flatMap(([id]) => ops.atlas.actions.find((a) => a.id === id)?.recordIds ?? [id.replace(/^atlas-rec-/, '')]))

  function actionFor(r: OpsRecord): OpsAction | null {
    if (r.status === 'paid') return null
    const draft = r.status === 'draft' || r.status === 'progress'
    const who = draft || !collector?.id ? { id: r.agentId, name: r.agentName } : collector
    return {
      id: `atlas-rec-${r.id}`,
      kind: draft ? 'envoi' : 'relance',
      title: draft ? `Finaliser ${r.number}` : `Relancer ${r.number}`,
      detail: `${formatChf(r.amount)} · ${r.client}`,
      priority: r.status === 'overdue' ? 'high' : 'normal',
      agentId: who.id,
      agentName: who.name,
      roomId: r.roomId,
      recordIds: [r.id],
      amount: r.amount,
      mission: draft
        ? `Finalise et envoie la facture ${r.number} (${r.subject}, ${formatChf(r.amount)}) à ${r.client}, échéance à 30 jours.`
        : `Relance ${r.client} pour la facture ${r.number} (${r.subject}, ${formatChf(r.amount)}, échéance ${r.dueDate}). Rappel courtois et nouvelle échéance à 10 jours.`,
    }
  }

  function toggleStatus(s: OpsRecordStatus) {
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function sortBy(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: key === 'amount' || key === 'date' ? -1 : 1 }))
  }

  const filtered = query || statuses.length || room !== 'all' || agent !== 'all' || period !== 'all'

  return (
    <div className={styles.wrap} style={{ ['--accent' as string]: accent }}>
      <div className={styles.cards}>
        <div><span>Facturé TTC</span><strong>{formatChf(sum(scoped))}</strong><small>{scoped.length} documents</small></div>
        <div className={styles.good}><span>Encaissé</span><strong>{formatChf(sum(paid))}</strong><small>{scoped.length ? Math.round((paid.length / scoped.length) * 100) : 0} % des documents</small></div>
        <div><span>À encaisser</span><strong>{formatChf(sum(unpaid))}</strong><small>{unpaid.length} en attente</small></div>
        <div className={late.length ? styles.bad : undefined}><span>Échu</span><strong>{formatChf(sum(late))}</strong><small>{late.length} facture{late.length > 1 ? 's' : ''} en retard</small></div>
        <div><span>TVA collectée (8,1 %)</span><strong>{formatChf(paid.reduce((acc, r) => acc + r.vat, 0))}</strong><small>sur l’encaissé</small></div>
      </div>

      <div className={styles.atlas}>
        <div className={styles.atlasHead}>
          <span className={styles.atlasMark}>A</span>
          <div>
            <strong>ATLAS orchestre la facturation</strong>
            <small>{ops.atlas.summary}</small>
          </div>
        </div>
        <ActionList
          actions={invoiceActions}
          runs={twin.runs}
          onRun={(a) => void twin.run(a)}
          onLocate={(a) => onLocate({ agentId: a.agentId, roomId: a.roomId })}
        />
      </div>

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            placeholder="Rechercher un numéro, un client, un objet…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={room} onChange={(event) => setRoom(event.target.value)} aria-label="Département">
            <option value="all">Tous les départements</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={agent} onChange={(event) => setAgent(event.target.value)} aria-label="Responsable">
            <option value="all">Tous les responsables</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} aria-label="Période">
            <option value="all">Toute la période</option>
            <option value="month">Mois en cours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
          {filtered ? (
            <button type="button" className={styles.reset} onClick={() => { setQuery(''); setStatuses([]); setRoom('all'); setAgent('all'); setPeriod('all') }}>Réinitialiser</button>
          ) : null}
          <button type="button" className={styles.export} onClick={() => exportCsv(rows, twin.name)}>Exporter CSV</button>
        </div>

        <div className={styles.chips}>
          <button type="button" className={!statuses.length ? styles.chipOn : undefined} onClick={() => setStatuses([])}>Tous <em>{scoped.length}</em></button>
          {STATUS_ORDER.map((s) => (
            <button key={s} type="button" className={statuses.includes(s) ? styles.chipOn : undefined} data-status={s} onClick={() => toggleStatus(s)}>
              {STATUS_LABEL[s]} <em>{counts[s]}</em>
            </button>
          ))}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={col.numeric ? styles.num : undefined} aria-sort={sort.key === col.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => sortBy(col.key)}>
                      {col.label}
                      <i>{sort.key === col.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</i>
                    </button>
                  </th>
                ))}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const action = actionFor(r)
                const run = action ? twin.runs[action.id] : undefined
                const late = r.status === 'overdue' ? daysBetween(r.dueIso, today) : 0
                const isOpen = open === r.id
                return (
                  <FactureRow
                    key={r.id}
                    record={r}
                    late={late}
                    open={isOpen}
                    handled={handled.has(r.id)}
                    action={action}
                    runNote={run?.note}
                    running={run?.state === 'running'}
                    onToggle={() => setOpen(isOpen ? null : r.id)}
                    onRun={() => action && void twin.run(action)}
                    onLocate={() => onLocate({ agentId: r.agentId, roomId: r.roomId })}
                  />
                )
              })}
              {!rows.length ? (
                <tr><td colSpan={COLUMNS.length + 1} className={styles.none}>Aucune facture ne correspond à ces filtres.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className={styles.footer}>
          <span>{rows.length} sur {ops.records.length} documents{ops.simulated ? ' · données de gestion simulées par ATLAS' : ''}</span>
          <strong>Total affiché {formatChf(sum(rows))}</strong>
        </footer>
      </div>
    </div>
  )
}

function FactureRow({
  record: r,
  late,
  open,
  handled,
  action,
  runNote,
  running,
  onToggle,
  onRun,
  onLocate,
}: {
  record: OpsRecord
  late: number
  open: boolean
  handled: boolean
  action: OpsAction | null
  runNote?: string
  running: boolean
  onToggle: () => void
  onRun: () => void
  onLocate: () => void
}) {
  return (
    <>
      <tr className={open ? styles.rowOpen : undefined} onClick={onToggle}>
        <td className={styles.mono}>{r.number}</td>
        <td>{r.client}</td>
        <td className={styles.subject}>{r.subject}</td>
        <td className={`${styles.num} ${styles.mono}`}>{formatChf(r.amount)}</td>
        <td>
          <em className={styles[`st_${r.status}`]}>{STATUS_LABEL[r.status]}</em>
          {handled ? <em className={styles.atlasTag}>ATLAS ✓</em> : null}
        </td>
        <td className={styles.mono}>{r.date}</td>
        <td className={`${styles.mono} ${late ? styles.lateText : ''}`}>{r.dueDate}{late ? <small> +{late} j</small> : null}</td>
        <td>{r.agentName ?? '—'}</td>
        <td className={styles.rowTools}>
          <button type="button" title="Localiser dans le Bureau 3D" aria-label="Localiser dans le Bureau 3D" onClick={(event) => { event.stopPropagation(); onLocate() }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
          </button>
        </td>
      </tr>
      {open ? (
        <tr className={styles.detail}>
          <td colSpan={COLUMNS.length + 1}>
            <div className={styles.detailGrid}>
              <div><span>Montant HT</span><strong>{formatChf(r.amount - r.vat)}</strong></div>
              <div><span>TVA 8,1 %</span><strong>CHF {r.vat.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '’')}</strong></div>
              <div><span>Total TTC</span><strong>{formatChf(r.amount)}</strong></div>
              <div><span>Département</span><strong>{r.departmentName ?? '—'}</strong></div>
              <div><span>Porté par</span><strong>{r.agentName ?? '—'}</strong></div>
            </div>
            <div className={styles.detailActions}>
              <button type="button" onClick={onLocate}>Voir dans le Bureau 3D</button>
              {action ? (
                <button type="button" className={styles.primary} disabled={Boolean(runNote)} onClick={onRun}>
                  {running ? 'Transmission…' : runNote ? 'Confiée' : `Confier à ATLAS · ${action.kind === 'relance' ? 'relance' : 'envoi'} par ${action.agentName ?? 'un agent'}`}
                </button>
              ) : null}
              {runNote ? <span className={styles.note}>{runNote}</span> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
