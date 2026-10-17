/**
 * Mutable lip-sync clock — updated every animation frame from TTS/audio,
 * read by the avatar without React setState (avoids 1–2 frame lag).
 */
export type LipSyncClip = {
  frames: number[][]
  visemes?: Array<{ charIndex: number; weights?: number[] }>
  text?: string
  durationMs?: number
  fps?: number
}

export type LipSyncClock = {
  active: boolean
  /** 0…1 through the utterance */
  progress: number
  /** Fractional character cursor into spoken text (may include anticipation lead) */
  char: number
  textLength: number
  /**
   * Instantaneous mouth aperture from audio energy (0…1).
   * Attack ~30ms / release ~70ms applied by the writer.
   */
  audioLevel: number
  /** Current chunk text — matches TTS utterance */
  text: string
  /** Clip for this chunk — avatar reads via ref, no React lag */
  clip: LipSyncClip | null
}

export function createLipSyncClock(): LipSyncClock {
  return {
    active: false,
    progress: 0,
    char: 0,
    textLength: 1,
    audioLevel: 0,
    text: '',
    clip: null,
  }
}

export function resetLipSyncClock(clock: LipSyncClock, textLength = 1, text = '', clip: LipSyncClip | null = null) {
  clock.active = true
  clock.progress = 0
  clock.char = 0
  clock.textLength = Math.max(1, textLength)
  clock.audioLevel = 0
  clock.text = text
  clock.clip = clip
}

export function stopLipSyncClock(clock: LipSyncClock) {
  clock.active = false
  clock.progress = 0
  clock.char = 0
  clock.audioLevel = 0
  clock.text = ''
  clock.clip = null
}

export function setLipSyncProgress(clock: LipSyncClock, progress: number, char = -1) {
  const p = Math.min(1, Math.max(0, progress))
  clock.progress = p
  clock.char = char >= 0 ? char : p * clock.textLength
  clock.active = true
}

/** Smooth audio envelope into the clock (call every frame or from Analyser). */
export function setLipSyncAudioLevel(clock: LipSyncClock, raw: number, dtSec = 0.016) {
  const target = Math.min(1, Math.max(0, raw))
  const opening = target > clock.audioLevel
  // Snappier than before — less lag behind the TTS cursor
  const tau = opening ? 0.028 : 0.07
  const ease = 1 - Math.exp(-dtSec / Math.max(0.001, tau))
  clock.audioLevel += (target - clock.audioLevel) * ease
  if (clock.audioLevel > 0.01) clock.active = true
}

/** End index (exclusive) of the word starting at `from`. */
export function wordEndIndex(text: string, from: number): number {
  const start = Math.max(0, Math.min(text.length, from))
  let i = start
  while (i < text.length && /[\s.,!?;:…'"«»()[\]]/.test(text[i]!)) i += 1
  const wordStart = i
  while (i < text.length && !/[\s.,!?;:…'"«»()[\]]/.test(text[i]!)) i += 1
  return Math.max(wordStart + 1, i)
}
