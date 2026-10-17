import { NextResponse } from 'next/server'
import { mayaAceClip } from '@atlas/voice'
import type { AvatarMotionEvent } from '@/lib/office-hyper'

/**
 * Stub PantoMatrix / PRIMAL : renvoie un clip motion navigateur.
 * Si ATLAS_PANTOMATRIX_URL est défini, on délègue au microservice GPU.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    agentId?: string
    event?: AvatarMotionEvent
    speech?: string
    durationSec?: number
  }
  const agentId = String(body.agentId || 'agent')
  const event = (body.event || 'talking') as AvatarMotionEvent
  const speech = String(body.speech || 'Bonjour, Atlas travaille.')
  const durationSec = Math.min(12, Math.max(0.6, Number(body.durationSec) || 3))

  const remote = process.env.ATLAS_PANTOMATRIX_URL?.trim()
  if (remote) {
    try {
      const upstream = await fetch(`${remote.replace(/\/$/, '')}/motion`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId, event, speech, durationSec }),
      })
      if (upstream.ok) {
        const data = await upstream.json()
        return NextResponse.json(data)
      }
    } catch {
      /* fallback local */
    }
  }

  const clip = mayaAceClip(speech, 'Atlas')
  const fps = clip.fps || 30
  const frames = Math.max(1, Math.round(durationSec * fps))
  const face = Array.from({ length: frames }, (_, i) => {
    const src = clip.frames[Math.min(clip.frames.length - 1, Math.floor((i / frames) * clip.frames.length))] ?? []
    return [...src]
  })

  // Corps simplifié (épaule / tête) — remplacé par SMPL-X via PRIMAL en prod GPU
  const bodyJoints = Array.from({ length: frames }, (_, i) => {
    const t = i / fps
    const amp = event === 'typing' ? 0.04 : event === 'talking' ? 0.06 : event === 'walking' ? 0.12 : 0.02
    return [
      Math.sin(t * (event === 'typing' ? 10 : 3)) * amp, // shoulder L
      Math.sin(t * (event === 'typing' ? 10 : 3) + 0.4) * amp, // shoulder R
      Math.sin(t * 2.2) * (event === 'talking' ? 0.03 : 0.01), // head yaw
      event === 'raise_hand' ? Math.min(1, t * 0.8) : 0,
    ]
  })

  return NextResponse.json({
    agentId,
    event,
    fps,
    durationSec,
    face,
    body: bodyJoints,
    source: remote ? 'pantomatrix-fallback' : 'atlas-local',
    engines: {
      face: 'maya-ace-arkit',
      body: process.env.ATLAS_PRIMAL_URL ? 'primal-pending' : 'procedural',
    },
  })
}
