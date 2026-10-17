/**
 * Look layer: FLAME GLB with morph targets. Motion = ARKit / Maya-ACE + audio energy.
 */
'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  mouthDrivers,
  poseFromWeights,
  sampleClip,
  sampleClipProgress,
  SPLATTING_ASSET,
  type ArkitPose,
} from '@/lib/avatar-pipeline'
import type { LipSyncClock } from '@/lib/lip-sync-clock'
import { mayaAceClip, type MayaAceClip } from '@atlas/voice'
import styles from './ace-face.module.css'

type MouthKey = keyof ReturnType<typeof mouthDrivers>

const MORPH_HINTS: Array<{ key: MouthKey; match: RegExp; scale?: number }> = [
  { key: 'jawOpen', match: /^Pose1$/i, scale: 1.28 },
  { key: 'jawOpen', match: /jaw|mouthopen|pose.?jaw/i, scale: 1.2 },
  { key: 'smile', match: /^Exp2$/i, scale: 0.95 },
  { key: 'purse', match: /^Exp3$/i, scale: 0.95 },
  { key: 'funnel', match: /^Exp4$/i, scale: 0.95 },
  { key: 'browUp', match: /^Exp5$/i, scale: 0.75 },
  { key: 'blinkL', match: /^Exp6$/i, scale: 0.85 },
  { key: 'blinkR', match: /^Exp7$/i, scale: 0.85 },
  { key: 'close', match: /^Exp8$/i, scale: 0.28 },
  { key: 'smile', match: /smile|mouthsmile/i },
  { key: 'purse', match: /pucker|purse|kiss/i },
  { key: 'blinkL', match: /blink.?l|eyeblinkleft/i },
  { key: 'blinkR', match: /blink.?r|eyeblinkright/i },
  { key: 'browUp', match: /brow.?up|browinner/i },
]

/** FLAME Pose1 jaw deltas are tiny (~5mm). Scale them to a human speaking aperture. */
function amplifyMorph(geometry: THREE.BufferGeometry, index: number, factor: number) {
  const positions = geometry.morphAttributes.position
  const normals = geometry.morphAttributes.normal
  const scaleAttr = (attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined) => {
    if (!attr || !('setXYZ' in attr)) return
    for (let i = 0; i < attr.count; i += 1) {
      attr.setXYZ(i, attr.getX(i) * factor, attr.getY(i) * factor, attr.getZ(i) * factor)
    }
    attr.needsUpdate = true
  }
  scaleAttr(positions?.[index])
  scaleAttr(normals?.[index])
}

function boostJawMorphs(mesh: THREE.Mesh) {
  const dict = mesh.morphTargetDictionary
  const geo = mesh.geometry
  if (!dict || !geo.morphAttributes.position) return
  const jaw = dict.Pose1 ?? dict.pose1
  // Amplify enough to read speech, not so much the chin tears / sticks open
  if (typeof jaw === 'number') amplifyMorph(geo, jaw, 4.6)
  if (typeof dict.Pose2 === 'number') amplifyMorph(geo, dict.Pose2, 2.4)
  if (typeof dict.Pose3 === 'number') amplifyMorph(geo, dict.Pose3, 2.2)
}

function mapMorphs(mesh: THREE.Mesh) {
  const dict = mesh.morphTargetDictionary || {}
  const influences = mesh.morphTargetInfluences || []
  const links: Array<{ index: number; key: keyof ReturnType<typeof mouthDrivers>; scale: number }> = []
  const used = new Set<number>()
  for (const hint of MORPH_HINTS) {
    for (const [name, index] of Object.entries(dict)) {
      const idx = Number(index)
      if (used.has(idx)) continue
      if (hint.match.test(name)) {
        links.push({ index: idx, key: hint.key, scale: hint.scale ?? 1 })
        used.add(idx)
        break
      }
    }
  }
  if (!links.some((l) => l.key === 'jawOpen')) {
    const pose1 = dict.Pose1 ?? dict.pose1 ?? dict.Exp1
    if (typeof pose1 === 'number') {
      links.unshift({ index: pose1, key: 'jawOpen', scale: 1.28 })
    }
  }
  return { influences, links }
}

