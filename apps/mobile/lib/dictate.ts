import * as FileSystem from 'expo-file-system/legacy'
import Constants from 'expo-constants'
import { webOrigin } from './config'

type RecorderSession = {
  stop: () => Promise<string | null>
}

let recorder: RecorderSession | null = null
let watchTimer: ReturnType<typeof setInterval> | null = null
let autoResolve: (() => void) | null = null

function nvidiaKey() {
  const extra = Constants.expoConfig?.extra as { nvidiaApiKey?: string } | undefined
  return extra?.nvidiaApiKey?.trim() || ''
}

function openAudio() {
  try {
    const audio = require('expo-audio') as typeof import('expo-audio')
    const native = require('expo-audio/build/AudioModule').default as {
      AudioRecorder: new (preset: unknown) => {
        prepareToRecordAsync: () => Promise<void>
        record: () => void
        stop: () => Promise<void>
        uri: string | null
      }
    }
    return { audio, native }
  } catch {
    return null
  }
}

/**
 * WAV mono 16 kHz — seul format fiable pour Whisper / Parakeet NVIDIA.
 * (le m4a du téléphone était refusé → « rien entendu »)
 */
function wavPreset() {
  return {
    extension: '.wav',
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    android: {
      extension: '.wav',
      outputFormat: 'default',
      audioEncoder: 'default',
      sampleRate: 16000,
    },
    ios: {
      extension: '.wav',
      outputFormat: 'lpcm',
      audioQuality: 64,
      sampleRate: 16000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  }
}

function formatOf(uri: string): { ext: string; mime: string } {
  const lower = (uri.toLowerCase().split('?')[0] || '')
  if (lower.endsWith('.wav')) return { ext: 'wav', mime: 'audio/wav' }
  if (lower.endsWith('.webm')) return { ext: 'webm', mime: 'audio/webm' }
  if (lower.endsWith('.mp3')) return { ext: 'mp3', mime: 'audio/mpeg' }
  return { ext: 'm4a', mime: 'audio/mp4' }
}

function cleanTranscript(raw: string) {
  let text = raw.replace(/\s+/g, ' ').trim()
  text = text.replace(/^["'«»]+|["'«»]+$/g, '').trim()
  text = text.replace(/<\/?think>/gi, '').trim()
  text = text.replace(/^(transcription\s*:\s*|voici (la |le )?texte\s*:\s*)/i, '').trim()
  if (!text || /^vide$/i.test(text)) return ''
  if (/^(i (didn'?t|cannot)|je n['’]ai (rien )?entendu|aucune (parole|phrase)|no speech|silence)/i.test(text)) {
    return ''
  }
  return text.slice(0, 500)
}

function clearWatch() {
  if (watchTimer) {
    clearInterval(watchTimer)
    watchTimer = null
  }
  autoResolve = null
}

export async function startDictation(onSpeechEnd?: () => void) {
  clearWatch()
  const kit = openAudio()
  if (!kit) {
    throw new Error('Le micro n’est pas disponible. Écris ta demande dans le champ.')
  }
  const perm = await kit.audio.requestRecordingPermissionsAsync()
  if (!perm.granted) throw new Error('Autorise le micro pour qu’Atlas t’entende.')
  await kit.audio.setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  })

  let session: InstanceType<typeof kit.native.AudioRecorder>
  try {
    session = new kit.native.AudioRecorder(wavPreset())
    await session.prepareToRecordAsync()
  } catch {
    // Fallback AAC si WAV refusé par le device
    session = new kit.native.AudioRecorder(kit.audio.RecordingPresets.HIGH_QUALITY)
    await session.prepareToRecordAsync()
  }
  session.record()

  const startedAt = Date.now()
  recorder = {
    async stop() {
      clearWatch()
      await session.stop()
      await kit.audio.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      })
      return session.uri
    },
  }

  if (onSpeechEnd) {
    autoResolve = onSpeechEnd
    // Envoi auto ~5 s (commande vocale) — l’utilisateur peut aussi appuyer sur Comprendre
    watchTimer = setInterval(() => {
      if (!recorder || !autoResolve) return
      if (Date.now() - startedAt >= 5500) {
        const done = autoResolve
        clearWatch()
        done()
      }
    }, 400)
  }
}

export async function stopDictation(): Promise<string> {
  clearWatch()
  const current = recorder
  recorder = null
  if (!current) return ''
  const uri = await current.stop().catch(() => null)
  if (!uri) return ''
  return transcribeUri(uri)
}

async function transcribeUri(uri: string): Promise<string> {
  const { ext } = formatOf(uri)
  let base64 = ''
  try {
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
  } catch {
    return ''
  }
  if (base64.length < 80) return ''

  const viaStudio = await hearStudioJson(base64, ext).catch(() => '')
  if (viaStudio) return cleanTranscript(viaStudio)

  const viaNvidia = await hearNvidiaWav(base64, ext).catch(() => '')
  return cleanTranscript(viaNvidia)
}

async function hearStudioJson(audio: string, format: string) {
  const response = await fetch(`${webOrigin}/api/atlas/hear`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audio, format }),
    signal: AbortSignal.timeout(28000),
  })
  if (!response.ok) return ''
  const body = (await response.json().catch(() => ({}))) as { text?: string }
  return body.text?.trim() || ''
}

async function hearNvidiaWav(base64: string, format: string) {
  const key = nvidiaKey()
  if (!key) return ''
  // Omni multimodal — format réel (wav de préférence)
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      temperature: 0,
      max_tokens: 160,
      chat_template_kwargs: { enable_thinking: false },
      messages: [{
        role: 'user',
        content: [
          { type: 'input_audio', input_audio: { data: base64, format: format === 'wav' ? 'wav' : format } },
          { type: 'text', text: 'Transcribe the spoken words exactly. Transcription only, no quotes. If silence: empty' },
        ],
      }],
    }),
    signal: AbortSignal.timeout(28000),
  })
  if (!response.ok) return ''
  const payload = (await response.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[]
  }
  return payload.choices?.[0]?.message?.content?.trim() || ''
}
