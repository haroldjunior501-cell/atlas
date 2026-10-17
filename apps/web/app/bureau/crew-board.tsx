'use client'

import { useEffect, useState } from 'react'
import { CREW_ROLES, ztcMissionExamples } from '@atlas/domain'
import { CrewMarkdown } from './crew-markdown'
import { durationOf, toolsUsed, type CrewApi, type CrewRun, type CrewStepRun } from './use-crew'
import styles from './crew-board.module.css'

const STATUS: Record<CrewStepRun['status'], string> = {
  waiting: 'En attente',
  working: 'Au travail',
  permission: 'Lève la main',
  done: 'Rapport rendu',
  failed: 'Bloqué',
  skipped: 'Écarté',
}

const EXAMPLES = [
  'Je lance une marque de café en grains. Analyse 5 concurrents comme Lavazza, Malongo, Café Joyeux, Terres de Café et Belleville Brûlerie, compare les prix au kilo et fais-moi un site de lancement.',
  'Compare 3 logiciels de facturation pour PME suisses (prix, avis, fonctions) et rédige une recommandation pour le CEO.',
  'Analyse 4 concurrents de notre boutique et rédige 3 posts LinkedIn pour notre lancement.',
]

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function stepTime(step: CrewStepRun, now: number) {
  if (!step.startedAt) return 0
  return (step.endedAt ?? now) - step.startedAt
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Stats({ step, now }: { step: CrewStepRun; now: number }) {
  if (!step.startedAt) return null
  return (
    <div className={styles.stats}>
      {durationOf(stepTime(step, now))} de travail · {toolsUsed(step)} outil{toolsUsed(step) > 1 ? 's' : ''} utilisé{toolsUsed(step) > 1 ? 's' : ''}{step.tokens ? ` · ${step.tokens.toLocaleString('fr-CH')} jetons` : ''}
    </div>
  )
}

function AgentDetail({ step, now, onClose }: { step: CrewStepRun; now: number; onClose: () => void }) {
  const role = CREW_ROLES[step.step.role]
  return (
    <div className={styles.overlay} role="dialog" aria-label={`Fiche de ${step.agentName}`} onClick={onClose}>
      <div className={styles.detail} onClick={(event) => event.stopPropagation()}>
        <div className={styles.detailHead}>
          <div>
            <div className={styles.kicker}>{role.label} · {step.step.title}</div>
            <h3>{step.agentName}</h3>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <span className={styles.pill} data-status={step.status}>{STATUS[step.status]}</span>
        {step.status === 'working' ? <div className={styles.now}>{step.current}</div> : null}
        <div className={styles.truth}>
          Un vrai agent ATLAS (« {role.label.toLowerCase()} »), avec ses propres outils : {role.tools.join(', ')}.
        </div>
        <div className={styles.section}>Mission, écrite par ATLAS</div>
        <div className={styles.brief}>{step.step.brief}</div>
        <div className={styles.section}>Ses actions</div>
        <ol className={styles.actions}>
          {step.actions.map((action, index) => (
            <li key={index} data-ok={action.ok === false ? 'no' : 'yes'}>
              <b>{action.tool}</b>
              {action.url ? <a href={action.url} target="_blank" rel="noreferrer">{action.label}</a> : <span>{action.label}</span>}
            </li>
          ))}
          {!step.actions.length ? <li><span>Pas encore commencé.</span></li> : null}
        </ol>
        {step.report ? (
          <>
            <div className={styles.section}>Rapport</div>
            <Stats step={step} now={now} />
            <CrewMarkdown text={step.report} />
          </>
        ) : null}
      </div>
    </div>
  )
}

function SitePreview({ html, run }: { html: string; run: CrewRun }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <div className={styles.kicker}>Livrable · index.html</div>
          <h3>Site de lancement</h3>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.ghost} onClick={() => {
            const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
            window.open(url, '_blank', 'noopener')
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
          }}>Ouvrir</button>
          <button type="button" className={styles.ghost} onClick={() => download('index.html', html, 'text/html')}>Télécharger</button>
        </div>
      </div>
      <div className={styles.phone}>
        <iframe title={`Site · ${run.mission.slice(0, 40)}`} sandbox="" srcDoc={html} />
      </div>
      <div className={styles.hint}>Ouvert dans un bac à sable : aucun script, aucune connexion.</div>
    </div>
  )
}

