'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BrandIcon } from '@/components/brand-icon'
import styles from '../app/architecture/architecture.module.css'

const STEPS = [
  {
    tick: '00:01',
    title: 'Ordre du CEO',
    text: 'Vous demandez le lancement et un budget de 1 200 €.',
    live: ['vous'],
    edges: [] as string[],
  },
  {
    tick: '00:02',
    title: 'ATLAS reçoit',
    text: 'L’orchestrateur lit la mémoire, les rôles et les permissions.',
    live: ['vous', 'atlas'],
    edges: ['vous-atlas'],
  },
  {
    tick: '00:03',
    title: 'La mission se découpe',
    text: 'Sarah prend la campagne, Thomas le pipeline, Alex la livraison, Emma le budget.',
    live: ['atlas', 'sarah', 'thomas', 'alex', 'emma'],
    edges: ['atlas-sarah', 'atlas-thomas', 'atlas-alex', 'atlas-emma'],
  },
  {
    tick: '00:04',
    title: 'Les outils s’ouvrent',
    text: 'Sarah écrit dans Notion, Thomas lit le CRM, Alex prépare GitHub.',
    live: ['sarah', 'notion', 'thomas', 'crm', 'alex', 'github'],
    edges: ['sarah-notion', 'thomas-crm', 'alex-github'],
  },
  {
    tick: '00:05',
    title: 'Plafond dépassé',
    text: '1 200 € dépasse les 500 € d’Emma. Elle s’arrête et demande votre accord.',
    live: ['emma', 'atlas', 'approval'],
    edges: ['emma-approval', 'atlas-emma'],
    gate: true,
  },
  {
    tick: '00:06',
    title: 'Journal',
    text: 'ATLAS note qui a agi, quoi, quand, avec quelle permission, et pourquoi.',
    live: ['atlas', 'journal'],
    edges: ['atlas-journal'],
  },
]

const NODES = [
  { id: 'vous', label: 'Vous', sub: 'CEO', x: 40, y: 4 },
  { id: 'atlas', label: 'ATLAS', sub: 'Orchestrateur', x: 38, y: 24 },
  { id: 'sarah', label: 'Sarah', sub: 'CMO', x: 4, y: 48, face: '/landing/avatar-sarah.png' },
  { id: 'thomas', label: 'Thomas', sub: 'Sales', x: 26, y: 48, face: '/landing/avatar-thomas.png' },
  { id: 'alex', label: 'Alex', sub: 'CTO', x: 50, y: 48, face: '/landing/avatar-alex.png' },
  { id: 'emma', label: 'Emma', sub: 'CFO', x: 72, y: 48, face: '/landing/avatar-emma.png' },
  { id: 'notion', label: 'Notion', sub: 'Campagne', x: 2, y: 74, brand: 'Notion' },
  { id: 'crm', label: 'CRM', sub: 'Pipeline', x: 24, y: 74, brand: 'CRM' },
  { id: 'github', label: 'GitHub', sub: 'Livraison', x: 48, y: 74, brand: 'GitHub' },
  { id: 'approval', label: 'Approbation', sub: '1 200 €', x: 70, y: 74 },
  { id: 'journal', label: 'Journal', sub: 'Audit', x: 68, y: 18 },
]

const EDGES: Record<string, string> = {
  'vous-atlas': 'M 48 12 C 48 16 48 18 48 24',
  'atlas-sarah': 'M 46 34 C 40 40 18 42 14 48',
  'atlas-thomas': 'M 48 34 C 46 40 36 42 34 48',
  'atlas-alex': 'M 52 34 C 54 40 58 42 58 48',
  'atlas-emma': 'M 54 34 C 62 40 78 42 80 48',
  'sarah-notion': 'M 12 58 C 12 64 10 68 10 74',
  'thomas-crm': 'M 34 58 C 34 64 32 68 32 74',
  'alex-github': 'M 58 58 C 58 64 56 68 56 74',
  'emma-approval': 'M 80 58 C 80 64 78 68 78 74',
  'atlas-journal': 'M 58 28 C 68 26 72 24 74 22',
}

const AGENTS = new Set(['sarah', 'thomas', 'alex', 'emma'])

