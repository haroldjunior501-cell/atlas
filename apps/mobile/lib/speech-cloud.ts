import { speechLang } from '@atlas/domain'
import Constants from 'expo-constants'
import { webOrigin } from './config'

/** Voix féminines Magpie — alignées sur le Studio (French-Female / Louise). */
const MAGPIE: Record<string, { language: string; voice: string }> = {
  fr: { language: 'fr-FR', voice: 'Magpie-Multilingual.FR-FR.Louise' },
  en: { language: 'en-US', voice: 'Magpie-Multilingual.EN-US.Sofia' },
  es: { language: 'es-US', voice: 'Magpie-Multilingual.ES-US.Isabela' },
  de: { language: 'de-DE', voice: 'Magpie-Multilingual.DE-DE.Pascal' },
  it: { language: 'it-IT', voice: 'Magpie-Multilingual.IT-IT.Pascal' },
  pt: { language: 'pt-BR', voice: 'Magpie-Multilingual.PT-BR.Diego' },
  hi: { language: 'hi-IN', voice: 'Magpie-Multilingual.HI-IN.Pascal' },
  ja: { language: 'ja-JP', voice: 'Magpie-Multilingual.JA-JP.Ray' },
  ko: { language: 'ko-KR', voice: 'Magpie-Multilingual.KO-KR.Pascal' },
  vi: { language: 'vi-VN', voice: 'Magpie-Multilingual.VI-VN.Pascal' },
  zh: { language: 'zh-CN', voice: 'Magpie-Multilingual.ZH-CN.HouZhen' },
  ar: { language: 'ar-AR', voice: 'Magpie-Multilingual.AR-AR.Jason' },
}

const MAGPIE_HOST = 'https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com'

function nvidiaKey() {
  const extra = Constants.expoConfig?.extra as { nvidiaApiKey?: string } | undefined
  return extra?.nvidiaApiKey?.trim() || ''
}

function bytesToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const size = 0x8000
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size))
  }
  return btoa(binary)
}

let studioCache: { at: number; up: boolean } | null = null

/** Le Studio répond-il ? GET léger (pas de TTS). */
export async function studioUp() {
  if (studioCache && Date.now() - studioCache.at < 12000) return studioCache.up
  let up = false
  try {
    const response = await fetch(`${webOrigin}/api/atlas/voice`, {
      method: 'GET',
      signal: AbortSignal.timeout(450),
    })
    up = response.ok
  } catch {
    up = false
  }
  studioCache = { at: Date.now(), up }
  return up
}

async function speakOnStudio(text: string) {
  const response = await fetch(`${webOrigin}/api/atlas/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 1800) }),
    signal: AbortSignal.timeout(9000),
  })
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength < 200) return null
  studioCache = { at: Date.now(), up: true }
  return { mime: response.headers.get('content-type') || 'audio/wav', data: bytesToBase64(buffer) }
}

async function speakOnPhone(text: string) {
  const choice = MAGPIE[speechLang(text).slice(0, 2).toLowerCase()] ?? MAGPIE.en
  const key = nvidiaKey()
  if (!choice || !key) return null
  const form = new FormData()
  form.append('text', text.slice(0, 1800))
  form.append('language', choice.language)
  form.append('voice', choice.voice)
  form.append('encoding', 'LINEAR_PCM')
  form.append('sample_rate_hz', '22050')
  const response = await fetch(`${MAGPIE_HOST}/v1/audio/synthesize`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength < 200) return null
  return { mime: 'audio/wav', data: bytesToBase64(buffer) }
}

type Clip = { mime: string; data: string }

/** Premier résultat gagnant : Studio (Louise) et Magpie téléphone en parallèle. */
async function raceSpeak(text: string): Promise<Clip | null> {
  return new Promise((resolve) => {
    let settled = false
    let pending = 2
    const finish = (clip: Clip | null) => {
      pending -= 1
      if (settled) return
      if (clip) {
        settled = true
        resolve(clip)
        return
      }
      if (pending <= 0) resolve(null)
    }
    void speakOnStudio(text).then(finish).catch(() => finish(null))
    void speakOnPhone(text).then(finish).catch(() => finish(null))
  })
}

/** Voix humaine féminine : Studio + Magpie Louise, le plus rapide des deux. */
export async function synthesizeSpeech(text: string) {
  const line = text.trim()
  if (!line) return null
  try {
    return await raceSpeak(line)
  } catch {
    return null
  }
}

const CLOUD_SYSTEM = `You are Atlas, the virtual assistant for the ATLAS product. Fluent natural English, clear, direct, useful.
Never answer in French unless the user clearly wrote in French.
Always answer the request. Never only "I'm listening", never an empty phrase, never copy these instructions.
ZtcHosting = the user's org: web hosting, domains, billing, AI employees (Nova, Swift, etc.).
If asked to present the organization: explain ZtcHosting, the AI team, and how to drive it (mobile Organization, PC Studio, "open the site" → ztchosting.com).
reply: 2 to 5 COMPLETE spoken English sentences.
board.body: structured written answer, complete.
Kinds: lesson|day|document|code|search|plan|scan.
JSON only:
{"reply":"...","board":{"kind":"document","title":"...","body":"..."},"tasks":[],"steps":[]}`

export type CloudPack = {
  reply: string
  board?: { kind?: string; title?: string; body?: string }
  tasks?: Array<{ title?: string; due?: string; done?: boolean }>
  steps?: Array<{ label?: string; status?: string; detail?: string }>
}

function parsePack(raw: string): CloudPack {
  const match = raw.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as CloudPack
      if (parsed.reply?.trim() || parsed.board?.body) {
        return {
          reply: (parsed.reply || parsed.board?.body || '').trim(),
          board: parsed.board,
          tasks: parsed.tasks,
          steps: parsed.steps,
        }
      }
    } catch { /* texte brut */ }
  }
  const text = raw.replace(/```[\s\S]*?```/g, '').trim()
  return { reply: text }
}

export async function askCloud(text: string, name?: string, memory?: string, image?: string): Promise<CloudPack> {
  const key = nvidiaKey()
  if (!key) return { reply: '' }
  const who = name?.trim() ? `Utilisateur : ${name.trim()}\n` : ''
  const fil = memory?.trim() ? `Fil :\n${memory.trim()}\n` : ''
  const userText = `${who}${fil}Demande : ${text}`
  const content = image
    ? [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: image } },
      ]
    : userText
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: image ? 'meta/llama-3.2-11b-vision-instruct' : 'nvidia/nemotron-3.5-lightning-30b-a3b',
        temperature: 0.35,
        max_tokens: image ? 1200 : 900,
        messages: [
          { role: 'system', content: CLOUD_SYSTEM },
          { role: 'user', content },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) return { reply: '' }
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
    return parsePack(payload.choices?.[0]?.message?.content?.trim() || '')
  } catch {
    return { reply: '' }
  }
}
