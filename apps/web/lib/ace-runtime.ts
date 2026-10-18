import { existsSync } from 'node:fs'
import { speechLang } from '@atlas/domain'
import { amdHeaders, amdGemmaModel, amdGemmaUrl, amdVllmModel, amdVllmUrl, thinkOnAmd } from './amd-vllm'
import { serverEnv } from './server-env'

export { amdVllmModel, amdVllmUrl, thinkOnAmd } from './amd-vllm'

export function llmBaseUrl() {
  return (serverEnv('AGENT_LLM_BASE_URL') || serverEnv('NVIDIA_LLM_URL')).replace(/\/$/, '')
}

export function llmModel() {
  return serverEnv('AGENT_LLM_MODEL') || serverEnv('NVIDIA_LLM_MODEL') || serverEnv('NVIDIA_NIM_MODEL') || 'qwen3-4b'
}

export function aceAssets() {
  return {
    llmPlugin: serverEnv('ACE_LLM_PATH'),
    asrZip: serverEnv('ACE_ASR_ZIP'),
    gguf: serverEnv('ATLAS_LLM_GGUF'),
    maya: serverEnv('MAYA_ACE_REPO') || 'https://github.com/NVIDIA/Maya-ACE',
  }
}

export function voiceEngines() {
  const assets = aceAssets()
  return {
    pipeline: ['listen', 'think', 'speak'] as const,
    llm: Boolean(amdVllmUrl() || llmBaseUrl() || serverEnv('NVIDIA_API_KEY')),
    amd: Boolean(amdVllmUrl()),
    localLlm: Boolean(llmBaseUrl()),
    asr: Boolean(serverEnv('RIVA_ASR_URL') || serverEnv('ASR_SERVER_URL') || serverEnv('NVIDIA_API_KEY')),
    tts: Boolean(serverEnv('RIVA_TTS_URL') || serverEnv('TTS_SERVER_URL') || serverEnv('NVIDIA_API_KEY')),
    gguf: Boolean(assets.gguf && existsSync(assets.gguf)),
    aceLlm: Boolean(assets.llmPlugin && existsSync(assets.llmPlugin)),
    aceAsr: Boolean(assets.asrZip && existsSync(assets.asrZip)),
  }
}

function nvidiaHeaders() {
  const key = serverEnv('NVIDIA_API_KEY')
  return key ? { authorization: `Bearer ${key}`, 'content-type': 'application/json' as const } : { 'content-type': 'application/json' as const }
}

let localDownUntil = 0

async function llmAlive(base: string) {
  if (Date.now() < localDownUntil) return false
  try {
    const response = await fetch(`${base}/models`, { signal: AbortSignal.timeout(350) })
    if (response.ok) return true
  } catch { /* modèle local éteint */ }
  localDownUntil = Date.now() + 20000
  return false
}

export async function thinkWithLlm(system: string, user: string, tokens = 640, timeoutMs = 28000): Promise<string> {
  const amd = await thinkOnAmd(system, user, tokens, timeoutMs)
  if (amd) return amd
  const local = llmBaseUrl()
  if (local && await llmAlive(local)) {
    const text = await chatCompletions(`${local}/chat/completions`, llmModel(), system, user, tokens, timeoutMs, nvidiaHeaders())
    if (text) return text
  }
  const key = serverEnv('NVIDIA_API_KEY')
  if (!key) return ''
  const models = [
    serverEnv('NVIDIA_NIM_MODEL'),
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'nvidia/nemotron-3-super-120b-a12b',
  ].filter(Boolean)
  for (const model of models) {
    const text = await chatCompletions(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      model,
      system,
      user,
      tokens,
      timeoutMs,
      nvidiaHeaders(),
    )
    if (text) return text
  }
  return ''
}

/** Same cloud channel with an explicit model order (e.g. the fastest one for long multi-agent work). */
export async function thinkWithModels(models: string[], system: string, user: string, tokens: number, timeoutMs: number): Promise<string> {
  const amd = await thinkOnAmd(system, user, tokens, timeoutMs)
  if (amd) return amd
  const key = serverEnv('NVIDIA_API_KEY')
  if (!key) return thinkWithLlm(system, user, tokens, timeoutMs)
  for (const model of models) {
    const text = await chatCompletions('https://integrate.api.nvidia.com/v1/chat/completions', model, system, user, tokens, timeoutMs, nvidiaHeaders())
    if (text) return text
  }
  return ''
}

