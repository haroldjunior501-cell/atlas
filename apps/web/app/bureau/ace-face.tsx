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
  /** URL portrait photoréaliste (prioritaire sur le blob SVG). */
  face?: string | null
  speaking?: boolean
  listening?: boolean
  speech?: string
  /** Maya-ACE / A2F clip (ARKit frames). Preferred over regenerating from text. */
  clip?: MayaAceClip | null
  /** Shared lip-sync clock updated from TTS/audio (no React lag). */
  lipClock?: LipSyncClock | null
  size?: 'thumb' | 'card' | 'hero'
  label?: string
  onReady?: () => void
  onError?: () => void
}) {
  const look = useMemo(() => palette(seed), [seed])
  const src = String(face || '').trim()
  const photo = src && !/dicebear|lorelei|avataaars|bottts|shapes|identicon/i.test(src) ? src : ''

  if (size === 'hero') {
    // Keep the FLAME talking head we are building — do not swap for a still photo.
    return (
      <FlameAvatar
        speaking={speaking}
        listening={listening}
        speech={speech}
        clip={clip}
        lipClock={lipClock}
        label={label || seed}
        onReady={onReady}
        onError={onError}
      />
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
}: {
  look: ReturnType<typeof palette>
  size: 'thumb' | 'card'
  label: string
}) {
  return (
    <span className={`${styles.face} ${size === 'card' ? styles.card : styles.thumb}`} title={label} aria-label={label}>
      <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden>
        <defs>
          <radialGradient id={`m-${look.uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={look.skinHi} />
            <stop offset="100%" stopColor={look.skin} />
          </radialGradient>
        </defs>
        <ellipse cx="40" cy="44" rx="18" ry="22" fill={`url(#m-${look.uid})`} />
        <path d="M22 40 C20 22 30 14 40 13 C50 14 60 22 58 40 C56 28 50 20 40 19 C30 20 24 28 22 40 Z" fill={look.hair} />
        <circle cx="33" cy="42" r="2.2" fill={look.iris} />
        <circle cx="47" cy="42" r="2.2" fill={look.iris} />
        <ellipse cx="40" cy="52" rx="4" ry="1.6" fill={look.lip} />
      </svg>
    </span>
  )
}

function palette(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 33 + seed.charCodeAt(index)) >>> 0
  const atlas = seed.trim().toLowerCase() === 'atlas'
  const skins = ['#e8b996', '#f0c4a4', '#d3a07a', '#b98055', '#8d5524']
  const hairs = ['#2a1b16', '#1f2937', '#7c2d12', '#3b1f0b', '#4c1d95']
  const irises = ['#6b4f3a', '#3b82f6', '#15803d', '#475569', '#7c3aed']
  const lips = ['#b76e79', '#b44d63', '#9f1239', '#be123c', '#a21caf']
  const rings = ['#7c5cff', '#38bdf8', '#a78bfa', '#22d3ee', '#818cf8']
  const skin = atlas ? '#e8b996' : skins[hash % skins.length]!
  const hair = atlas ? '#2a1b16' : hairs[(hash >> 3) % hairs.length]!
  return {
    uid: `p${hash.toString(36)}`,
    bg: '#070b14',
    skin,
    skinHi: atlas ? '#f7d9c0' : '#ffe0c8',
    hair,
    hairHi: atlas ? '#3d2a22' : '#4a3428',
    brow: atlas ? '#1a120f' : '#1f1510',
    iris: atlas ? '#6b4f3a' : irises[(hash >> 6) % irises.length]!,
    lip: atlas ? '#b76e79' : lips[(hash >> 5) % lips.length]!,
    ring: rings[hash % rings.length]!,
  }
}