export function CrewBoard({ crew, canRun }: { crew: CrewApi; canRun: boolean }) {
  const { run, history } = crew
  const [mission, setMission] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [openStep, setOpenStep] = useState<string | null>(null)
  const active = Boolean(run && run.status !== 'done' && run.status !== 'stopped')
  const now = useNow(active)
  const done = run?.steps.filter((step) => step.status === 'done').length ?? 0
  const detail = run?.steps.find((step) => step.step.id === openStep) ?? null
  const table = run?.steps.find((step) => step.table?.rows.length)
  const asks = new Set(run?.steps.filter((step) => step.status === 'permission').map((step) => step.step.id))
  const examples = /ztc hosting/i.test(crew.rules) ? ztcMissionExamples() : EXAMPLES

  return (
    <div className={styles.board}>
      <div className={`${styles.card} ${styles.composer}`}>
        <div className={styles.composerHead}>
          <span className={styles.mark}>A</span>
          <div>
            <h2>Mission d’équipe</h2>
            <div className={styles.sub}>ATLAS fait le plan, monte l’équipe, les agents travaillent en parallèle sur le vrai web, puis ATLAS relit et corrige.</div>
          </div>
        </div>
        <textarea
          value={mission}
          onChange={(event) => setMission(event.target.value)}
          placeholder="Ex. Je lance une marque de café en grains : analyse 5 concurrents, compare les prix et fais-moi un site de lancement."
          rows={3}
        />
        <div className={styles.examples}>
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => setMission(example)}>{example.slice(0, 58)}…</button>
          ))}
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.primary} disabled={!canRun || active || mission.trim().length < 8} onClick={() => { void crew.start(mission) }}>
            Lancer la mission
          </button>
          {active ? <button type="button" className={styles.ghost} onClick={crew.stop}>Arrêter</button> : null}
          <button type="button" className={styles.link} onClick={() => setRulesOpen((value) => !value)}>
            Règlement du bureau{crew.rules.trim() ? ' ✓' : ''}
          </button>
        </div>
        {rulesOpen ? (
          <label className={styles.rules}>
            <span>Lu par ATLAS avant chaque mission : qui vous êtes, ce que fait l’entreprise, vos règles.</span>
            <textarea value={crew.rules} onChange={(event) => crew.setRules(event.target.value)} rows={4} placeholder="Nous sommes une PME suisse, ton direct, prix en CHF TTC, jamais d’envoi sans mon accord." />
          </label>
        ) : null}
      </div>

      {run ? (
        <>
          <div className={styles.summaryBar}>
            <div>
              <div className={styles.kicker}>{run.replay ? 'Relecture · aucun appel au modèle' : run.status === 'done' ? 'Mission terminée' : run.status === 'stopped' ? 'Mission arrêtée' : run.status === 'review' ? 'ATLAS relit' : run.status === 'planning' ? 'ATLAS fait le plan' : 'L’équipe travaille'}</div>
              <strong>{run.mission}</strong>
            </div>
            <div className={styles.kpis}>
              <div><span>Agents</span><b>{run.steps.length || '…'}</b></div>
              <div><span>Rapports</span><b>{done}/{run.steps.length || '…'}</b></div>
              <div><span>Durée</span><b>{durationOf((run.endedAt ?? now) - run.startedAt)}</b></div>
              <div><span>Jetons</span><b>{run.tokens ? `≈ ${run.tokens.toLocaleString('fr-CH')}` : '—'}</b></div>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={`${styles.card} ${styles.chief}`}>
              <div className={styles.kicker}>ATLAS · le chef</div>
              <ul>
                {run.chief.map((line, index) => (
                  <li key={index} data-kind={line.kind}>
                    <div>{line.text}</div>
                    {line.kind === 'ask' && line.stepId && asks.has(line.stepId) && !run.replay ? (
                      <div className={styles.row}>
                        <button type="button" className={styles.yes} onClick={() => crew.answer(line.stepId!, true)}>Oui</button>
                        <button type="button" className={styles.no} onClick={() => crew.answer(line.stepId!, false)}>Non</button>
                      </div>
                    ) : null}
                  </li>
                ))}
                {active ? <li data-kind="typing"><i /><i /><i /></li> : null}
              </ul>
              {run.summary ? (
                <div className={styles.final}>
                  <div className={styles.kicker}>Résumé</div>
                  <CrewMarkdown text={run.summary} />
                  {run.report ? (
                    <button type="button" className={styles.ghost} onClick={() => download('rapport.md', run.report!, 'text/markdown')}>Télécharger rapport.md</button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={styles.team}>
              {run.steps.map((step) => (
                <button key={step.step.id} type="button" className={styles.member} data-status={step.status} onClick={() => setOpenStep(step.step.id)}>
                  <div className={styles.memberHead}>
                    <span className={styles.role} data-role={step.step.role}>{CREW_ROLES[step.step.role].label}</span>
                    <span className={styles.pill} data-status={step.status}>{STATUS[step.status]}</span>
                  </div>
                  <strong>{step.agentName}</strong>
                  <small>{step.step.title}</small>
                  <div className={styles.current}>{step.status === 'done' ? `${step.sources.length ? `${step.sources.length} sources · ` : ''}Lire le rapport →` : step.current}</div>
                  <Stats step={step} now={now} />
                </button>
              ))}
              {run.status === 'planning' ? <div className={styles.empty}>ATLAS écrit les missions de chaque agent…</div> : null}
            </div>
          </div>

          {table?.table ? (
            <div className={styles.card}>
              <div className={styles.kicker}>Analyste · {table.agentName}</div>
              <h3>Tableau comparatif</h3>
              <CrewMarkdown text={table.report ?? ''} />
            </div>
          ) : null}

          {run.site ?? run.steps.find((step) => step.html)?.html ? <SitePreview html={(run.site ?? run.steps.find((step) => step.html)?.html)!} run={run} /> : null}
        </>
      ) : null}

      {history.length ? (
        <div className={styles.card}>
          <div className={styles.kicker}>Missions passées</div>
          <ul className={styles.history}>
            {history.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.mission}</strong>
                  <small>{new Date(item.startedAt).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' })} · {item.steps.length} agents · {durationOf((item.endedAt ?? item.startedAt) - item.startedAt)}</small>
                </span>
                <button type="button" className={styles.ghost} onClick={() => crew.view(item.id)}>Voir</button>
                <button type="button" className={styles.ghost} onClick={() => crew.replay(item.id)}>Rejouer</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail ? <AgentDetail step={detail} now={now} onClose={() => setOpenStep(null)} /> : null}
    </div>
  )
}

/** Version compacte pour le panneau du Bureau 3D. */
export function CrewMini({ crew, onOpen, canRun }: { crew: CrewApi; onOpen: () => void; canRun: boolean }) {
  const { run } = crew
  const [mission, setMission] = useState('')
  const active = Boolean(run && run.status !== 'done' && run.status !== 'stopped')
  const done = run?.steps.filter((step) => step.status === 'done').length ?? 0
  const last = run?.chief[run.chief.length - 1]
  const ask = run?.steps.find((step) => step.status === 'permission')
  return (
    <div className={styles.mini}>
      <div className={styles.miniHead}>
        <span>Mission d’équipe</span>
        {run ? <em data-active={active ? 'yes' : 'no'}>{active ? `${done}/${run.steps.length || '…'} rapports` : run.status === 'done' ? 'terminée' : 'arrêtée'}</em> : null}
      </div>
      {active && run ? (
        <>
          {last ? <div className={styles.miniLine} data-kind={last.kind}>{last.text}</div> : null}
          {ask && !run.replay ? (
            <div className={styles.row}>
              <button type="button" className={styles.yes} onClick={() => crew.answer(ask.step.id, true)}>Oui</button>
              <button type="button" className={styles.no} onClick={() => crew.answer(ask.step.id, false)}>Non</button>
            </div>
          ) : null}
          <ul className={styles.miniTeam}>
            {run.steps.slice(0, 7).map((step) => (
              <li key={step.step.id} data-status={step.status}>
                <i />
                <span><b>{step.agentName.split(' ')[0]}</b> {step.current}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form className={styles.miniForm} onSubmit={(event) => {
          event.preventDefault()
          if (mission.trim().length < 8) return
          void crew.start(mission)
          setMission('')
        }}>
          <input value={mission} onChange={(event) => setMission(event.target.value)} placeholder="Mission pour toute l’équipe…" disabled={!canRun} />
          <button type="submit" disabled={!canRun || mission.trim().length < 8}>Lancer</button>
        </form>
      )}
      <button type="button" className={styles.miniOpen} onClick={onOpen}>{run ? 'Ouvrir le tableau de mission →' : 'Voir les missions d’équipe →'}</button>
    </div>
  )
}