/** Token stream for sentence-by-sentence TTS (OpenAI-compatible SSE). */
export async function* thinkWithLlmStream(
  system: string,
  user: string,
  tokens = 420,
  timeoutMs = 20000,
): AsyncGenerator<string> {
  const headers = nvidiaHeaders()
  const targets: Array<{ url: string; model: string; headers: Record<string, string> }> = []
  if (amdVllmUrl()) targets.push({ url: `${amdVllmUrl()}/chat/completions`, model: amdVllmModel(), headers: amdHeaders() })
  if (amdGemmaUrl() && amdGemmaModel() !== amdVllmModel()) {
    targets.push({ url: `${amdGemmaUrl()}/chat/completions`, model: amdGemmaModel(), headers: amdHeaders() })
  }
  const local = llmBaseUrl()
  if (local && await llmAlive(local)) {
    targets.push({ url: `${local}/chat/completions`, model: llmModel(), headers })
  }
  if (serverEnv('NVIDIA_API_KEY')) {
    for (const model of [
      serverEnv('NVIDIA_NIM_MODEL'),
      'nvidia/nemotron-3.5-lightning-30b-a3b',
      'nvidia/nemotron-3-super-120b-a12b',
    ].filter(Boolean)) {
      targets.push({ url: 'https://integrate.api.nvidia.com/v1/chat/completions', model, headers })
    }
  }
  for (const target of targets) {
    try {
      const response = await fetch(target.url, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: target.headers,
        body: JSON.stringify({
          model: target.model,
          temperature: 0.5,
          max_tokens: tokens,
          stream: true,
          chat_template_kwargs: { enable_thinking: false },
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      })
      if (!response.ok || !response.body) continue
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let yielded = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              yielded = true
              yield delta
            }
          } catch { /* partial SSE chunk */ }
        }
      }
      if (yielded) return
    } catch { /* try next endpoint */ }
  }
}

async function chatCompletions(
  url: string,
  model: string,
  system: string,
  user: string,
  tokens: number,
  timeoutMs: number,
  headers: Record<string, string>,
) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: tokens,
        chat_template_kwargs: { enable_thinking: false },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    })
    if (!response.ok) return ''
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
    return payload.choices?.[0]?.message?.content?.trim() ?? ''
  } catch {
    return ''
  }
}

function asrMime(nameOrFormat: string) {
  const lower = nameOrFormat.toLowerCase()
  if (lower.includes('wav')) return 'audio/wav'
  if (lower.includes('mp3')) return 'audio/mpeg'
  if (lower.includes('webm')) return 'audio/webm'
  if (lower.includes('flac')) return 'audio/flac'
  if (lower.includes('ogg')) return 'audio/ogg'
  return 'audio/mp4'
}

function asrExt(nameOrFormat: string) {
  const lower = nameOrFormat.toLowerCase()
  if (lower.endsWith('.wav') || lower === 'wav') return 'wav'
  if (lower.endsWith('.mp3') || lower === 'mp3') return 'mp3'
  if (lower.endsWith('.webm') || lower === 'webm') return 'webm'
  if (lower.endsWith('.flac') || lower === 'flac') return 'flac'
  if (lower.endsWith('.ogg') || lower === 'ogg') return 'ogg'
  return 'm4a'
}

