'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandIcon } from '@/components/brand-icon'
import { gatewayUrl } from '@/lib/atlas'
import styles from './auth-screen.module.css'

const PEOPLE = [
  {
    name: 'Sarah',
    role: 'CMO · Marketing',
    skills: 'Stratégie · Contenu · Croissance',
    status: 'En ligne',
    face: '/landing/avatar-sarah.png',
    tools: ['Notion', 'Gmail'],
    className: styles.sarah,
  },
  {
    name: 'Thomas',
    role: 'Sales · Commercial',
    skills: 'Prospection · CRM · Deals',
    status: 'En ligne',
    face: '/landing/avatar-thomas.png',
    tools: ['CRM', 'Gmail'],
    className: styles.thomas,
  },
  {
    name: 'Emma',
    role: 'CFO · Finance',
    skills: 'Budget · Finance · Reporting',
    status: 'En ligne',
    face: '/landing/avatar-emma.png',
    tools: ['Drive', 'Notion'],
    className: styles.emma,
  },
  {
    name: 'Alex',
    role: 'CTO · Produit',
    skills: 'Infrastructure · Déploiement · Sécurité',
    status: 'En tâche',
    face: '/landing/avatar-alex.png',
    tools: ['GitHub', 'Notion'],
    className: styles.alex,
  },
]

