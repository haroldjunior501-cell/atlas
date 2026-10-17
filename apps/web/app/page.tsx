'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { ArchitectureSim } from '@/components/architecture-sim'
import { BrandIcon } from '@/components/brand-icon'
import styles from './landing.module.css'

const PILLARS = [
  { title: 'Entrepreneurs', text: 'Transformez une idée en entreprise opérationnelle' },
  { title: 'Départements', text: 'Structurez votre organisation comme vous le souhaitez' },
  { title: 'Agents IA', text: 'Des employés IA réalistes avec des compétences réelles' },
  { title: 'Intégrations', text: 'Connectez vos outils existants (email, calendrier, CRM, etc.)' },
  { title: 'Sécurité', text: 'Gardez le contrôle avec un système de permissions' },
]

const SOURCES = [
  ['Documents', '#7c6bff'],
  ['Base de connaissances', '#3dcb8a'],
  ['Données internes', '#e0a15a'],
  ['Web / Recherche', '#4c8dff'],
]

const AGENTS = ['Marketing', 'Ventes', 'Finance', 'Développement', 'RH / Legal']

const TOOLS = [
  ['Gmail', '#ea4335'],
  ['Google Calendar', '#4285f4'],
  ['Notion', '#e8e8e8'],
  ['GitHub', '#f0f0f0'],
  ['CRM', '#ff7a59'],
  ['Drive', '#34a853'],
]

const MODELS = ['OpenAI', 'Claude', 'Gemini', 'Mistral']

const PARTNERS = ['OpenAI', 'Microsoft', 'Meta', 'NVIDIA', 'Google', 'aws']

const CASES = [
  { title: 'Cybersécurité', text: 'Pour les PME européennes', image: '/landing/cyber.png' },
  { title: 'E-commerce', text: 'Vente en ligne / Marketing', image: '/landing/commerce.png' },
  { title: 'Santé', text: 'Cliniques / Télémédecine', image: '/landing/sante.png' },
  { title: 'Fintech', text: 'Paiements / Conformité', image: '/landing/fintech.png' },
  { title: 'Immobilier', text: 'Gestion / Investissement', image: '/landing/immo.png' },
]

