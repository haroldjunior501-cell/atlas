'use client'

import { useMemo, useState } from 'react'
import type { MayaAceClip } from '@atlas/voice'
import type { LipSyncClock } from '@/lib/lip-sync-clock'
import { FlameAvatar } from './flame-avatar'
import styles from './ace-face.module.css'

export function AceFace({
  seed,
  face,
  speaking = false,
  listening = false,
  speech = '',
  clip = null,
  lipClock = null,
  size = 'thumb',
  label,
  onReady,
  onError,
}: {
  seed: string
  face?: string | null
  speaking?: boolean
  listening?: boolean
  speech?: string
  clip?: MayaAceClip | null
  lipClock?: LipSyncClock | null
  size?: 'thumb' | 'card' | 'hero'
  label?: string
  onReady?: () => void
  onError?: () => void
}) {
  const look = useMemo(() => palette(seed), [seed])
  const src = String(face || '').trim()
  const photo = src && !/dicebear|lorelei|avataaars|bottts|shapes|identicon/i.test(src) ? src : ''
  const [heroReady, setHeroReady] = useState(false)
  const [heroAttempt, setHeroAttempt] = useState(0)

  if (size === 'hero') {
    return (
      <span className={styles.heroStack} aria-label={label || seed}>
        <span className={`${styles.heroBoot} ${heroReady ? '' : styles.heroBootVisible}`.trim()}>
          <MiniAvatar look={look} size="hero" label={label || seed} speaking={speaking} listening={listening} />
        </span>
        <span className={`${styles.heroLive} ${heroReady ? styles.heroLiveVisible : ''}`.trim()}>
          <FlameAvatar
            key={`flame-${heroAttempt}`}
            speaking={speaking}
            listening={listening}
            speech={speech}
            clip={clip}
            lipClock={lipClock}
            label={label || seed}
            onReady={() => {
              setHeroReady(true)
              onReady?.()
            }}
            onError={() => {
              setHeroReady(false)
              onError?.()
              window.setTimeout(() => {
                setHeroAttempt((n) => (n < 2 ? n + 1 : n))
              }, 1200)
            }}
          />
        </span>
      </span>
    )
  }

  if (photo) {
    return <PhotoAvatar src={photo} size={size} label={label || seed} accent={look.ring} />
  }

  return <MiniAvatar look={look} size={size} label={label || seed} />
}

function PhotoAvatar({
  src,
  size,
  label,
  accent,
}: {
  src: string
  size: 'thumb' | 'card'
  label: string
  accent: string
}) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return <MiniAvatar look={palette(label)} size={size} label={label} />
  }
  return (
    <span
      className={`${styles.face} ${styles.photo} ${size === 'card' ? styles.card : styles.thumb}`}
      title={label}
      aria-label={label}
      style={{ ['--face-ring' as string]: accent }}
    >
      <img
        className={styles.photoImg}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    </span>
  )
}

function MiniAvatar({
  look,
  size,
  label,
  speaking = false,
  listening = false,
}: {
  look: ReturnType<typeof palette>
  size: 'thumb' | 'card' | 'hero'
  label: string
  speaking?: boolean
  listening?: boolean
}) {
  const shell = size === 'hero' ? styles.hero : size === 'card' ? styles.card : styles.thumb
  const live = speaking ? styles.live : listening ? styles.listen : ''
  return (
    <span className={`${styles.face} ${shell} ${live}`.trim()} title={label} aria-label={label}>
      <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden>
        <defs>
          <radialGradient id={`m-${look.uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={look.skinHi} />
            <stop offset="100%" stopColor={look.skin} />
          </radialGradient>
        </defs>
        <circle cx="40" cy="40" r="36" fill={`url(#m-${look.uid})`} />
        <path d="M22 40 C20 22 30 14 40 13 C50 14 60 22 58 40 C56 28 50 20 40 19 C30 20 24 28 22 40 Z" fill={look.hair} />
        <circle cx="33" cy="42" r="2.2" fill={look.iris} />
        <circle cx="47" cy="42" r="2.2" fill={look.iris} />
        <ellipse cx="40" cy="52" rx={speaking ? 5.2 : 4} ry={speaking ? 2.4 : 1.6} fill={look.lip} />
      </svg>
    </span>
  )
}

function palette(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const hue = hash % 360
  const uid = `a${hash.toString(36)}`
  return {
    uid,
    skin: `hsl(${(hue + 30) % 360} 28% 62%)`,
    skinHi: `hsl(${(hue + 30) % 360} 32% 74%)`,
    hair: `hsl(${(hue + 200) % 360} 18% 22%)`,
    iris: `hsl(${(hue + 210) % 360} 45% 35%)`,
    lip: `hsl(${(hue + 10) % 360} 42% 48%)`,
    ring: `hsl(${hue} 70% 62%)`,
  }
}
