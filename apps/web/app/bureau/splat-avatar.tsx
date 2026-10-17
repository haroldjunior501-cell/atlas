/**
 * Look layer: trained Gaussian splat (/avatars/atlas.splat).
 * Motion stays ARKit / Maya-ACE (idle + lip cues via camera/root).
 */
'use client'

import { useEffect, useRef } from 'react'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'
import type { Object3D, Camera } from 'three'
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

type SplatViewer = {
  threeScene?: Object3D | null
  camera?: Camera | null
  addSplatScene: (path: string, opts?: Record<string, unknown>) => Promise<void>
  start: () => void
  dispose: () => void
}

export function SplatAvatar({
  speaking = false,
  listening = false,
  speech = '',
  clip = null,
  lipClock = null,
  label = 'Atlas',
  onReady,
  onError,
}: {
  speaking?: boolean
  listening?: boolean
  speech?: string
  clip?: MayaAceClip | null
  lipClock?: LipSyncClock | null
  label?: string
  onReady?: () => void
  onError?: () => void
}) {
  const host = useRef<HTMLSpanElement>(null)
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)
  readyRef.current = onReady
  errorRef.current = onError
  const lipClockRef = useRef(lipClock)
  const speakingRef = useRef(speaking)
  lipClockRef.current = lipClock
  speakingRef.current = speaking
  const api = useRef<{
    setPose: (pose: ArkitPose) => void
    setListen: (on: boolean) => void
    setSpeak: (on: boolean) => void
  } | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let cancelled = false
    let raf = 0
    let viewer: SplatViewer | null = null
    let listeningOn = listening
    let speakingOn = speaking
    let pose: ArkitPose = poseFromWeights([])

    const start = async () => {
      try {
        viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, 1, 0],
          initialCameraPosition: [0, 0.05, 1.35],
          initialCameraLookAt: [0, 0.05, 0],
          rootElement: el,
          sharedMemoryForWorkers: false,
          gpuAcceleratedSort: false,
          showLoadingUI: false,
          useBuiltInControls: false,
        }) as SplatViewer
        await viewer.addSplatScene(SPLATTING_ASSET.splatUrl, {
          showLoadingUI: false,
          progressiveLoad: true,
        })
        if (cancelled) {
          viewer.dispose()
          return
        }
        viewer.start()
        readyRef.current?.()

        const clockStart = performance.now()
        const tick = () => {
          if (cancelled || !viewer) return
          const t = (performance.now() - clockStart) / 1000
          const drive = mouthDrivers(pose)
          const three = viewer.threeScene
          const cam = viewer.camera
          if (three) {
            three.rotation.y = Math.sin(t * 0.25) * 0.03
            three.position.y = Math.sin(t * 0.9) * 0.004 + drive.jawOpen * 0.002
          }
          if (cam) {
            cam.position.z = 1.35 - (listeningOn ? 0.05 : 0) - (speakingOn ? 0.03 : 0) - drive.jawOpen * 0.02
          }
          raf = window.requestAnimationFrame(tick)
        }
        raf = window.requestAnimationFrame(tick)
      } catch {
        if (!cancelled) errorRef.current?.()
      }
    }

    api.current = {
      setPose: (next) => { pose = next },
      setListen: (on) => { listeningOn = on },
      setSpeak: (on) => { speakingOn = on },
    }

    void start()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      api.current = null
      try {
        viewer?.dispose()
      } catch {
        /* ignore */
      }
      while (el.firstChild) el.removeChild(el.firstChild)
    }
  }, [])

  useEffect(() => {
    api.current?.setListen(listening)
    api.current?.setSpeak(speaking)
  }, [listening, speaking])

  useEffect(() => {
    if (!speaking) {
      api.current?.setPose(poseFromWeights([]))
      return
    }
    const active = clip?.frames?.length ? clip : mayaAceClip(speech || 'Atlas')
    const started = performance.now()
    let raf = 0
    const tick = (now: number) => {
      if (!speakingRef.current) return
      const clock = lipClockRef.current
      if (clock?.active) {
        api.current?.setPose(sampleClipProgress(active, clock.progress, clock.char))
      } else {
        const elapsed = (now - started) / 1000
        const dur = Math.max(0.05, active.durationMs / 1000)
        api.current?.setPose(sampleClipProgress(active, Math.min(1, elapsed / dur)))
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [speaking, speech, clip])

  return (
    <span
      ref={host}
      className={`${styles.face} ${styles.hero} ${listening ? styles.listen : ''} ${speaking ? styles.live : ''}`}
      title={label}
      aria-label={label}
      data-avatar-motion="audio2face-arkit"
      data-avatar-look="splatting-avatar"
    />
  )
}

export async function splatAvailable(): Promise<boolean> {
  try {
    const response = await fetch(SPLATTING_ASSET.splatUrl, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}
