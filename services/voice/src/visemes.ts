/** Audio2Face / Maya-ACE viseme names used to drive a talking face from speech. */

export const A2F_VISEMES = [
  'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'ih', 'oh', 'ou',
] as const

export type A2fViseme = (typeof A2F_VISEMES)[number]

export const ARKIT_BLENDSHAPES = [
  'EyeBlinkLeft', 'EyeLookDownLeft', 'EyeLookInLeft', 'EyeLookOutLeft', 'EyeLookUpLeft', 'EyeSquintLeft', 'EyeWideLeft',
  'EyeBlinkRight', 'EyeLookDownRight', 'EyeLookInRight', 'EyeLookOutRight', 'EyeLookUpRight', 'EyeSquintRight', 'EyeWideRight',
  'JawForward', 'JawLeft', 'JawRight', 'JawOpen',
  'MouthClose', 'MouthFunnel', 'MouthPucker', 'MouthLeft', 'MouthRight',
  'MouthSmileLeft', 'MouthSmileRight', 'MouthFrownLeft', 'MouthFrownRight',
  'MouthDimpleLeft', 'MouthDimpleRight', 'MouthStretchLeft', 'MouthStretchRight',
  'MouthRollLower', 'MouthRollUpper', 'MouthShrugLower', 'MouthShrugUpper',
  'MouthPressLeft', 'MouthPressRight', 'MouthLowerDownLeft', 'MouthLowerDownRight',
  'MouthUpperUpLeft', 'MouthUpperUpRight',
  'BrowDownLeft', 'BrowDownRight', 'BrowInnerUp', 'BrowOuterUpLeft', 'BrowOuterUpRight',
  'CheekPuff', 'CheekSquintLeft', 'CheekSquintRight',
  'NoseSneerLeft', 'NoseSneerRight', 'TongueOut',
] as const

/** Longest-first French digraphs / letters → A2F viseme (mouth shape, not IPA). */
const DIGRAPHS: Array<[string, A2fViseme]> = [
  ['tion', 'ih'],
  ['sion', 'ih'],
  ['eau', 'oh'],
  ['oeu', 'ou'],
  ['œu', 'ou'],
  ['ain', 'E'],
  ['ein', 'E'],
  ['ill', 'ih'],
  ['ch', 'CH'],
  ['ou', 'ou'],
  ['oi', 'oh'],
  ['on', 'oh'],
  ['om', 'oh'],
  ['an', 'aa'],
  ['am', 'aa'],
  ['en', 'aa'],
  ['em', 'aa'],
  ['in', 'E'],
  ['im', 'E'],
  ['un', 'ou'],
  ['um', 'ou'],
  ['au', 'oh'],
  ['eu', 'ou'],
  ['ai', 'E'],
  ['ei', 'E'],
  ['èe', 'E'],
  ['gn', 'nn'],
  ['qu', 'kk'],
  ['gu', 'kk'],
  ['ph', 'FF'],
  ['th', 'TH'],
]

const LETTER: Record<string, A2fViseme> = {
  a: 'aa', à: 'aa', â: 'aa', ä: 'aa',
  e: 'E', é: 'E', è: 'E', ê: 'E', ë: 'E',
  i: 'ih', î: 'ih', ï: 'ih', y: 'ih',
  o: 'oh', ô: 'oh', ö: 'oh',
  u: 'ou', ù: 'ou', û: 'ou', ü: 'ou',
  p: 'PP', b: 'PP', m: 'PP',
  f: 'FF', v: 'FF',
  t: 'TH', d: 'DD',
  n: 'nn', l: 'nn',
  k: 'kk', g: 'kk', q: 'kk', c: 'kk',
  s: 'SS', z: 'SS', x: 'SS',
  j: 'CH',
  r: 'RR',
  w: 'ou',
  h: 'sil',
}

/**
 * Poses humaines : contrastes clairs, jamais une mâchoire bloquée ouverte.
 * Bilabiales fermées nettes ; voyelles ouvertes / arrondies / étirées distinctes.
 */
