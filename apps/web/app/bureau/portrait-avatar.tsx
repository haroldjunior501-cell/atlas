/**
 * Hero talking head: photoreal portrait + audio/viseme mouth aperture.
 */
'use client'

import { useEffect, useRef } from 'react'
import {
  mouthDrivers,
  poseFromWeights,
  sampleClipProgress,
  SPLATTING_ASSET,
  type ArkitPose,
} from '@/lib/avatar-pipeline'
import type { LipSyncClock } from '@/lib/lip-sync-clock'
import { mayaAceClip, type MayaAceClip } from '@atlas/voice'
import styles from './ace-face.module.css'

/** Calibrated on live hero cover-fit of atlas-target.png */
const MOUTH = { x: 0.5, y: 0.708, w: 0.1 }

export function PortraitAvatar({
  speaking = false,
  listening = false,
  speech = '',
  clip = null,
  lipClock = null,
  label = 'Atlas',
  src = SPLATTING_ASSET.targetPortraitUrl,
}: {
  speaking?: boolean
  listening?: boolean
  speech?: string
  clip?: MayaAceClip | null
  lipClock?: LipSyncClock | null
  label?: string
  src?: string
}) {
  const host = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lipClockRef = useRef(lipClock)
  const speakingRef = useRef(speaking)
  const poseRef = useRef<ArkitPose>(poseFromWeights([]))
  lipClockRef.current = lipClock
  speakingRef.current = speaking

  useEffect(() => {
    const canvas = canvasRef.current
    const hostEl = host.current
    if (!canvas || !hostEl) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let raf = 0
    let cancelled = false
    let jawSmooth = 0
    let smileSmooth = 0
    let purseSmooth = 0
    let lastT = performance.now()
    const img = new Image()
    img.decoding = 'async'
    img.src = `${src}${src.includes('?') ? '&' : '?'}v=talk-3`

    const resize = () => {
      const w = Math.max(1, Math.round(hostEl.clientWidth * (window.devicePixelRatio || 1)))
      const h = Math.max(1, Math.round(hostEl.clientHeight * (window.devicePixelRatio || 1)))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (now: number) => {
      if (cancelled) return
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000))
      lastT = now
      resize()

      const w = canvas.width
      const h = canvas.height
      const drive = mouthDrivers(poseRef.current)
      const clock = lipClockRef.current
      const audioJaw = clock?.active ? (clock.audioLevel ?? 0) : 0
      const live = speakingRef.current
      const debugJaw = Number((window as unknown as { __atlasJaw?: number }).__atlasJaw)
      const targetJaw = Number.isFinite(debugJaw) && debugJaw > 0
        ? Math.min(1, debugJaw)
        : live
          ? Math.min(1, Math.max(audioJaw * 1.15, drive.jawOpen * 0.9, 0.08 + audioJaw * 0.22))
          : 0
      jawSmooth += (targetJaw - jawSmooth) * (1 - Math.exp(-(targetJaw > jawSmooth ? 34 : 14) * dt))
      smileSmooth += ((live ? Math.max(0.02, drive.smile) : 0.02) - smileSmooth) * (1 - Math.exp(-16 * dt))
      purseSmooth += ((live ? drive.purse : 0) - purseSmooth) * (1 - Math.exp(-18 * dt))

      ctx.clearRect(0, 0, w, h)
      if (!img.complete || img.naturalWidth < 2) {
        raf = window.requestAnimationFrame(draw)
        return
      }

      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      const dx = (w - dw) / 2
      const dy = (h - dh) / 2
      const t = now / 1000
      const talking = live || jawSmooth > 0.04
      ctx.save()
      ctx.translate(w / 2, h * 0.52)
      ctx.rotate(Math.sin(t * 0.32) * (talking ? 0.0025 : 0.008))
      ctx.scale(1 + Math.sin(t * 1.1) * (talking ? 0.002 : 0.005), 1 + Math.sin(t * 1.1) * (talking ? 0.002 : 0.005))
      ctx.translate(-w / 2, -h * 0.52)
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.restore()

      const jaw = jawSmooth
      if (jaw > 0.03) {
        const cx = w * MOUTH.x
        const cy = h * MOUTH.y
        const mw = w * MOUTH.w * (1 + smileSmooth * 0.25 - purseSmooth * 0.2)
        const open = Math.max(2, jaw * h * 0.032)

        ctx.save()
        // Dark aperture only — no skin plate / no hard lip ring
        const grad = ctx.createRadialGradient(cx, cy, 0.2, cx, cy, mw)
        grad.addColorStop(0, `rgba(36, 10, 16, ${0.55 + jaw * 0.3})`)
        grad.addColorStop(0.65, `rgba(22, 7, 11, ${0.4 + jaw * 0.2})`)
        grad.addColorStop(1, 'rgba(16, 5, 8, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(cx, cy, mw * 0.78, open * 0.7, 0, 0, Math.PI * 2)
        ctx.fill()
        if (jaw > 0.35) {
          ctx.fillStyle = `rgba(248, 236, 228, ${Math.min(0.28, (jaw - 0.35) * 0.9)})`
          ctx.beginPath()
          ctx.ellipse(cx, cy - open * 0.12, mw * 0.35, Math.max(1, open * 0.08), 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      raf = window.requestAnimationFrame(draw)
    }
    raf = window.requestAnimationFrame(draw)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [src])

  useEffect(() => {
    if (!speaking) {
      poseRef.current = poseFromWeights([])
      return
    }
    const active = clip?.frames?.length ? clip : mayaAceClip(speech || 'Atlas')
    const started = performance.now()
    let raf = 0
    const tick = (now: number) => {
      if (!speakingRef.current) return
      const clock = lipClockRef.current
      if (clock?.active) poseRef.current = sampleClipProgress(active, clock.progress, clock.char)
      else {
        const elapsed = (now - started) / 1000
        poseRef.current = sampleClipProgress(active, Math.min(1, elapsed / Math.max(0.05, active.durationMs / 1000)))
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [speaking, speech, clip])

  return (
    <span
      ref={host}
      className={`${styles.face} ${styles.hero} ${styles.portrait} ${listening ? styles.listen : ''} ${speaking ? styles.live : ''}`}
      title={label}
      aria-label={label}
      data-avatar-motion="audio-viseme"
      data-avatar-look="portrait"
    >
      <canvas ref={canvasRef} className={styles.portraitCanvas} />
    </span>
  )
}
