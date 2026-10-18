import { speechLang } from '@atlas/domain'
import * as Speech from 'expo-speech'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let catalog: Promise<Speech.Voice[] | null> | null = null

/** Même ranking que le bureau web : voix féminine naturelle d’abord. */
function scoreVoice(voice: { name?: string; identifier?: string; language?: string; quality?: string }) {
  const name = `${voice.name || ''} ${voice.identifier || ''}`.toLowerCase()
  const quality = String(voice.quality || '')
  let score = 0
  if (quality === 'Enhanced' || /enhanced|premium|neural|natural|online/.test(`${quality} ${name}`)) score += 10
  if (/hortense|denise|sylvie|louise|julie|audrey|aria|jenny|marie|amelie|amélie|thomasine|female|femme|woman/.test(name)) score += 12
  if (/henri|thomas|daniel|male|homme|man|pascal/.test(name)) score -= 8
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

/** Coupe comme le Studio : une phrase à la fois pour la fluidité. */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  const parts = cleaned.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [cleaned]
  return parts.map((part) => part.trim()).filter(Boolean)
}

/** Atlas parle à voix haute (voix féminine) et signale le mot en cours (lèvres). */
export async function speakAtlas(text: string, onCursor?: (cursor: SpeechCursor) => void) {
  const line = String(text || '').trim()
  if (!line) return
  const sentences = splitSentences(line)
  let offset = 0
  try {
    const lang = speechLang(line)
    const voice = await voiceFor(lang)
    for (const sentence of sentences) {
      const busy = typeof Speech.isSpeakingAsync === 'function'
        ? await Speech.isSpeakingAsync().catch(() => false)
        : false
      if (busy) {
        Speech.stop()
        await wait(120)
      }
      await new Promise<void>((resolve) => {
        let settled = false
        const finish = (speaking: boolean) => {
          if (settled) return
          settled = true
          onCursor?.({ char: offset + sentence.length, speaking })
          resolve()
        }
        const cap = setTimeout(() => finish(false), Math.min(22000, 700 + sentence.length * 70))
        Speech.speak(sentence, {
          language: lang,
          voice,
          pitch: 1.02,
          rate: 0.94,
          onStart: () => onCursor?.({ char: offset, speaking: true }),
          onBoundary: (event: { charIndex?: number }) => {
            const char = typeof event?.charIndex === 'number' ? event.charIndex : 0
            onCursor?.({ char: offset + char, speaking: true })
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
      offset += sentence.length + 1
    }
  } catch {
    onCursor?.({ char: 0, speaking: false })
  }
}

export function stopAtlasSpeech() {
  try {
    Speech.stop()
  } catch { /* ignore */ }
}