const VISEME_TO_ARKIT: Record<A2fViseme, Partial<Record<(typeof ARKIT_BLENDSHAPES)[number], number>>> = {
  sil: {
    MouthClose: 0.55,
    JawOpen: 0.02,
    MouthSmileLeft: 0.06,
    MouthSmileRight: 0.05,
  },
  PP: {
    MouthClose: 0.95,
    MouthPressLeft: 0.35,
    MouthPressRight: 0.35,
    MouthPucker: 0.08,
    JawOpen: 0.0,
  },
  FF: {
    MouthFunnel: 0.28,
    JawOpen: 0.12,
    MouthClose: 0.22,
    MouthUpperUpLeft: 0.32,
    MouthUpperUpRight: 0.3,
    MouthLowerDownLeft: 0.12,
    MouthLowerDownRight: 0.12,
  },
  TH: {
    JawOpen: 0.2,
    TongueOut: 0.28,
    MouthClose: 0.04,
    MouthStretchLeft: 0.12,
    MouthStretchRight: 0.1,
  },
  DD: {
    JawOpen: 0.22,
    MouthClose: 0.1,
    MouthLowerDownLeft: 0.18,
    MouthLowerDownRight: 0.16,
  },
  kk: {
    JawOpen: 0.18,
    MouthSmileLeft: 0.12,
    MouthSmileRight: 0.1,
    MouthClose: 0.08,
  },
  CH: {
    MouthFunnel: 0.52,
    MouthPucker: 0.28,
    JawOpen: 0.2,
    CheekSquintLeft: 0.1,
    CheekSquintRight: 0.1,
  },
  SS: {
    MouthSmileLeft: 0.52,
    MouthSmileRight: 0.5,
    MouthStretchLeft: 0.28,
    MouthStretchRight: 0.26,
    JawOpen: 0.08,
    MouthClose: 0.14,
  },
  nn: {
    JawOpen: 0.1,
    MouthClose: 0.38,
    MouthPressLeft: 0.12,
    MouthPressRight: 0.1,
  },
  RR: {
    JawForward: 0.16,
    JawOpen: 0.22,
    MouthFunnel: 0.12,
  },
  aa: {
    JawOpen: 0.68,
    MouthLowerDownLeft: 0.35,
    MouthLowerDownRight: 0.32,
    MouthClose: 0,
    MouthSmileLeft: 0.08,
    MouthSmileRight: 0.06,
  },
  E: {
    JawOpen: 0.36,
    MouthSmileLeft: 0.42,
    MouthSmileRight: 0.4,
    MouthStretchLeft: 0.22,
    MouthStretchRight: 0.2,
    MouthClose: 0,
  },
  ih: {
    JawOpen: 0.2,
    MouthSmileLeft: 0.58,
    MouthSmileRight: 0.55,
    MouthStretchLeft: 0.3,
    MouthStretchRight: 0.28,
    MouthClose: 0,
  },
  oh: {
    JawOpen: 0.4,
    MouthFunnel: 0.68,
    MouthPucker: 0.22,
    CheekPuff: 0.08,
    MouthClose: 0,
  },
  ou: {
    MouthPucker: 0.88,
    MouthFunnel: 0.42,
    JawOpen: 0.1,
    MouthClose: 0.08,
    MouthRollUpper: 0.12,
    MouthRollLower: 0.1,
  },
}

export interface VisemeFrame {
  t: number
  viseme: A2fViseme
  /** Character index in the source text this frame belongs to (for lip-sync). */
  charIndex: number
  weights: number[]
}

export interface MayaAceClip {
  version: 1
  player: 'maya-ace-a2f'
  source: 'atlas'
  fps: number
  durationMs: number
  text: string
  voiceId: string
  blendshapes: readonly string[]
  frames: number[][]
  visemes: VisemeFrame[]
}

const VOWELS = new Set<A2fViseme>(['aa', 'E', 'ih', 'oh', 'ou'])
const CLOSURES = new Set<A2fViseme>(['PP', 'sil', 'nn'])

function blendWeights(a: number[], b: number[], mix: number): number[] {
  const m = Math.min(1, Math.max(0, mix))
  return a.map((value, index) => value * (1 - m) + (b[index] ?? 0) * m)
}