export function FlameAvatar({
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
  /** Shared mutable clock — read every frame (no React lag). */
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
  const localSpeakRef = useRef(false)
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
    let raf = 0
    let cancelled = false
    const width = el.clientWidth || 320
    const height = el.clientHeight || 400
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 40)
    camera.position.set(0, 0.04, 1.15)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    el.appendChild(renderer.domElement)

    // Softer key — hard beauty lights were making albedo blotches scream
    scene.add(new THREE.AmbientLight(0xc8b8a8, 0.72))
    const key = new THREE.DirectionalLight(0xffe8d6, 1.35)
    key.position.set(0.45, 0.75, 1.2)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xb8c4e0, 0.45)
    fill.position.set(-0.9, 0.25, 0.9)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffc9a8, 0.28)
    rim.position.set(-0.2, 0.55, -1.0)
    scene.add(rim)

    const root = new THREE.Group()
    scene.add(root)
    let morphLinks: ReturnType<typeof mapMorphs> | null = null
    let listeningOn = listening
    let speakingOn = speaking
    let pose: ArkitPose = poseFromWeights([])
    let baseCamZ = 1.15
    const restSmile = 0.04
    let jawSmooth = 0
    let smileSmooth = restSmile
    let purseSmooth = 0
    let funnelSmooth = 0
    let pose2Index = -1
    let pose3Index = -1
    let lastT = 0

    const tuneSkinMaterial = (mesh: THREE.Mesh, map?: THREE.Texture | null) => {
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
        (m): m is THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial =>
          m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial,
      )
      for (const mat of mats) {
        // Keep the GLB material (morphs work automatically in Three r15x+).
        // Do NOT recreate MeshPhysicalMaterial with invalid morphTargets prop.
        mat.metalness = 0
        mat.roughness = Math.min(0.55, Math.max(0.32, mat.roughness || 0.42))
        mat.side = THREE.FrontSide
        if (map) {
          map.colorSpace = THREE.SRGBColorSpace
          map.flipY = false
          map.needsUpdate = true
          mat.map = map
        } else if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace
          mat.map.flipY = false
          mat.map.needsUpdate = true
        }
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.sheen = 0.18
          mat.sheenRoughness = 0.65
          mat.sheenColor?.set(0xffd8c4)
          mat.clearcoat = 0
          mat.clearcoatRoughness = 1
        }
        // Kill specular “wet metal” look on FLAME albedo
        mat.envMapIntensity = 0
        mat.needsUpdate = true
      }
    }

    const frameModel = (model: THREE.Object3D) => {
      // Blender Yup export leaves FLAME crown toward +Z; pitch so the face looks at the camera.
      model.rotation.x = -Math.PI / 2
      model.updateMatrixWorld(true)
      const box = new THREE.Box3().makeEmpty()
      model.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || !obj.visible) return
        if (!obj.morphTargetInfluences) return
        obj.geometry.computeBoundingBox()
        const geoBox = obj.geometry.boundingBox
        if (!geoBox) return
        const world = geoBox.clone().applyMatrix4(obj.matrixWorld)
        box.union(world)
      })
      if (box.isEmpty()) {
        box.setFromObject(model)
      }
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const targetH = 0.78
      const scale = targetH / Math.max(size.y, 0.001)
      model.scale.setScalar(scale)
      model.position.set(-center.x * scale, -center.y * scale + 0.02, -center.z * scale)
      baseCamZ = Math.max(1.0, targetH / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.2)
      camera.position.set(0, 0.04, baseCamZ)
      camera.lookAt(0, 0.04, 0)
    }

    new GLTFLoader().load(
      SPLATTING_ASSET.flameMeshUrl,
      (gltf) => {
        if (cancelled) return
        const model = gltf.scene
        model.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return
          if (/ico/i.test(obj.name) && !/flame/i.test(obj.name)) {
            obj.visible = false
            return
          }
          obj.frustumCulled = false
          if (obj.morphTargetInfluences && obj.morphTargetDictionary && !morphLinks) {
            boostJawMorphs(obj)
            morphLinks = mapMorphs(obj)
            const dict = obj.morphTargetDictionary
            if (typeof dict.Pose2 === 'number') pose2Index = dict.Pose2
            if (typeof dict.Pose3 === 'number') pose3Index = dict.Pose3
          }
          // Keep embedded GLB albedo — external PNG was blotching the cheeks/jaw
          tuneSkinMaterial(obj)
        })
        root.add(model)
        frameModel(model)
        readyRef.current?.()
      },
      undefined,
      () => {
        if (!cancelled) errorRef.current?.()
      },
    )

    api.current = {
      setPose: (next) => { pose = next },
      setListen: (on) => { listeningOn = on },
      setSpeak: (on) => { speakingOn = on },
    }

    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      const dt = Math.min(0.05, Math.max(0.001, t - lastT))
      lastT = t
      // Présence humaine : micro-mouvements tête, plus marqués en parole
      const liveSpeak = (speakingOn || speakingRef.current) && (
        Boolean(lipClockRef.current?.active) || localSpeakRef.current
      )
      root.rotation.y = Math.sin(t * 0.28) * (liveSpeak ? 0.022 : 0.03)
      root.rotation.x = liveSpeak ? Math.sin(t * 2.4) * 0.012 + jawSmooth * 0.018 : Math.sin(t * 0.5) * 0.004
      root.position.y = Math.sin(t * (liveSpeak ? 2.1 : 0.9)) * (liveSpeak ? 0.0035 : 0.004)
      if (morphLinks) {
        const drive = mouthDrivers(pose)
        const sync = lipClockRef.current
        const audioJaw = sync?.active ? (sync.audioLevel ?? 0) : 0
        const debugJaw = typeof window !== 'undefined'
          ? Number((window as unknown as { __atlasJaw?: number }).__atlasJaw)
          : 0
        const live = liveSpeak
        const closeGate = Math.min(1, drive.close)
        // Bilabiale / silence : fermeture nette (humain)
        const hardClose = closeGate > 0.55
        let targetJaw = Math.max(0, drive.jawOpen * (1 - closeGate * 0.9) + drive.lower * 0.12)
        if (hardClose) targetJaw = Math.min(targetJaw, 0.04)
        if (live && audioJaw > 0.05 && !hardClose) {
          targetJaw = Math.min(0.88, targetJaw * (0.88 + audioJaw * 0.2))
        }
        if (!live) targetJaw = 0
        if (Number.isFinite(debugJaw) && debugJaw > 0) targetJaw = Math.min(1, debugJaw)
        const targetSmile = live
          ? Math.max(restSmile * 0.35, drive.smile * 0.85 + drive.stretch * 0.2)
          : restSmile
        const targetPurse = live && !hardClose ? drive.purse : 0
        const targetFunnel = live && !hardClose ? drive.funnel : 0
        // Ouverture plus lente, fermeture plus rapide (comme une vraie mâchoire)
        const opening = targetJaw > jawSmooth
        const jawRate = hardClose ? 48 : opening ? 26 : 38
        jawSmooth += (targetJaw - jawSmooth) * (1 - Math.exp(-jawRate * dt))
        smileSmooth += (targetSmile - smileSmooth) * (1 - Math.exp(-22 * dt))
        // Arrondi (ou/oh) : un peu plus lent ; fermeture PP : snap
        const lipRate = hardClose ? 42 : 24
        purseSmooth += (targetPurse - purseSmooth) * (1 - Math.exp(-lipRate * dt))
        funnelSmooth += (targetFunnel - funnelSmooth) * (1 - Math.exp(-lipRate * dt))

        for (const link of morphLinks.links) {
          let raw = Number(drive[link.key as keyof typeof drive] ?? 0)
          if (link.key === 'jawOpen') raw = jawSmooth
          if (link.key === 'smile') raw = smileSmooth
          if (link.key === 'purse') raw = purseSmooth
          if (link.key === 'funnel') raw = funnelSmooth
          if (link.key === 'close') {
            raw = hardClose || jawSmooth < 0.12
              ? Math.max(hardClose ? 0.55 : 0.16, closeGate)
              : closeGate * 0.03
          }
          morphLinks.influences[link.index] = Math.min(1, Math.max(0, raw * link.scale))
        }
        if (pose2Index >= 0 && morphLinks.influences[pose2Index] !== undefined) {
          morphLinks.influences[pose2Index] = live ? funnelSmooth * 0.55 + jawSmooth * 0.1 : 0
        }
        if (pose3Index >= 0 && morphLinks.influences[pose3Index] !== undefined) {
          morphLinks.influences[pose3Index] = live ? purseSmooth * 0.72 + jawSmooth * 0.04 : 0
        }
      }
      camera.position.z = baseCamZ - (listeningOn ? 0.04 : 0) - (liveSpeak ? 0.025 : 0)
      renderer.render(scene, camera)
      raf = window.requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      if (!host.current) return
      const w = host.current.clientWidth
      const h = host.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      api.current = null
      renderer.dispose()
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    api.current?.setListen(listening)
    api.current?.setSpeak(speaking)
  }, [listening, speaking])

  useEffect(() => {
    if (!speaking) {
      localSpeakRef.current = false
      api.current?.setPose(poseFromWeights([]))
      return
    }
    // Horloge audio du Studio si elle tourne, sinon lecture locale du texte (mobile).
    const fallback = clip?.frames?.length
      ? clip
      : mayaAceClip(speech?.trim() || 'oui')
    const started = performance.now()
    let raf = 0
    const tick = () => {
      if (!speakingRef.current) return
      const clock = lipClockRef.current
      const active = (clock?.clip?.frames?.length ? clock.clip : fallback) as MayaAceClip
      if (clock?.active && active?.frames?.length) {
        localSpeakRef.current = false
        api.current?.setPose(sampleClipProgress(active, clock.progress, clock.char))
      } else if (active?.frames?.length) {
        localSpeakRef.current = true
        api.current?.setPose(sampleClip(active, (performance.now() - started) / 1000))
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => {
      localSpeakRef.current = false
      window.cancelAnimationFrame(raf)
    }
  }, [speaking, speech, clip])

  return (
    <span
      ref={host}
      className={`${styles.face} ${styles.hero} ${listening ? styles.listen : ''} ${speaking ? styles.live : ''}`}
      title={label}
      aria-label={label}
      data-avatar-motion="audio2face-arkit"
      data-avatar-look="flame-glb"
    />
  )
}

export async function flameGlbAvailable(): Promise<boolean> {
  try {
    const response = await fetch(SPLATTING_ASSET.flameMeshUrl, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}
