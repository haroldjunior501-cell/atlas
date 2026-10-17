/**
 * Atlas avatar stack = two collaborative layers (not competing tech):
 *
 *   Motion  → NVIDIA Audio2Face / Maya-ACE  → ARKit blendshapes
 *   Look    → SplattingAvatar (mesh + embedded 3D Gaussians)
 *
 * Audio → A2F → blendshape weights[] → deform FLAME/mesh → SplattingAvatar render.
 * Browser interim: same ARKit weights drive a WebGL talking head until a trained
 * SplattingAvatar asset is published under /avatars/atlas.splat (+ FLAME topology).
 *
 * Official SplattingAvatar: https://github.com/initialneil/SplattingAvatar (CVPR 2024)
 * Maya-ACE / A2F-3D NIM: local GPU inference or cloud gRPC → ARKit channels.
 */
import {
  ARKIT_BLENDSHAPES,
  mayaAceClip,
  sampleVisemeProgress,
  type MayaAceClip,
} from '@atlas/voice'

export const AVATAR_LAYERS = {
  motion: 'audio2face-arkit',
  appearance: 'splatting-avatar',
  interimRenderer: 'webgl-arkit-head',
} as const

export type ArkitPose = Record<(typeof ARKIT_BLENDSHAPES)[number], number>

export function emptyArkitPose(): ArkitPose {
  return Object.fromEntries(ARKIT_BLENDSHAPES.map((name) => [name, 0])) as ArkitPose
}

export function poseFromWeights(weights: readonly number[]): ArkitPose {
  const pose = emptyArkitPose()
  for (let index = 0; index < ARKIT_BLENDSHAPES.length; index += 1) {
    const name = ARKIT_BLENDSHAPES[index]
    if (!name) continue
    pose[name] = weights[index] ?? 0
  }
  return pose
}

/** Compact mouth drivers used by the interim WebGL head (subset of ARKit). */
export function mouthDrivers(pose: ArkitPose) {
  return {
    jawOpen: pose.JawOpen,
    smile: (pose.MouthSmileLeft + pose.MouthSmileRight) / 2,
    purse: Math.max(pose.MouthPucker, pose.MouthFunnel * 0.55),
    funnel: pose.MouthFunnel,
    close: Math.max(pose.MouthClose, (pose.MouthPressLeft + pose.MouthPressRight) * 0.45),
    stretch: (pose.MouthStretchLeft + pose.MouthStretchRight) / 2,
    lower: (pose.MouthLowerDownLeft + pose.MouthLowerDownRight) / 2,
    blinkL: pose.EyeBlinkLeft,
    blinkR: pose.EyeBlinkRight,
    browUp: pose.BrowInnerUp,
  }
}

/**
 * Rough ARKit → FLAME expression vector (50 coeffs) for SplattingAvatar mesh driving.
 * Real Maya-ACE ↔ FLAME mapping should replace this once the trained avatar is wired.
 */
export function arkitToFlameExpression(pose: ArkitPose, size = 50): number[] {
  const out = Array.from({ length: size }, () => 0)
  out[0] = pose.JawOpen
  out[1] = pose.MouthSmileLeft
  out[2] = pose.MouthSmileRight
  out[3] = pose.MouthPucker
  out[4] = pose.MouthFunnel
  out[5] = pose.BrowInnerUp
  out[6] = pose.BrowDownLeft
  out[7] = pose.BrowDownRight
  out[8] = pose.EyeBlinkLeft
  out[9] = pose.EyeBlinkRight
  out[10] = pose.CheekPuff
  return out
}

export function clipForSpeech(text: string, voiceId = 'Atlas'): MayaAceClip {
  return mayaAceClip(text, voiceId)
}

export function sampleClip(clip: MayaAceClip, elapsedSec: number): ArkitPose {
  if (!clip.frames.length) return emptyArkitPose()
  const index = Math.min(
    clip.frames.length - 1,
    Math.max(0, Math.floor(elapsedSec * clip.fps)),
  )
  return poseFromWeights(clip.frames[index] ?? [])
}

/** Prefer this when TTS/audio reports progress — mouth matches what is being said. */
export function sampleClipProgress(clip: MayaAceClip, progress: number, char = -1): ArkitPose {
  return poseFromWeights(sampleVisemeProgress(clip, progress, char))
}

export const SPLATTING_ASSET = {
  /**
   * Trained SplattingAvatar / 3DGS export.
   * AceFace loads this first when present (see splat-avatar.tsx).
   * Train on CUDA: tools/avatar/scripts/train_splatting_avatar.ps1
   * Manual copy: tools/avatar/scripts/export_atlas_splat.ps1 -Source path\to\point_cloud.ply
   */
  splatUrl: '/avatars/atlas.splat',
  flameMeshUrl: '/avatars/atlas-flame.glb',
  /** AlbedoMM mean diffuse (also embedded in atlas-flame.glb). */
  flameAlbedoUrl: '/avatars/atlas-flame-albedo.png',
  /** Target look reference (portrait) kept for offline training / style. */
  targetPortraitUrl: '/avatars/atlas-target.png',
  source: 'https://github.com/initialneil/SplattingAvatar',
  /** Corps photoréaliste (ExAvatar ECCV 2024) — export .splat / SMPL-X par agent. */
  exAvatar: {
    paper: 'https://github.com/eclipse0922/ExAvatar',
    /** Pattern : /avatars/ex/{agentId}.splat une fois scanné. */
    urlFor: (agentId: string) => `/avatars/ex/${agentId}.splat`,
  },
  /** Gestes + lèvres depuis audio (PantoMatrix / EMAGE). */
  pantoMatrix: {
    paper: 'https://github.com/hcynomo/PantoMatrix',
    endpointEnv: 'ATLAS_PANTOMATRIX_URL',
  },
  /** Locomotion physique SMPL-X (PRIMAL ICCV 2025). */
  primal: {
    paper: 'https://github.com/yz-cnsdqz/PRIMAL',
    endpointEnv: 'ATLAS_PRIMAL_URL',
  },
} as const