function cleanAsr(raw: string) {
  let text = raw.replace(/\s+/g, ' ').trim()
  text = text.replace(/^["'«»]+|["'«»]+$/g, '').trim()
  if (!text || /^(vide|empty)$/i.test(text)) return ''
  return text.slice(0, 500)
}

/** ASR principal : Whisper (EN default) via multipart — accepts phone .m4a. */
export async function transcribeAudioFile(buffer: Buffer, filename = 'speech.m4a', language = 'en'): Promise<string> {
  const key = serverEnv('NVIDIA_API_KEY')
  if (!key || buffer.byteLength < 200) return ''

  const riva = serverEnv('RIVA_ASR_URL') || serverEnv('ASR_SERVER_URL')
  if (riva.startsWith('http')) {
    try {
      const form = new FormData()
      form.set('file', new Blob([new Uint8Array(buffer)], { type: asrMime(filename) }), filename)
      form.set('model', serverEnv('ASR_MODEL_NAME') || 'openai/whisper-large-v3')
      form.set('language', (language || 'en').slice(0, 2).toLowerCase())
      const response = await fetch(`${riva.replace(/\/$/, '')}/v1/audio/transcriptions`, {
        method: 'POST',
        signal: AbortSignal.timeout(18000),
        headers: { authorization: `Bearer ${key}` },
        body: form,
      })
      if (response.ok) {
        const payload = await response.json() as { text?: string; transcript?: string }
        const text = cleanAsr(payload.text || payload.transcript || '')
        if (text) return text
      }
    } catch { /* NVIDIA cloud */ }
  }

  const lang = (language || 'en').slice(0, 2).toLowerCase()
  const models = [
    serverEnv('ASR_MODEL_NAME'),
    'openai/whisper-large-v3',
    'openai/whisper-large-v3-turbo',
  ].filter((item, index, all): item is string => Boolean(item) && all.indexOf(item) === index)

  for (const model of models) {
    try {
      const form = new FormData()
      form.set('file', new Blob([new Uint8Array(buffer)], { type: asrMime(filename) }), filename)
      form.set('model', model)
      form.set('language', lang)
      form.set('response_format', 'json')
      const response = await fetch('https://integrate.api.nvidia.com/v1/audio/transcriptions', {
        method: 'POST',
        signal: AbortSignal.timeout(22000),
        headers: { authorization: `Bearer ${key}` },
        body: form,
      })
      if (response.ok) {
        const payload = await response.json() as { text?: string }
        const text = cleanAsr(payload.text || '')
        if (text) return text
      }
    } catch { /* modèle suivant */ }
  }

  // Dernier recours : modèle omni (format réel, plus de faux « wav »)
  const format = asrExt(filename)
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(18000),
      headers: nvidiaHeaders(),
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        temperature: 0,
        max_tokens: 120,
        chat_template_kwargs: { enable_thinking: false },
        messages: [{
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: buffer.toString('base64'), format } },
            { type: 'text', text: 'Transcribe only the spoken words. No commentary. If you hear no speech, reply exactly: empty' },
          ],
        }],
      }),
    })
    if (!response.ok) return ''
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
    return cleanAsr(payload.choices?.[0]?.message?.content || '')
  } catch {
    return ''
  }
}

export async function transcribeAudio(audio: string, format = 'm4a'): Promise<string> {
  if (!audio || audio.length < 100) return ''
  try {
    const buffer = Buffer.from(audio, 'base64')
    return transcribeAudioFile(buffer, `speech.${asrExt(format)}`, 'fr')
  } catch {
    return ''
  }
}

const MAGPIE_TTS_HOST = 'https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com'

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

function magpieChoice(text: string) {
  return MAGPIE[speechLang(text).slice(0, 2).toLowerCase()] ?? MAGPIE.en
}

/** Voix neurale Magpie dans la langue de la phrase. */
async function speakMagpie(text: string): Promise<{ mime: string; data: string } | null> {
  const choice = magpieChoice(text)
  const key = serverEnv('NVIDIA_API_KEY')
  if (!choice || !key) return null
  const base = (serverEnv('MAGPIE_TTS_URL') || MAGPIE_TTS_HOST).replace(/\/$/, '')
  const form = new FormData()
  form.set('text', text.slice(0, 1800))
  form.set('language', choice.language)
  form.set('voice', choice.voice)
  form.set('encoding', 'LINEAR_PCM')
  form.set('sample_rate_hz', '22050')
  try {
    const response = await fetch(`${base}/v1/audio/synthesize`, {
      method: 'POST',
      signal: AbortSignal.timeout(22000),
      headers: { authorization: `Bearer ${key}` },
      body: form,
    })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length < 80 || buffer.subarray(0, 4).toString('utf8') !== 'RIFF') return null
    return { mime: 'audio/wav', data: buffer.toString('base64') }
  } catch {
    return null
  }
}

export async function speakAudio(text: string, voiceId = 'French-Female'): Promise<{ mime: string; data: string } | null> {
  const spoken = text.trim()
  if (!spoken) return null
  const riva = serverEnv('RIVA_TTS_URL') || serverEnv('TTS_SERVER_URL')
  if (riva.startsWith('http')) {
    try {
      const response = await fetch(`${riva.replace(/\/$/, '')}/v1/audio/speech`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: nvidiaHeaders(),
        body: JSON.stringify({
          model: serverEnv('TTS_MODEL_NAME') || 'nvidia/magpie-tts-multilingual',
          input: spoken,
          voice: serverEnv('TTS_VOICE_ID') || voiceId,
        }),
      })
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length > 40) return { mime: response.headers.get('content-type') || 'audio/mpeg', data: buffer.toString('base64') }
      }
    } catch { /* Magpie cloud prend le relais */ }
  }
  return speakMagpie(spoken)
}
