const SCRIPTS: Array<[RegExp, string]> = [
  [/[\u0400-\u04FF]/u, 'ru-RU'],
  [/[\u0600-\u06FF]/u, 'ar-SA'],
  [/[\u0590-\u05FF]/u, 'he-IL'],
  [/[\u0370-\u03FF]/u, 'el-GR'],
  [/[\u0E00-\u0E7F]/u, 'th-TH'],
  [/[\u0900-\u097F]/u, 'hi-IN'],
  [/[\u0980-\u09FF]/u, 'bn-IN'],
  [/[\u0A00-\u0A7F]/u, 'pa-IN'],
  [/[\u0A80-\u0AFF]/u, 'gu-IN'],
  [/[\u0B80-\u0BFF]/u, 'ta-IN'],
  [/[\u0C00-\u0C7F]/u, 'te-IN'],
  [/[\u0C80-\u0CFF]/u, 'kn-IN'],
  [/[\u0D00-\u0D7F]/u, 'ml-IN'],
  [/[\u3040-\u30FF]/u, 'ja-JP'],
  [/[\uAC00-\uD7AF]/u, 'ko-KR'],
  [/[\u4E00-\u9FFF]/u, 'zh-CN'],
]

const WORDS: Array<[string, string[]]> = [
  ['vi-VN', ['không', 'của', 'những', 'một', 'tôi', 'bạn', 'chào', 'cảm']],
  ['pt-BR', ['não', 'você', 'obrigado', 'obrigada', 'olá', 'isso', 'está', 'muito']],
  ['es-ES', ['hola', 'gracias', 'qué', 'cómo', 'está', 'buenos', 'por', 'para', 'una']],
  ['de-DE', ['und', 'nicht', 'ich', 'das', 'ist', 'hallo', 'danke', 'bitte', 'guten']],
  ['it-IT', ['ciao', 'grazie', 'che', 'non', 'sono', 'buongiorno', 'come', 'una']],
  ['nl-NL', ['het', 'een', 'niet', 'hallo', 'dank', 'alsjeblieft', 'voor']],
  ['pl-PL', ['się', 'nie', 'jest', 'cześć', 'dziękuję', 'proszę']],
  ['tr-TR', ['bir', 'için', 'merhaba', 'teşekkür', 'değil', 'çok']],
  ['sv-SE', ['och', 'att', 'det', 'inte', 'hej', 'tack']],
  ['ro-RO', ['și', 'nu', 'este', 'bună', 'mulțumesc']],
  ['id-ID', ['yang', 'dan', 'tidak', 'halo', 'terima']],
  ['fr-FR', ['le', 'la', 'les', 'des', 'une', 'je', 'vous', 'bonjour', 'est', 'pour', 'dans', 'salut', 'merci']],
  ['en-US', ['the', 'what', 'how', 'why', 'please', 'hello', 'thanks', 'is', 'are', 'you', 'to', 'of']],
]

function hits(sample: string, words: string[]) {
  let count = 0
  for (const word of words) {
    const found = sample.match(new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'giu'))
    count += found?.length ?? 0
  }
  return count
}

/** Code BCP-47 de la phrase, pour la voix. */
export function speechLang(text: string): string {
  const sample = String(text || '').slice(0, 500)
  for (const [pattern, code] of SCRIPTS) {
    if (pattern.test(sample)) return code
  }
  let best = 'fr-FR'
  let bestScore = 0
  for (const [code, words] of WORDS) {
    const score = hits(sample, words)
    if (score > bestScore) {
      best = code
      bestScore = score
    }
  }
  return best
}