export function ArchitectureSim({ journal = false, framed = false }: { journal?: boolean; framed?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const approveRef = useRef<HTMLButtonElement>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const [cursor, setCursor] = useState({ x: 80, y: 40, clicking: false })

  const step = STEPS[index]
  const waiting = Boolean(step.gate) && decision === null
  const finished = index === STEPS.length - 1 && decision !== null
  const log = [
    ...STEPS.slice(0, index + 1).map((item) => ({ tick: item.tick, text: item.text })),
    ...(decision === 'approved' ? [{ tick: '00:06', text: 'Vous approuvez. Emma peut engager les 1 200 €.' }] : []),
    ...(decision === 'rejected' ? [{ tick: '00:06', text: 'Vous refusez. Emma n’engage rien.' }] : []),
  ]

  function placeCursor(target: Element | null) {
    const stage = stageRef.current
    if (!stage || !target) return
    const area = stage.getBoundingClientRect()
    const box = target.getBoundingClientRect()
    setCursor({
      x: box.left - area.left + box.width * 0.62,
      y: box.top - area.top + box.height * 0.55,
      clicking: false,
    })
  }

  useEffect(() => {
    if (!playing || waiting || finished) return
    const id = window.setTimeout(() => {
      setIndex((current) => Math.min(current + 1, STEPS.length - 1))
    }, 2800)
    return () => window.clearTimeout(id)
  }, [playing, waiting, finished, index])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const aim = waiting ? null : step.live[step.live.length - 1]
    const target = aim ? stage.querySelector(`[data-node="${aim}"]`) : approveRef.current
    placeCursor(target)
  }, [index, waiting, step.live])

  useEffect(() => {
    if (!waiting || !playing) return
    const click = window.setTimeout(() => setCursor((current) => ({ ...current, clicking: true })), 900)
    const go = window.setTimeout(() => {
      setCursor((current) => ({ ...current, clicking: false }))
      setDecision('approved')
    }, 1500)
    return () => {
      window.clearTimeout(click)
      window.clearTimeout(go)
    }
  }, [waiting, playing])

  useEffect(() => {
    if (!finished || decision !== 'approved') return
    const id = window.setTimeout(() => {
      setIndex(0)
      setDecision(null)
      setPlaying(true)
    }, 4200)
    return () => window.clearTimeout(id)
  }, [finished, decision])

  function restart() {
    setIndex(0)
    setDecision(null)
    setPlaying(true)
  }

  const caption = decision === 'approved' && index === STEPS.length - 1
    ? 'Vous approuvez. Emma peut engager les 1 200 €.'
    : decision === 'rejected' && index === STEPS.length - 1
      ? 'Vous refusez. Emma n’engage rien.'
      : step.text

  const stage = (
    <div className={journal ? styles.layout : styles.solo}>
      <div className={styles.stage} ref={stageRef}>
        <svg className={styles.wires} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {Object.entries(EDGES).map(([id, d]) => (
            <path key={id} d={d} className={step.edges.includes(id) ? styles.edgeOn : styles.edge} />
          ))}
          {step.edges.map((id) => (
            <g key={id}>
              <circle r="1.15" className={styles.packet}>
                <animateMotion dur="1.5s" repeatCount="indefinite" path={EDGES[id]} />
              </circle>
              <circle r="0.8" className={styles.packet}>
                <animateMotion dur="1.5s" begin="0.7s" repeatCount="indefinite" path={EDGES[id]} />
              </circle>
            </g>
          ))}
        </svg>
        {NODES.map((node) => (
          <article
            key={node.id}
            data-node={node.id}
            className={step.live.includes(node.id) ? `${styles.node} ${styles.nodeOn}` : styles.node}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            {node.face ? <img src={node.face} alt="" /> : null}
            {node.brand ? <BrandIcon name={node.brand} /> : null}
            <span>
              <strong>{node.label}</strong>
              <small>{step.live.includes(node.id) && AGENTS.has(node.id) ? 'En cours' : node.sub}</small>
            </span>
            {AGENTS.has(node.id) ? <b className={styles.bar} /> : null}
          </article>
        ))}
        <div className={styles.cursor} style={{ left: cursor.x, top: cursor.y }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 2.5 4 18.2 8.4 14.2 12.2 21.2 14.8 20 11 13.2 17.2 13.2Z" />
          </svg>
          {cursor.clicking ? <span className={styles.ripple} /> : null}
        </div>
        {waiting ? (
          <div className={styles.gate}>
            <p>Emma demande l’accord pour 1 200 €.</p>
            <div>
              <button ref={approveRef} type="button" onClick={() => setDecision('approved')}>Approuver</button>
              <button type="button" onClick={() => setDecision('rejected')}>Refuser</button>
            </div>
          </div>
        ) : null}
      </div>

      {journal ? (
        <aside className={styles.log}>
          <p>Journal de simulation</p>
          <ol>
            {log.map((line) => (
              <li key={`${line.tick}-${line.text}`}>
                <span>{line.text}</span>
                <time>{line.tick}</time>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </div>
  )

  if (!framed) return stage

  return (
    <>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← ATLAS</Link>
        <p>Pilotage automatique · t {step.tick}</p>
        <div className={styles.controls}>
          <button type="button" onClick={() => setPlaying((value) => !value)}>
            {playing ? 'Pause' : 'Lecture'}
          </button>
          <button type="button" onClick={restart}>Rejouer</button>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.kicker}>ARCHITECTURE</p>
          <h1>ATLAS orchestre, en direct.</h1>
          <p>{step.title}. {caption}</p>
        </div>
        {stage}
      </main>
    </>
  )
}
