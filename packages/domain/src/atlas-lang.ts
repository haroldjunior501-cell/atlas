/** Primary language of ATLAS (product default). */
export const ATLAS_PRIMARY_LANG = 'en' as const
export const ATLAS_PRIMARY_LOCALE = 'en-US' as const
export const ATLAS_PRIMARY_LANG_NAME = 'English' as const

/** BCP-47 tag for speech / UI defaults. */
export function atlasSpeechLocale(override?: string | null) {
  const raw = String(override || '').trim()
  if (!raw) return ATLAS_PRIMARY_LOCALE
  if (/^en\b/i.test(raw)) return 'en-US'
  if (raw.includes('-')) return raw
  return `${raw}-${raw.toUpperCase()}`
}

/** Short ISO code for ASR providers. */
export function atlasAsrLanguage(override?: string | null) {
  const raw = String(override || ATLAS_PRIMARY_LANG).trim().toLowerCase()
  return (raw.slice(0, 2) || ATLAS_PRIMARY_LANG)
}

/** System-prompt line: English first, mirror user language when clearly different. */
export const ATLAS_LANGUAGE_RULE =
  'Primary language: English. Reply in English by default. '
  + 'If the user clearly writes in another language, reply in that language.'
