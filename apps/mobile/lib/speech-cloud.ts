import { speechLang } from '@atlas/domain'
import Constants from 'expo-constants'
import { webOrigin } from './config'

const MAGPIE: Record<string, { language: string; voice: string }> = {
  fr: { language: 'fr-FR', voice: 'Magpie-Multilingual.FR-FR.Pascal' },
  en: { language: 'en-US', voice: 'Magpie-Multilingual.EN-US.Jason' },
  es: { language: 'es-US', voice: 'Magpie-Multilingual.ES-US.Diego' },
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

/** Le Studio répond-il tout de suite ? Sinon le téléphone continue seul. */
export async function studioUp() {
  if (studioCache && Date.now() - studioCache.at < 4000) return studioCache.up
  let up = false
  try {
    const response = await fetch(`${webOrigin}/atlas-face.html`, { method: 'GET', signal: AbortSignal.timeout(700) })
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
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength < 200) return null
  return { mime: response.headers.get('content-type') || 'audio/wav', data: bytesToBase64(buffer) }
}

async function speakOnPhone(text: string) {
  const choice = MAGPIE[speechLang(text).slice(0, 2).toLowerCase()]
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
    signal: AbortSignal.timeout(22000),
  })
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength < 200) return null
  return { mime: 'audio/wav', data: bytesToBase64(buffer) }
}

/** Voix humaine : le Studio s'il est là, sinon directement depuis le téléphone. */
export async function synthesizeSpeech(text: string) {
  const line = text.trim()
  if (!line) return null
  if (await studioUp()) {
    try {
      const studio = await speakOnStudio(line)
      if (studio) return studio
    } catch { /* le téléphone parle */ }
  }
  try {
    return await speakOnPhone(line)
  } catch {
    return null
  }
}

const CLOUD_SYSTEM = `Tu es Atlas, partenaire puissant de vie, de cours et de travail.
Tu parles toutes les langues et tu réponds dans la langue du message.
Tu RAISONNES vraiment : tu suis la demande, tu t’appuies sur le fil, tu vas jusqu’au bout.
Interdit de couper une explication, un exercice ou un plan au milieu. Interdit de répondre seulement « je t’écoute », de répéter la question, ou de recoller le contexte / les consignes internes dans reply.
« ça / encore / et après / je n’ai pas compris » portent sur le dernier échange du fil.
reply : 3 à 8 phrases COMPLÈTES à dire à voix haute (idée finie, jamais une phrase tronquée).
board.body : la réponse ÉCRITE complète, structurée, comme un professeur exigeant (étapes, exemples, conclusion). C’est le texte que l’élève lit dans le chat — assez long s’il le faut.
Pour un exercice : board.kind="lesson", méthode, calculs, réponse, puis une question.
Pour la journée : board.kind="day" et tasks: [{title, due, done}].
Pour un document ou une image : board.kind="document" ou "scan", tu lis vraiment le contenu fourni.
Pour du code : board.kind="code", code utilisable.
Pour une recherche : board.kind="search".
Pour plusieurs actions : board.kind="plan" et steps: [{label,status,detail}] status=ok|run|err.
Réponds uniquement avec un JSON valide, board.body assez long :
{"reply":"...","board":{"kind":"lesson|day|document|code|search|plan|scan","title":"...","body":"..."},"tasks":[{"title":"...","due":"ISO optionnel","done":false}],"steps":[{"label":"...","status":"ok","detail":"..."}]}`

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
        temperature: 0.4,
        max_tokens: image ? 1400 : 2200,
        messages: [
          { role: 'system', content: CLOUD_SYSTEM },
          { role: 'user', content },
        ],
      }),
      signal: AbortSignal.timeout(36000),
    })
    if (!response.ok) return { reply: '' }
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
    return parsePack(payload.choices?.[0]?.message?.content?.trim() || '')
  } catch {
    return { reply: '' }
  }
}