export function FloatingAgents() {
  return (
    <div className={styles.agents} aria-hidden="true">
      {PEOPLE.map((person) => (
        <article key={person.name} className={`${styles.agent} ${person.className}`}>
          <img className={styles.bust} src={person.face} alt="" />
          <div>
            <div className={styles.agentHead}>
              <strong>{person.name}</strong>
              <span className={person.status === 'En ligne' ? styles.online : styles.busy}>
                <i /> {person.status}
              </span>
            </div>
            <em>{person.role}</em>
            <small>{person.skills}</small>
            <div className={styles.tools}>
              {person.tools.map((tool) => <BrandIcon key={tool} name={tool} />)}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

export function Mark() {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="4" y1="2" x2="28" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffc98a" />
          <stop offset="38%" stopColor="#fd8925" />
          <stop offset="100%" stopColor="#ff1a08" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="16" y1="16" x2="16" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe3bf" />
          <stop offset="100%" stopColor="#ff7a32" />
        </linearGradient>
      </defs>
      <path d="M16 2.2 29.4 30.2H22.2L16 15.4 9.8 30.2H2.6Z" fill={`url(#${id}a)`} />
      <path d="M16 18 19.4 25.8H12.6Z" fill={`url(#${id}b)`} />
    </svg>
  )
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

type SignupStep = 'email' | 'code' | 'profile'

export function AuthScreen({ mode }: { mode: 'signup' | 'login' }) {
  const router = useRouter()
  const signup = mode === 'signup'
  const codeRefs = useRef<Array<HTMLInputElement | null>>([])
  const [step, setStep] = useState<SignupStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [news, setNews] = useState(false)
  const [sentCode, setSentCode] = useState('')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const enteredCode = digits.join('')
  const emailReady = validEmail(email)
  const loginReady = emailReady && password.trim().length >= 8
  const codeReady = enteredCode.length === 6
  const profileReady = fullName.trim().length > 1 && password.trim().length >= 8 && orgName.trim().length > 1
  const ready = !signup ? loginReady : step === 'email' ? emailReady : step === 'code' ? codeReady : profileReady

  useEffect(() => {
    if (step === 'code') codeRefs.current[0]?.focus()
  }, [step])

  function issueCode() {
    const next = makeCode()
    setSentCode(next)
    setDigits(['', '', '', '', '', ''])
    setError('')
    setStep('code')
  }

  function setDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    setDigits((current) => {
      const next = [...current]
      next[index] = digit
      return next
    })
    setError('')
    if (digit) codeRefs.current[index + 1]?.focus()
  }

  function onCodeKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  function onCodePaste(text: string) {
    const chars = text.replace(/\D/g, '').slice(0, 6).split('')
    if (chars.length === 0) return
    setDigits([...chars, '', '', '', '', '', ''].slice(0, 6))
    codeRefs.current[Math.min(chars.length, 5)]?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready || pending) return
    if (step === 'email' && signup) {
      issueCode()
      return
    }
    if (step === 'code' && signup) {
      if (enteredCode !== sentCode) {
        setError('Ce code ne correspond pas. Vérifiez l’email ou renvoyez-en un.')
        return
      }
      setError('')
      setStep('profile')
      return
    }
    setPending(true)
    try {
      const response = await fetch(`${gatewayUrl}/v1/auth/${signup ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          signup
            ? { name: fullName.trim(), email: email.trim(), password, organization: orgName.trim() }
            : { email: email.trim(), password },
        ),
      })
      const payload = (await response.json()) as { id?: string; name?: string; organization?: string; error?: string }
      if (!response.ok || !payload.id) {
        setError(payload.error ?? 'Le compte n’a pas pu être enregistré.')
        setPending(false)
        return
      }
      localStorage.setItem('atlas-user', payload.id)
      localStorage.setItem('atlas-name', signup ? fullName.trim() : (payload.name ?? ''))
      if (signup) localStorage.setItem('atlas-company', orgName.trim())
      else if (payload.organization) localStorage.setItem('atlas-company', payload.organization)
      if (!signup) {
        router.push('/bureau')
        return
      }
      const params = new URLSearchParams({
        nom: fullName.trim(),
        organisation: orgName.trim(),
      })
      router.push(`/lancement?${params}`)
    } catch {
      setError('La base ne répond pas. Réessayez.')
      setPending(false)
    }
  }

  const title = !signup
    ? 'Retrouvez votre organisation.'
    : step === 'code'
      ? 'Vérifiez votre email.'
      : step === 'profile'
        ? 'Terminez votre compte.'
        : 'Ouvrez votre organisation.'

  return (
    <div className={styles.screen}>
      <FloatingAgents />

      <header className={styles.top}>
        <Link href="/" className={styles.logo}>
          <Mark />
          <span>
            <strong>ATLAS</strong>
            <small>AI OS FOR ORGANIZATIONS</small>
          </span>
        </Link>
        <p className={styles.switch}>
          {signup ? (
            <>Déjà un compte ? <Link href="/connexion">Se connecter</Link></>
          ) : (
            <>Pas encore de compte ? <Link href="/commencer">Commencer</Link></>
          )}
        </p>
      </header>

      <main className={styles.stage}>
        <h1>{title}</h1>
        <form className={styles.card} onSubmit={submit}>
          {signup && step === 'code' ? (
            <>
              <p className={styles.hint}>
                Cliquez sur le lien envoyé à <strong>{email.trim()}</strong>, ou entrez le code reçu.
              </p>
              <div className={styles.codes}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(node) => { codeRefs.current[index] = node }}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    aria-label={`Chiffre ${index + 1}`}
                    value={digit}
                    onChange={(event) => setDigit(index, event.target.value)}
                    onKeyDown={(event) => onCodeKey(index, event)}
                    onPaste={(event) => {
                      event.preventDefault()
                      onCodePaste(event.clipboardData.getData('text'))
                    }}
                  />
                ))}
              </div>
              <p className={styles.resend}>
                Vous n’avez rien reçu ?{' '}
                <button type="button" onClick={issueCode}>Renvoyer</button>
              </p>
              <p className={styles.demoCode}>Démonstration · code {sentCode}</p>
            </>
          ) : null}

          {signup && step === 'profile' ? (
            <>
              <label className={styles.field}>
                <span>Nom complet</span>
                <input
                  name="name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value)
                    setError('')
                  }}
                />
              </label>
              <label className={styles.field}>
                <span>Mot de passe</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError('')
                  }}
                />
              </label>
              <label className={styles.field}>
                <span>Nom de l’organisation</span>
                <div className={styles.slug}>
                  <input
                    name="organization"
                    autoComplete="organization"
                    value={orgName}
                    onChange={(event) => {
                      setOrgName(event.target.value)
                      setError('')
                    }}
                  />
                  <em>.atlas</em>
                </div>
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={news} onChange={(event) => setNews(event.target.checked)} />
                Recevoir les nouvelles d’ATLAS.
              </label>
            </>
          ) : null}

          {!signup || step === 'email' ? (
            <label className={styles.field}>
              <span>{signup ? 'Email professionnel' : 'Email'}</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError('')
                }}
              />
            </label>
          ) : null}

          {!signup ? (
            <label className={styles.field}>
              <span>Mot de passe</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
              />
            </label>
          ) : null}

          <button className={ready && !pending ? `${styles.submit} ${styles.submitReady}` : styles.submit} type="submit" disabled={!ready || pending}>
            {signup && step === 'profile' ? 'Créer le compte' : signup && step === 'code' ? 'Valider' : signup ? 'Continuer' : 'Se connecter'}
          </button>
          {error ? <p className={styles.error}>{error}</p> : null}
          {signup && step === 'email' ? (
            <p className={styles.legal}>
              En continuant, vous acceptez les <a href="#conditions">conditions d’utilisation</a><br />
              et la <a href="#confidentialite">politique de confidentialité</a>.
            </p>
          ) : null}
        </form>
      </main>
    </div>
  )
}
