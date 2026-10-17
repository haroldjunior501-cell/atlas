export const VOICE_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b'
export const PLANNER_MODEL = 'nvidia/nemotron-3-super-120b-a12b'
export const NEMOTRON_MODELS = [PLANNER_MODEL, VOICE_MODEL]
export const SAFETY_MODEL = 'nvidia/nemotron-3.5-content-safety'
export const TRANSLATE_MODEL = 'nvidia/riva-translate-4b-instruct-v2'
export const EMBED_MODEL = 'nvidia/nemotron-3-embed-1b'

const LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English',
  'ru-RU': 'Russian',
  ar: 'Arabic',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'zh-CN': 'Chinese',
  'fr-FR': 'French',
}

export function unsafeVerdict(text: string): boolean {
  return /\bunsafe\b/i.test(text)
}

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? 'English'
}

export function translateInstruction(language: string, text: string): string {
  return `Translate to ${language}. Output only the translation.\n${text}`
}

export function rankBySimilarity(question: number[], labeled: Array<{ name: string; vector: number[] }>): string[] {
  const score = (vector: number[]) => {
    let dot = 0
    let left = 0
    let right = 0
    const length = Math.min(question.length, vector.length)
    for (let index = 0; index < length; index += 1) {
      dot += question[index] * vector[index]
      left += question[index] * question[index]
      right += vector[index] * vector[index]
    }
    return dot / ((Math.sqrt(left) * Math.sqrt(right)) || 1)
  }
  return labeled
    .map((item) => ({ name: item.name, score: score(item.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.name)
}