/** Soft ease for coarticulation (human mouths don't snap linearly). */
function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Tokenize French text into visemes, preserving source character indices. */
export function tokenizeVisemes(text: string): Array<{ viseme: A2fViseme; charIndex: number }> {
  const spoken = text.normalize('NFC')
  const out: Array<{ viseme: A2fViseme; charIndex: number }> = []
  let i = 0
  while (i < spoken.length) {
    const ch = spoken[i]!
    if (/\s/.test(ch)) {
      out.push({ viseme: 'sil', charIndex: i })
      i += 1
      continue
    }
    if (!/[\p{L}]/u.test(ch)) {
      out.push({ viseme: 'sil', charIndex: i })
      i += 1
      continue
    }
    const rest = spoken.slice(i).toLowerCase()
    let matched = false
    for (const [glyph, viseme] of DIGRAPHS) {
      if (rest.startsWith(glyph)) {
        for (let k = 0; k < glyph.length; k += 1) {
          out.push({ viseme, charIndex: i + k })
        }
        i += glyph.length
        matched = true
        break
      }
    }
    if (matched) continue
    out.push({ viseme: LETTER[ch.toLowerCase()] ?? 'sil', charIndex: i })
    i += 1
  }
  return out
}

function holdFor(viseme: A2fViseme, prev: A2fViseme | null, next: A2fViseme | null): number {
  if (viseme === 'sil') return prev && VOWELS.has(prev) ? 3 : 2
  if (viseme === 'PP') return 2
  if (VOWELS.has(viseme)) {
    // Voyelle en fin de mot / avant silence : un peu plus longue
    if (next === 'sil' || !next) return 4
    return 3
  }
  // Consonne entre deux voyelles : plus courte (transition)
  if (prev && VOWELS.has(prev) && next && VOWELS.has(next)) return 1
  return 2
}

/**
 * Coarticulation humaine : mélange prev → current → next.
 * Les lèvres anticipent la voyelle suivante pendant la consonne.
 */
function coarticulate(
  prev: A2fViseme | null,
  current: A2fViseme,
  next: A2fViseme | null,
  phase: number,
  time: number,
): number[] {
  const cur = arkitWeights(current, time)
  const prv = prev ? arkitWeights(prev, time) : cur
  const nxt = next ? arkitWeights(next, time) : cur
  const p = smoothstep(phase)

  // Début du phonème : encore un peu du précédent
  // Fin : anticipation du suivant (surtout voyelle après consonne)
  let fromPrev = blendWeights(prv, cur, Math.min(1, 0.55 + p * 0.45))
  const anticipate = next && VOWELS.has(next) && !VOWELS.has(current) ? 0.55 : 0.38
  let weights = blendWeights(fromPrev, nxt, p * anticipate)

  // Bilabiale : fermeture dure au milieu, relâchement ensuite
  if (current === 'PP') {
    const shut = p < 0.45 ? arkitWeights('PP', time) : blendWeights(arkitWeights('PP', time), nxt, (p - 0.45) / 0.55)
    weights = shut
  }

  // Micro-asymétrie naturelle (pas un robot parfaitement symétrique)
  const jitter = Math.sin(time * 17.3) * 0.012
  const jawIdx = ARKIT_BLENDSHAPES.indexOf('JawOpen')
  const smileL = ARKIT_BLENDSHAPES.indexOf('MouthSmileLeft')
  const smileR = ARKIT_BLENDSHAPES.indexOf('MouthSmileRight')
  if (jawIdx >= 0) weights[jawIdx] = Math.max(0, Math.min(1, (weights[jawIdx] ?? 0) + jitter * 0.4))
  if (smileL >= 0) weights[smileL] = Math.max(0, Math.min(1, (weights[smileL] ?? 0) + jitter))
  if (smileR >= 0) weights[smileR] = Math.max(0, Math.min(1, (weights[smileR] ?? 0) - jitter * 0.7))

  return weights
}

