'use client'

import type { ReactNode } from 'react'
import { CONNECTOR_CATALOG } from '@atlas/domain'
import styles from './bureau.module.css'

export interface CreationLog {
  ok: boolean
  text: string
}

export interface CreationIntel {
  ok: boolean
  label: string
}

export interface CreationShow {
  beat: string
  title: string
  line: string
  log: CreationLog[]
  percent: number
  phase: string
  tools?: string[]
  summary?: { agents: number; depts: number; skills: number; tools: number }
  offer?: string
  ready?: boolean
  birth?: Record<string, 'init' | 'ready'>
  intel?: CreationIntel[]
}

export const ATLAS_INTEL: CreationIntel[] = [
  { ok: false, label: 'Objectifs de l’entreprise' },
  { ok: false, label: 'Structure organisationnelle' },
  { ok: false, label: 'Rôles & responsabilités' },
  { ok: false, label: 'Mémoire partagée' },
  { ok: false, label: 'Relations entre agents' },
  { ok: false, label: 'Permissions' },
  { ok: false, label: 'Règles d’autonomie' },
]

function labelOf(provider: string) {
  return CONNECTOR_CATALOG.find((item) => item.provider === provider)?.label ?? provider
}

function isLive(show: CreationShow) {
  return show.phase === 'ready' || show.phase === 'ask' || show.percent >= 100
}

export function CreationTheater({
  show,
  children,
  linked,
  ask,
  setAsk,
  onPick,
  onLink,
  onConnect,
  onEnter,
  onLaunch,
}: {
  show: CreationShow
  children: ReactNode
  linked?: string[]
  ask: string
  setAsk: (value: string) => void
  onPick: (provider: string) => void
  onLink: (provider: string) => void
  onConnect: () => void
  onEnter: () => void
  onLaunch: () => void
}) {
  const live = isLive(show)
  const intel = show.intel?.length
    ? show.intel
    : (show.phase === 'memory' || show.phase === 'tools' || live)
      ? ATLAS_INTEL.map((item) => ({ ...item, ok: show.percent >= 88 || live || show.phase === 'tools' }))
      : []
  return (
    <div className={`${styles.theater} ${live ? styles.theaterLive : ''}`} aria-live="polite">
      <header className={styles.theaterHead}>
        <em>{live ? 'ATLAS' : '✦ ATLAS'}</em>
        <strong>{live ? '🟢 Votre organisation est opérationnelle' : 'Création de votre organisation'}</strong>
        <span>{show.title}</span>
      </header>
      <div className={styles.theaterBody}>
        <div className={styles.theaterChart}>
          {show.phase === 'analyze' ? (
            <div className={styles.analyzeHero}>
              <em>✦ ATLAS</em>
              <strong>Analyse de votre vision</strong>
              <p>{show.line}</p>
              <div className={styles.analyzeScene}>{children}</div>
            </div>
          ) : (
            <>
              {live ? <p className={styles.liveBanner}>Tous les agents sont en ligne. L’organisation peut travailler.</p> : null}
              {children}
            </>
          )}
        </div>
        <aside className={styles.theaterLog}>
          <p className={styles.theaterKicker}>{live ? 'Organisation vivante' : 'Journal Atlas'}</p>
          <p className={styles.theaterLine}>{show.line}</p>
          <ol>
            {show.log.map((item, index) => (
              <li key={`${index}-${item.text}`} className={item.ok ? styles.logOk : styles.logWait}>
                {item.ok ? '✓' : '◉'} {item.text}
              </li>
            ))}
          </ol>
          {intel.length ? (
            <div className={styles.intel}>
              <p className={styles.theaterKicker}>🧠 Intelligence ATLAS</p>
              <ol>
                {intel.map((item) => (
                  <li key={item.label} className={item.ok ? styles.logOk : styles.logWait}>
                    {item.ok ? '✓' : '◉'} {item.label}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {show.phase === 'tools' && show.tools?.length ? (
            <div className={styles.theaterTools}>
              <p>Cliquez Relier : une fenêtre d’autorisation s’ouvre. Vous n’avez rien à coller.</p>
              <ul className={styles.theaterToolGrid}>
                {show.tools.map((provider) => {
                  const connected = (linked ?? []).includes(provider)
                  return (
                    <li key={provider}>
                      <strong>{labelOf(provider)}</strong>
                      <span className={connected ? styles.linked : undefined}>{connected ? '● Connecté' : 'Non relié'}</span>
                      {connected ? null : (
                        <button className={styles.primary} type="button" onClick={() => { onPick(provider); onLink(provider) }}>Relier</button>
                      )}
                    </li>
                  )
                })}
              </ul>
              <button className={styles.ghost} type="button" onClick={onConnect}>Continuer</button>
            </div>
          ) : null}
          {show.ready && show.summary ? (
            <div className={styles.theaterReady}>
              <strong>Votre organisation est opérationnelle.</strong>
              <p>{show.summary.agents} agents ont été créés.</p>
              <p>{show.summary.depts} départements ont été structurés.</p>
              <p>{show.summary.skills} compétences ont été configurées.</p>
              <p>{show.summary.tools} outils sont disponibles.</p>
              <button className={styles.primary} type="button" onClick={onEnter}>Entrer dans mon organisation</button>
            </div>
          ) : null}
          {show.phase === 'ask' ? (
            <div className={styles.theaterReady}>
              <p>{show.offer}</p>
              <label className={styles.field}>
                Première mission
                <input value={ask} onChange={(event) => setAsk(event.target.value)} placeholder="Trouvez-moi mes 100 premiers prospects." />
              </label>
              <button className={styles.primary} type="button" disabled={ask.trim().length < 3} onClick={onLaunch}>Lancer la mission</button>
            </div>
          ) : null}
        </aside>
      </div>
      <footer className={styles.theaterBar}>
        <span>{live ? 'Opérationnelle' : 'Création'}</span>
        <div><i style={{ width: `${show.percent}%` }} /></div>
        <em>{show.percent} %</em>
      </footer>
    </div>
  )
}
