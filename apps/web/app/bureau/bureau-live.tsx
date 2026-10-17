'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ARCHETYPES, ARCHETYPE_IDS, formatChf, isZtcOrganization, type OpsAction } from '@atlas/domain'
import { OfficeScene, type LifeEntry, type SceneView } from './office-scene'
import type { ActionRun, OfficeTwin } from './use-office-twin'
import type { OfficeControl } from './office-control'
import { ActivityCard, AgentCard, DeleteZoneButton, HireForm, ZoneForm } from './office-panels'
import { CrewMini } from './crew-board'
import type { CrewApi } from './use-crew'
import styles from './bureau-live.module.css'

const PRESENCE: Record<string, string> = {
  working: 'En activité',
  online: 'En ligne',
  idle: 'En pause',
  offline: 'Hors ligne',
}

export type OfficeFocus = { agentId?: string | null; roomId?: string | null; nonce: number }

export function BureauLive({
  twin,
  selectedAgentId,
  focus,
  onSelectAgent,
  onOpenInvoices,
  control,
  crew,
  onOpenMissions,
}: {
  twin: OfficeTwin
  control: OfficeControl
  crew?: CrewApi
  onOpenMissions?: () => void
  selectedAgentId: string | null
  focus?: OfficeFocus | null
  onSelectAgent: (id: string | null) => void
  onOpenInvoices: (scope: { roomId?: string; agentId?: string }) => void
}) {
  const { archetype, detected, choice, org } = twin
  const crewLive = crew?.live
  const layout = useMemo(() => {
    if (!crewLive?.working.size) return twin.layout
    return { ...twin.layout, agents: twin.layout.agents.map((agent) => (crewLive.working.has(agent.id) ? { ...agent, status: 'working' as const } : agent)) }
  }, [twin.layout, crewLive])
  const ops = useMemo(() => {
    if (!crewLive || !Object.keys(crewLive.tasks).length) return twin.ops
    return { ...twin.ops, tasks: { ...twin.ops.tasks, ...crewLive.tasks } }
  }, [twin.ops, crewLive])
  const accent = layout.theme.accent
  const liveRef = useRef<HTMLDivElement>(null)

  const [roomId, setRoomId] = useState<string | null>(null)
  const [assetId, setAssetId] = useState<string | null>(null)
  const [tab, setTab] = useState<'postes' | 'equipe' | 'assets'>('postes')
  const [labels, setLabels] = useState(false)
  const [view, setView] = useState<SceneView | undefined>(undefined)
  const [panel, setPanel] = useState(true)
  const [full, setFull] = useState(false)
  const [moves, setMoves] = useState<Array<LifeEntry & { at: number }>>([])

  useEffect(() => {
    setRoomId(null)
    setAssetId(null)
  }, [layout.id])

  useEffect(() => {
    if (!focus) return
    setAssetId(null)
    setPanel(true)
    if (focus.roomId) setRoomId(focus.roomId)
  }, [focus])

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === liveRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void liveRef.current?.requestFullscreen?.()
  }

  const zone = roomId ? ops.zones[roomId] : null
  const room = roomId ? layout.rooms.find((r) => r.id === roomId) ?? null : null
  const zoneAgents = roomId ? layout.agents.filter((a) => a.roomId === roomId) : []
  const asset = assetId ? ops.assets.find((a) => a.id === assetId) ?? null : null
  const agent = selectedAgentId ? layout.agents.find((a) => a.id === selectedAgentId) ?? null : null
  const agentRecords = agent ? ops.records.filter((r) => r.agentId === agent.id) : []
  const working = layout.agents.filter((a) => a.status === 'working' || a.status === 'online').length
  const actions = roomId
    ? ops.atlas.actions.filter((a) => a.roomId === roomId)
    : agent ? ops.atlas.actions.filter((a) => a.agentId === agent.id) : ops.atlas.actions
  const pendingActions = ops.atlas.actions.filter((a) => !twin.runs[a.id])

  function pickRoom(id: string | null) {
    setAssetId(null)
    setRoomId(id)
    if (id) setPanel(true)
  }

  return (
    <div
      ref={liveRef}
      className={`${styles.live} ${full ? styles.full : ''} ${panel ? '' : styles.panelClosed}`}
      style={{ ['--accent' as string]: accent }}
    >
      <div className={styles.scene}>
        <OfficeScene
          layout={layout}
          tasks={ops.tasks}
          selectedAgentId={selectedAgentId}
          selectedRoomId={roomId}
          selectedAssetId={assetId}
          showLabels={labels}
          view={view}
          handoffs={crewLive?.handoffs}
          onActivity={(entry) => setMoves((list) => [{ ...entry, at: Date.now() }, ...list].slice(0, 4))}
          onSelectAgent={(id) => { setAssetId(null); if (id) setPanel(true); onSelectAgent(id) }}
          onSelectRoom={(id) => { onSelectAgent(null); pickRoom(id) }}
          onSelectAsset={(id, rid) => { onSelectAgent(null); setAssetId(id); setRoomId(rid || null); setTab('assets'); setPanel(true) }}
        />

        <div className={styles.hud}>
          <div className={styles.brand}>
            <span className={styles.logo}>{twin.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{twin.name}</strong>
              <span>
                {ARCHETYPES[archetype].label} · {working}/{layout.agents.length} agents actifs
                <i className={styles.pulse} data-stream={control.stream} /> {control.stream === 'live' ? 'Live' : control.stream === 'polling' ? 'Synchro' : 'Démo'}
              </span>
            </div>
          </div>
          <div className={styles.kpis}>
            {ops.kpis.slice(0, 5).map((kpi) => (
              <div key={kpi.id} className={`${styles.kpi} ${styles[`tone_${kpi.tone}`]}`}>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                {kpi.hint ? <small>{kpi.hint}</small> : null}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.tools}>
          <label className={styles.envSelect}>
            <span>Environnement</span>
            <select value={choice} onChange={(event) => twin.pickChoice(event.target.value)}>
              <option value="auto">Auto · {ARCHETYPES[detected].label}</option>
              {ARCHETYPE_IDS.map((id) => <option key={id} value={id}>{ARCHETYPES[id].label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { pickRoom(null); onSelectAgent(null); setView({ kind: 'overview', nonce: Date.now() }) }}>Vue d’ensemble</button>
          <button type="button" onClick={() => setView({ kind: 'top', nonce: Date.now() })}>Plan</button>
          <button type="button" className={labels ? styles.toolOn : undefined} onClick={() => setLabels((v) => !v)}>Étiquettes</button>
          <button type="button" className={full ? styles.toolOn : undefined} onClick={toggleFull} aria-label={full ? 'Quitter le plein écran' : 'Plein écran'}>
            {full ? 'Quitter ⤡' : 'Plein écran ⤢'}
          </button>
        </div>

        <div className={styles.flow}>
          <div>Flux · {ARCHETYPES[archetype].tagline}</div>
          <ol>
            {ops.stages.map((stage, index) => (
              <li key={stage.id}>
                <span className={styles.dot}>{stage.count}</span>
                <em>{stage.label}</em>
                {index < ops.stages.length - 1 ? <i className={styles.link} /> : null}
              </li>
            ))}
          </ol>
        </div>

        {moves.length ? (
          <div className={styles.moves} aria-live="polite">
            <div>En ce moment dans le bureau</div>
            <ul>
              {moves.map((move) => (
                <li key={`${move.agentId}-${move.at}`}>
                  <button type="button" onClick={() => { setAssetId(null); setPanel(true); onSelectAgent(move.agentId) }}>
                    <strong>{move.name.split(' ')[0]}</strong> {move.text.charAt(0).toLowerCase() + move.text.slice(1)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.legend}>
          <span><i style={{ background: '#22c55e' }} /> En activité</span>
          <span><i style={{ background: '#38bdf8' }} /> En ligne</span>
          <span><i style={{ background: '#f59e0b' }} /> En pause</span>
          <span><i style={{ background: '#9ca3af' }} /> Hors ligne</span>
          {!org || ops.simulated ? <em>{org ? 'Gestion simulée · équipe en direct' : 'Démonstration'}</em> : null}
        </div>

        <button type="button" className={styles.panelToggle} onClick={() => setPanel((v) => !v)} aria-label={panel ? 'Masquer le panneau' : 'Afficher le panneau'}>
          {panel ? '›' : '‹'}
        </button>
      </div>

      <aside className={styles.side}>
        <div className={`${styles.card} ${styles.atlas}`}>
          <div className={styles.atlasHead}>
            <span className={styles.atlasMark}>A</span>
            <div>
              <div className={styles.kicker}>ATLAS orchestre</div>
              <small>{ops.atlas.summary}</small>
            </div>
          </div>
          <ActionList actions={actions.slice(0, roomId || agent ? 6 : 4)} runs={twin.runs} onRun={(a) => void twin.run(a)} onLocate={(a) => { if (a.agentId) onSelectAgent(a.agentId); else if (a.roomId) pickRoom(a.roomId) }} />
          {!roomId && !agent && pendingActions.length > 1 ? (
            <button type="button" className={styles.atlasAll} onClick={() => void twin.runMany(pendingActions)}>
              Tout orchestrer · {pendingActions.length} actions
            </button>
          ) : null}
          {crew ? <CrewMini crew={crew} canRun onOpen={() => onOpenMissions?.()} /> : null}
          {isZtcOrganization(twin.name, twin.layout.archetypeLabel) || archetype === 'hosting' ? <ZtcLiveCard /> : null}
        </div>

        {agent ? (
          <AgentCard
            key={agent.id}
            agent={agent}
            room={layout.rooms.find((r) => r.id === agent.roomId)?.name}
            control={control}
            simulatedTask={ops.tasks[agent.id]}
            records={agentRecords.length}
            billed={agentRecords.reduce((s, r) => s + r.amount, 0)}
            full={full}
            onClose={() => onSelectAgent(null)}
            onInvoices={() => onOpenInvoices({ agentId: agent.id })}
            onExitFull={toggleFull}
          />
        ) : null}

        {!agent && !roomId && !asset ? <ActivityCard control={control} /> : null}

        {asset ? (
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.kicker}>{ops.assetsTitle}</div>
                <h3>{asset.name}</h3>
                <div className={styles.sub}>{asset.detail}</div>
              </div>
              <button type="button" className={styles.close} aria-label="Fermer" onClick={() => setAssetId(null)}>×</button>
            </div>
            <div className={styles.metrics}>
              <div><span>Statut</span><strong className={styles.small}>{asset.status}</strong></div>
              <div><span>Responsable</span><strong className={styles.small}>{asset.agentName ?? '—'}</strong></div>
            </div>
          </div>
        ) : null}

        {zone && room ? (
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.kicker}><i className={styles.swatch} style={{ background: room.color }} />{zone.subtitle}</div>
                <h3>{zone.title}</h3>
                <div className={styles.sub}>Tableau de bord du département</div>
              </div>
              <button type="button" className={styles.close} aria-label="Fermer la zone" onClick={() => pickRoom(null)}>×</button>
            </div>
            <div className={styles.metrics}>
              {zone.metrics.slice(0, 2).map((m) => <div key={m.label}><span>{m.label}</span><strong>{m.value}</strong></div>)}
              <div><span>Dossiers</span><strong>{zone.finance.records}</strong></div>
            </div>
            <div className={`${styles.metrics} ${styles.money}`}>
              <div><span>Facturé</span><strong>{formatChf(zone.finance.billed)}</strong></div>
              <div className={zone.finance.overdue ? styles.warnBox : undefined}>
                <span>À encaisser{zone.finance.overdue ? ` · ${zone.finance.overdue} échue${zone.finance.overdue > 1 ? 's' : ''}` : ''}</span>
                <strong>{formatChf(zone.finance.pending)}</strong>
              </div>
            </div>
            {zone.finance.records ? (
              <button type="button" className={styles.linkBtn} onClick={() => onOpenInvoices({ roomId: room.id })}>Voir les {zone.finance.records} factures du département →</button>
            ) : null}
            {zoneAgents.length ? (
              <>
                <div className={styles.section}>Équipe sur place</div>
                <ul className={styles.rows}>
                  {zoneAgents.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => onSelectAgent(a.id)}>
                        <i className={styles.presence} data-status={a.status} />
                        <span><strong>{a.name}</strong><small>{a.role} · {ops.tasks[a.id]}</small></span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className={styles.section}>{zone.inventoryTitle}</div>
            <ul className={styles.inventory}>
              {zone.inventory.map((line) => (
                <li key={line.ref}>
                  <span><strong>{line.name}</strong><small>{line.ref}</small></span>
                  <b className={line.low ? styles.low : undefined}>{line.qty} {line.unit}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.card}>
          <div className={styles.tabs}>
            <button type="button" className={tab === 'postes' ? styles.tabOn : undefined} onClick={() => setTab('postes')}>Postes <em>{layout.rooms.length}</em></button>
            <button type="button" className={tab === 'equipe' ? styles.tabOn : undefined} onClick={() => setTab('equipe')}>Équipe <em>{layout.agents.length}</em></button>
            <button type="button" className={tab === 'assets' ? styles.tabOn : undefined} onClick={() => setTab('assets')}>{ops.assetsTitle} <em>{ops.assets.length}</em></button>
          </div>
          <ul className={styles.rows}>
            {tab === 'postes' ? layout.rooms.map((r, index) => {
              const count = layout.agents.filter((a) => a.roomId === r.id).length
              const department = r.departmentId && r.id.endsWith(`-room-${r.departmentId}`) ? r.departmentId : null
              return (
                <li key={r.id} className={styles.rowWithTool}>
                  <button type="button" className={r.id === roomId ? styles.rowOn : undefined} onClick={() => { onSelectAgent(null); pickRoom(r.id) }}>
                    <span className={styles.code}>Z{String(index + 1).padStart(2, '0')}</span>
                    <span><strong>{r.name}</strong><small>{twin.extraRoomIds.has(r.id) ? 'Ajoutée · ' : ''}{ops.zones[r.id]?.subtitle}</small></span>
                    <em>{count ? `${count} agent${count > 1 ? 's' : ''}` : '—'}</em>
                  </button>
                  {department ? (
                    control.live ? (
                      <DeleteZoneButton
                        label={`le département ${r.name}`}
                        disabledReason={count ? `Déplacez ou retirez d’abord ${count} agent${count > 1 ? 's' : ''}` : undefined}
                        onConfirm={() => { if (roomId === r.id) pickRoom(null); void control.removeDepartment(department) }}
                      />
                    ) : null
                  ) : (
                    <DeleteZoneButton label={r.name} onConfirm={() => { if (roomId === r.id) pickRoom(null); twin.removeSpace(r.id) }} />
                  )}
                </li>
              )
            }) : null}
            {tab === 'equipe' ? layout.agents.map((a) => (
              <li key={a.id}>
                <button type="button" className={a.id === selectedAgentId ? styles.rowOn : undefined} onClick={() => onSelectAgent(a.id)}>
                  <i className={styles.presence} data-status={a.status} />
                  <span><strong>{a.name}</strong><small>{a.role} · {ops.tasks[a.id]}</small></span>
                  <em>{PRESENCE[a.status] ?? a.status}</em>
                </button>
              </li>
            )) : null}
            {tab === 'assets' ? ops.assets.map((item) => (
              <li key={item.id}>
                <button type="button" className={item.id === assetId ? styles.rowOn : undefined} onClick={() => { onSelectAgent(null); setAssetId(item.id); setRoomId(item.roomId || null) }}>
                  <span><strong>{item.name}</strong><small>{item.detail}{item.agentName ? ` · ${item.agentName}` : ''}</small></span>
                  <em className={styles[`tone_${item.tone}`]}>{item.status}</em>
                </button>
              </li>
            )) : null}
          </ul>
          {tab === 'postes' ? (
            <ZoneForm
              key={archetype}
              archetype={archetype}
              control={control}
              onAdd={(kind, name) => twin.addSpace(kind, name)}
              removedCount={twin.removedCount}
              onRestore={twin.restoreSpaces}
            />
          ) : null}
          {tab === 'equipe' ? <HireForm key={control.departments.length} control={control} /> : null}
        </div>
      </aside>
    </div>
  )
}

export function ActionList({
  actions,
  runs,
  onRun,
  onLocate,
}: {
  actions: OpsAction[]
  runs: Record<string, ActionRun>
  onRun: (action: OpsAction) => void
  onLocate?: (action: OpsAction) => void
}) {
  if (!actions.length) return <div className={styles.empty}>Rien à orchestrer ici pour le moment.</div>
  return (
    <ul className={styles.actions}>
      {actions.map((action) => {
        const state = runs[action.id]
        return (
          <li key={action.id} data-priority={action.priority}>
            <button type="button" className={styles.actionText} onClick={() => onLocate?.(action)} disabled={!onLocate}>
              <strong>{action.title}</strong>
              <small>{state ? state.note : action.detail}</small>
            </button>
            <button
              type="button"
              className={styles.actionRun}
              data-state={state?.state ?? 'idle'}
              disabled={Boolean(state) || !action.agentId}
              onClick={() => onRun(action)}
            >
              {state?.state === 'running' ? '…' : state?.state === 'done' ? '✓' : state?.state === 'failed' ? '!' : 'Lancer'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ZtcLiveCard() {
  const [lines, setLines] = useState<string[]>(['Lecture du site public ZTC…'])
  useEffect(() => {
    let cancel = false
    void fetch('/api/atlas/ztc')
      .then((response) => response.json())
      .then((body: { facts?: Array<{ label: string; value: string; certainty: string }>; connectors?: Array<{ label: string; certainty: string; ok?: boolean }> }) => {
        if (cancel) return
        const facts = (body.facts ?? []).slice(0, 5).map((item) => `${item.label} · ${item.value} [${item.certainty}]`)
        const links = (body.connectors ?? []).map((item) => `${item.label}: ${item.certainty}${item.ok === false ? ' (injoignable)' : item.ok ? ' (répond)' : ''}`)
        setLines([...facts, ...links])
      })
      .catch(() => { if (!cancel) setLines(['Inventaire ZTC indisponible. Rien n’est inventé.']) })
    return () => { cancel = true }
  }, [])
  return (
    <div className={styles.ztc}>
      <div>ZTC Hosting · preuves publiques</div>
      <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
    </div>
  )
}