export function visemesFromSpeech(text: string, fps = 30): VisemeFrame[] {
  const spoken = text.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!spoken) {
    return [{ t: 0, viseme: 'sil', charIndex: 0, weights: Array(ARKIT_BLENDSHAPES.length).fill(0) }]
  }
  const frames: VisemeFrame[] = []
  let t = 0
  const step = 1 / fps
  const sequence = tokenizeVisemes(spoken)
  for (let i = 0; i < sequence.length; i += 1) {
    const { viseme, charIndex } = sequence[i]!
    const prev = i > 0 ? sequence[i - 1]!.viseme : null
    const next = sequence[i + 1]?.viseme ?? 'sil'
    const holdFrames = holdFor(viseme, prev, next)
    for (let f = 0; f < holdFrames; f += 1) {
      const phase = holdFrames <= 1 ? 0.5 : f / (holdFrames - 1)
      const weights = coarticulate(prev, viseme, next, phase, t)
      frames.push({ t: Number(t.toFixed(4)), viseme, charIndex, weights })
      t += step
    }
  }
  // Relâchement final progressif (humain : ne coupe pas net)
  const lastChar = Math.max(0, spoken.length - 1)
  const rest = arkitWeights('sil', t)
  for (let f = 0; f < 4; f += 1) {
    const last = frames.at(-1)?.weights ?? rest
    frames.push({
      t: Number(t.toFixed(4)),
      viseme: 'sil',
      charIndex: lastChar,
      weights: blendWeights(last, rest, (f + 1) / 4),
    })
    t += step
  }
  return frames
}

export function arkitWeights(viseme: A2fViseme, time = 0): number[] {
  const pose = VISEME_TO_ARKIT[viseme] ?? {}
  // Clignement occasionnel, pas un métronome
  const blink = time > 0.4 && Math.floor(time * 2.1 + Math.sin(time * 0.7) * 3) % 23 === 0 ? 0.75 : 0
  return ARKIT_BLENDSHAPES.map((name) => {
    if (name === 'EyeBlinkLeft' || name === 'EyeBlinkRight') return blink
    return pose[name] ?? 0
  })
}

export function mayaAceClip(text: string, voiceId = 'Atlas'): MayaAceClip {
  const visemes = visemesFromSpeech(text)
  const fps = 30
  return {
    version: 1,
    player: 'maya-ace-a2f',
    source: 'atlas',
    fps,
    durationMs: Math.round((visemes.at(-1)?.t ?? 0) * 1000),
    text,
    voiceId,
    blendshapes: ARKIT_BLENDSHAPES,
    frames: visemes.map((frame) => frame.weights),
    visemes,
  }
}

/**
 * Sample clip by spoken progress (0…1) and optional fractional character cursor.
 * Prefers character mapping (TTS boundaries) and lerps between frames.
 */
export function sampleVisemeProgress(clip: MayaAceClip, progress: number, char = -1): number[] {
  if (!clip.frames.length) return Array(ARKIT_BLENDSHAPES.length).fill(0)
  const p = Math.min(1, Math.max(0, progress))
  const hasCharMap = Boolean(clip.visemes?.length && typeof clip.visemes[0]?.charIndex === 'number')

  if (hasCharMap && clip.visemes) {
    const target = char >= 0
      ? char
      : p * Math.max(1, (clip.text?.length ?? clip.visemes.length) - 0.001)
    return sampleByChar(clip, target)
  }

  const f = p * (clip.frames.length - 1)
  const i0 = Math.floor(f)
  const i1 = Math.min(clip.frames.length - 1, i0 + 1)
  return blendWeights(clip.frames[i0]!, clip.frames[i1]!, smoothstep(f - i0))
}

function sampleByChar(clip: MayaAceClip, targetChar: number): number[] {
  const visemes = clip.visemes!
  let lo = 0
  let hi = visemes.length - 1
  let i0 = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((visemes[mid]?.charIndex ?? 0) <= targetChar) {
      i0 = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  // Fenêtre de coarticulation : mélange sur ~0.85 caractère vers le suivant
  let i1 = Math.min(visemes.length - 1, i0 + 1)
  const c0 = visemes[i0]?.charIndex ?? 0
  while (i1 < visemes.length - 1 && (visemes[i1]?.charIndex ?? 0) <= c0) {
    i1 += 1
  }
  const c1 = visemes[i1]?.charIndex ?? c0 + 1
  const span = Math.max(0.001, c1 - c0)
  const rawMix = i0 === i1 ? 0 : Math.min(1, Math.max(0, (targetChar - c0) / span))
  // Smoothstep = transition de lèvres plus organique
  return blendWeights(clip.frames[i0]!, clip.frames[i1]!, smoothstep(rawMix))
}

/** True if this viseme is a hard lip closure (for avatar snap). */
export function isClosureViseme(viseme: A2fViseme): boolean {
  return CLOSURES.has(viseme)
}

export const VOICE_PIPELINE = ['listen', 'think', 'speak'] as const