function Mark() {
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

export default function HomePage() {
  const [pillar, setPillar] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setPillar((current) => (current + 1) % PILLARS.length)
    }, 4200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <Mark />
          <span>
            <strong>ATLAS</strong>
            <small>AI OS FOR ORGANIZATIONS</small>
          </span>
        </Link>
        <nav className={styles.nav}>
          <a href="#produit">Produit</a>
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#cas">Cas d&apos;usage</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#communaute">Communauté</a>
        </nav>
        <div className={styles.headerActions}>
          <button type="button" className={styles.linkBtn}>FR</button>
          <Link href="/connexion" className={styles.linkBtn}>Se connecter</Link>
          <Link href="/commencer" className={styles.primary}>Commencer</Link>
        </div>
      </header>

      <main>
        <section className={`${styles.wrap} ${styles.hero}`} id="produit">
          <div>
            <span className={styles.badge}><span className={styles.dot} /> NOUVELLE ÈRE</span>
            <h1>
              Agents et flux de travail IA
              <span className={styles.grad}>Tu peux voir et contrôler</span>
            </h1>
            <p>
              ATLAS vous permet de concevoir, personnaliser et piloter une organisation complète
              d&apos;employés IA pour transformer vos idées en réalité. Connectez vos outils, définissez
              les rôles, déléguez les tâches et gardez le contrôle.
            </p>
            <div className={styles.ctaRow}>
              <Link href="/bureau" className={styles.primary}>Créer mon entreprise →</Link>
              <a href="#cas" className={styles.ghost}>Voir la démo</a>
            </div>
            <div className={styles.pills}>
              <span><span className={styles.dot} /> Organisation complète</span>
              <span><span className={styles.dot} /> Agents IA réalistes</span>
              <span><span className={styles.dot} /> Connecté à vos outils</span>
              <span><span className={styles.dot} /> Pilotage vocal (Jarvis)</span>
            </div>
          </div>
          <div className={styles.visual}>
            <div className={styles.portrait} role="img" aria-label="Avatar IA ATLAS" />
            <span className={styles.glow} />
            <article className={`${styles.card} ${styles.emma}`}>
              <img className={styles.face} src="/landing/avatar-emma.png" alt="" />
              <span><b>Emma</b><em>CFO</em></span>
              <span className={styles.meter}>92%</span>
            </article>
            <article className={`${styles.card} ${styles.alex}`}>
              <img className={styles.face} src="/landing/avatar-alex.png" alt="" />
              <span><b>Alex</b><em>CTO</em></span>
            </article>
            <article className={`${styles.card} ${styles.sarah}`}>
              <img className={styles.face} src="/landing/avatar-sarah.png" alt="" />
              <span><b>Sarah</b><em>CMO</em></span>
            </article>
            <article className={`${styles.card} ${styles.thomas}`}>
              <img className={styles.face} src="/landing/avatar-thomas.png" alt="" />
              <span><b>Thomas</b><em>Sales</em></span>
              <span className={styles.meter}>64%</span>
            </article>
            <article className={`${styles.card} ${styles.voice}`}>
              <div>
                <div className={styles.wave}><span /><span /><span /><span /><span /></div>
                <p>Bonjour, je suis ATLAS. Décrivez votre idée et je vais créer votre organisation.</p>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.partners}>
          <p>Propulsé par les meilleures technologies</p>
          <div className={styles.marquee}>
            <div className={styles.logos}>
              {[...PARTNERS, ...PARTNERS].map((name, index) => (
                <span key={`${name}-${index}`} className={styles.logoItem}>
                  <BrandIcon name={name} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.eco}`} id="fonctionnalites">
          <div className={styles.pillars}>
            {PILLARS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === pillar ? `${styles.pillar} ${styles.pillarActive}` : styles.pillar}
                onClick={() => setPillar(index)}
              >
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </button>
            ))}
          </div>
          <div>
            <div className={styles.ecoHead}>
              <div>
                <p className={styles.kicker}>VOTRE ORGANISATION, CONNECTÉE</p>
                <h2>Un écosystème d&apos;agents connectés à vos outils et données</h2>
                <p>ATLAS orchestre vos agents IA, vos outils et vos flux de travail dans une seule plateforme.</p>
              </div>
              <Link className={styles.more} href="/architecture">Voir l&apos;architecture →</Link>
            </div>
            <div className={styles.diagram}>
              <svg className={styles.wires} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M18 28 C 28 28 30 42 40 42" />
                <path d="M18 48 C 28 48 30 50 40 50" />
                <path d="M18 70 C 28 70 30 58 40 56" />
                <path d="M60 46 C 70 40 72 22 80 22" />
                <path d="M60 52 C 70 58 72 74 82 74" />
                <circle r="0.9"><animateMotion dur="2.4s" repeatCount="indefinite" path="M18 48 C 28 48 30 50 40 50" /></circle>
                <circle r="0.9"><animateMotion dur="2.6s" repeatCount="indefinite" path="M60 46 C 70 40 72 22 80 22" /></circle>
              </svg>
              <div className={styles.col}>
                <p>Sources de données</p>
                {SOURCES.map(([label, color]) => (
                  <div key={label} className={styles.chip}>
                    <span className={styles.swatch} style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
              <div className={styles.center}>
                <div className={styles.ceo}>CEO / Fondateur</div>
                <div className={styles.hub}>
                  <div>
                    <Mark />
                    <strong>ATLAS</strong>
                    <span>Orchestrator</span>
                  </div>
                </div>
                <div>
                  <p className={styles.hubLabel}>Modèles IA</p>
                  <div className={styles.models}>
                    {MODELS.map((model) => (
                      <div key={model} className={styles.model}>
                        <BrandIcon name={model} />
                        {model}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.col}>
                <p>Agents IA</p>
                {AGENTS.map((agent) => <div key={agent} className={styles.chip}>{agent}</div>)}
              </div>
              <div className={styles.col}>
                <p>Outils connectés</p>
                {TOOLS.map(([label]) => (
                  <div key={label} className={styles.chip}>
                    <BrandIcon name={label} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.cases}`} id="cas">
          <div className={styles.casesHead}>
            <div>
              <p className={styles.kicker}>CAS D&apos;USAGE</p>
              <h2>Des organisations IA pour tous les secteurs</h2>
              <p>Que vous lanciez une startup, une agence ou une entreprise, ATLAS s&apos;adapte à votre vision.</p>
            </div>
            <a className={styles.more} href="#cas">Voir tous les cas d&apos;usage →</a>
          </div>
          <div className={styles.caseRow}>
            {CASES.map((item) => (
              <article key={item.title} className={styles.case} style={{ backgroundImage: `url(${item.image})` }}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </article>
            ))}
          </div>
          <p className={styles.simNote}>
            Vous donnez un ordre. ATLAS le comprend, répartit le travail entre vos agents, ouvre les outils et demande votre accord si le budget dépasse la limite.
          </p>
          <ArchitectureSim />
        </section>
        <div id="tarifs" />
        <div id="communaute" />
      </main>
    </div>
  )
}
