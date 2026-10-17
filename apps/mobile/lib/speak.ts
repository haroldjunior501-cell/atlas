import { speechLang } from '@atlas/domain'
import * as Speech from 'expo-speech'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let catalog: Promise<Speech.Voice[] | null> | null = null

function scoreVoice(voice: { name?: string; identifier?: string; language?: string; quality?: string }) {
  const name = `${voice.name || ''} ${voice.identifier || ''}`.toLowerCase()
  const quality = String(voice.quality || '')
  let score = 0
  if (quality === 'Enhanced' || /enhanced|premium|neural/.test(`${quality} ${name}`)) score += 8
  if (/compact/.test(name)) score -= 4
  return score
}

async function voiceFor(lang: string) {
  if (!catalog) {
    catalog = Speech.getAvailableVoicesAsync().catch(() => null)
  }
  const voices = await catalog
  if (!voices) return undefined
  const prefix = lang.slice(0, 2).toLowerCase()
  const pool = voices
    .filter((voice) => (voice.language || '').toLowerCase().startsWith(prefix))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))
  return pool[0]?.identifier
}

export type SpeechCursor = { char: number; speaking: boolean }

/** Atlas parle la réponse à voix haute et signale le mot en cours (lèvres). */
export async function speakAtlas(text: string, onCursor?: (cursor: SpeechCursor) => void) {
  const line = String(text || '').trim()
  if (!line) return
  try {
    const lang = speechLang(line)
    const voice = await voiceFor(lang)
    const busy = typeof Speech.isSpeakingAsync === 'function'
      ? await Speech.isSpeakingAsync().catch(() => false)
      : false
    if (busy) {
      Speech.stop()
      // Sur iOS, stop() collé à speak() annule l'énoncé qui vient d'être lancé.
      await wait(160)
    }
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = (speaking: boolean) => {
        if (settled) return
        settled = true
        onCursor?.({ char: line.length, speaking })
        resolve()
      }
      const cap = setTimeout(() => finish(false), Math.min(28000, 900 + line.length * 75))
      Speech.speak(line, {
        language: lang,
        voice,
        pitch: 1,
        rate: 0.94,
        onStart: () => onCursor?.({ char: 0, speaking: true }),
        onBoundary: (event: { charIndex?: number }) => {
          const char = typeof event?.charIndex === 'number' ? event.charIndex : 0
          onCursor?.({ char, speaking: true })
        },
        onDone: () => {
          clearTimeout(cap)
          finish(false)
        },
        onStopped: () => {
          clearTimeout(cap)
          finish(false)
        },
        onError: () => {
          clearTimeout(cap)
          finish(false)
        },
      })
    })
  } catch {
    onCursor?.({ char: 0, speaking: false })
  }
}

export function stopAtlasSpeech() {
  try {
    Speech.stop()
  } catch { /* ignore */ }
}
