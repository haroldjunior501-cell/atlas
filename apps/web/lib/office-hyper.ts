/**
 * Couche « hyper-réaliste » du bureau ATLAS.
 *
 * Runtime navigateur :
 *   1. generateLayout(org) → grammaire spatiale
 *   2. GaussianSplats3D DropInViewer → /office/pilot.ksplat
 *   3. atlas.glb + portraits → agents photoréalistes
 *   4. /api/atlas/avatar-motion → gestes (PantoMatrix stub / Maya-ACE)
 *   5. WebXR optionnel
 */
export const OFFICE_HYPER = {
  quality: 'hyper' as const,
  /** Environnement 3DGS (ksplat compressé, prêt navigateur). */
  splatEnvironmentUrl: '/office/pilot.ksplat',
  splatEnvironmentFallbacks: ['/office/pilot.splat', '/office/pilot.ply', '/avatars/atlas-env.ksplat'],
  splatAvatarUrl: '/avatars/atlas.splat',
  flameMeshUrl: '/avatars/atlas-flame.glb',
  bodyMeshUrl: '/avatars/atlas.glb',
  refs: {
    gaussianSplats3D: 'https://github.com/mkkellogg/GaussianSplats3D',
    exAvatar: 'https://github.com/eclipse0922/ExAvatar',
    pantoMatrix: 'https://github.com/hcynomo/PantoMatrix',
    primal: 'https://github.com/yz-cnsdqz/PRIMAL',
    webxr: 'https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession',
  },
} as const

export type AvatarMotionEvent =
  | 'idle'
  | 'typing'
  | 'talking'
  | 'walking'
  | 'meeting'
  | 'phone'
  | 'raise_hand'
  | 'error'

/** Contrat pour un backend PantoMatrix / PRIMAL (GPU). */
export interface AvatarMotionClip {
  agentId: string
  event: AvatarMotionEvent
  fps: number
  face?: number[][]
  body?: number[][]
  durationSec: number
  source?: string
}

export async function resolveOfficeSplatUrl(): Promise<string | null> {
  const candidates = [OFFICE_HYPER.splatEnvironmentUrl, ...OFFICE_HYPER.splatEnvironmentFallbacks]
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) return url
    } catch {
      /* try next */
    }
  }
  return null
}

export async function probeOfficeSplat(): Promise<boolean> {
  return Boolean(await resolveOfficeSplatUrl())
}

export async function fetchAvatarMotion(input: {
  agentId: string
  event?: AvatarMotionEvent
  speech?: string
  durationSec?: number
}): Promise<AvatarMotionClip | null> {
  try {
    const res = await fetch('/api/atlas/avatar-motion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) return null
    return await res.json() as AvatarMotionClip
  } catch {
    return null
  }
}

/** Demande une session WebXR immersive si le device le permet. */
export async function requestOfficeXrSession(
  mode: 'immersive-vr' | 'immersive-ar' = 'immersive-vr',
): Promise<XRSession | null> {
  if (typeof navigator === 'undefined' || !navigator.xr) return null
  const ok = await navigator.xr.isSessionSupported(mode).catch(() => false)
  if (!ok) return null
  return navigator.xr.requestSession(mode, {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['bounded-floor', 'hand-tracking'],
  })
}
