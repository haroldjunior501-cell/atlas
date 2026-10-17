'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mark } from '@/components/auth-screen'
import shell from '@/components/auth-screen.module.css'
import styles from './lancement.module.css'

const PROMPT = 'Monte une équipe cybersécurité : finance, produit et marketing.'
const REPLY = 'Prêt — Emma en finance, Alex au produit, Sarah au marketing.'

const ORG = [
  { name: 'CEO', role: 'Vous', face: '' },
  { name: 'ATLAS', role: 'Orchestration', face: '' },
  { name: 'Emma', role: 'Finance', face: '/landing/avatar-emma.png' },
  { name: 'Alex', role: 'Produit', face: '/landing/avatar-alex.png' },
  { name: 'Sarah', role: 'Marketing', face: '/landing/avatar-sarah.png' },
  { name: 'Thomas', role: 'Ventes', face: '/landing/avatar-thomas.png' },
]

export function LaunchScreen() {
  const router = useRouter()
  const params = useSearchParams()
  const organization = params.get('organisation')?.trim() || 'Votre organisation'
  const [typed, setTyped] = useState('')
  const [sent, setSent] = useState(false)
  const [reply, setReply] = useState('')
  const [nodes, setNodes] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    const wait = (ms: number) => new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, ms)
    })

    async function play() {
      while (!cancelled) {
        setTyped('')
        setSent(false)
        setReply('')
        setNodes(0)
        for (let index = 1; index <= PROMPT.length; index += 1) {
          if (cancelled) return
          setTyped(PROMPT.slice(0, index))
          await wait(28)
        }
        await wait(520)
        if (cancelled) return
        setSent(true)
        setTyped('')
        await wait(420)
        for (let index = 1; index <= REPLY.length; index += 1) {
          if (cancelled) return
          setReply(REPLY.slice(0, index))
          setNodes(Math.min(ORG.length, Math.ceil((index / REPLY.length) * ORG.length)))
          await wait(22)
        }
        setNodes(ORG.length)
        await wait(2800)
      }
    }

    void play()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className={styles.page}>
      <header className={shell.top}>
        <Link href="/" className={shell.logo}>
          <Mark />
          <span>
            <strong>ATLAS</strong>
            <small>AI OS FOR ORGANIZATIONS</small>
          </span>
        </Link>
      </header>

      <main className={styles.stage}>
        <h1>{organization} est prête !</h1>
        <button className={styles.start} type="button" onClick={() => router.push('/bureau')}>
          Lancer l’organisation
        </button>
        <p className={styles.discover}>Découvrir l’assistant ATLAS</p>
        <p className={styles.caption}>
          Décrivez l’entreprise. ATLAS la compose — voici un aperçu pendant que votre espace s’ouvre.
        </p>

        <section className={styles.chat} aria-label="Exemple d’assistant">
          <header>
            <span className={styles.spark}>✦</span>
            Assistant ATLAS
          </header>
          <div className={styles.thread}>
            {sent ? <p className={styles.user}>{PROMPT}</p> : <span />}
            {reply ? (
              <p className={styles.reply}>
                <span className={styles.spark}>✦</span>
                {reply}
              </p>
            ) : null}
          </div>
          <div className={styles.composer}>
            {typed ? <span>{typed}<i className={styles.caret} /></span> : sent ? <span /> : <em>Décrivez l’organisation…</em>}
            <button type="button" aria-label="Envoyer l’exemple" tabIndex={-1}>↑</button>
          </div>
        </section>

        <div className={styles.floor}>
          <div className={styles.rail} aria-hidden="true">
            <span className={styles.line} style={{ transform: `scaleX(${nodes / ORG.length})` }} />
            {ORG.map((person, index) => (
              <article key={person.name} className={index < nodes ? styles.nodeOn : styles.node}>
                {person.face ? (
                  <img src={person.face} alt="" />
                ) : person.name === 'ATLAS' ? (
                  <span className={styles.atlasNode}><Mark /></span>
                ) : (
                  <span className={styles.ceoNode}>CEO</span>
                )}
                <strong>{person.name}</strong>
                <small>{person.role}</small>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
