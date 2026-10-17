import * as FileSystem from 'expo-file-system/legacy'
import Constants from 'expo-constants'
import { webOrigin } from './config'
import { studioUp } from './speech-cloud'

type Recorder = {
  stop: () => Promise<string | null>
}

let recorder: Recorder | null = null

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

export async function startDictation() {
  const kit = openAudio()
  if (!kit) {
    throw new Error('Le micro n’est pas disponible dans cette Expo Go. Écris ta note dans le champ, Atlas la traite.')
  }
  const perm = await kit.audio.requestRecordingPermissionsAsync()
  if (!perm.granted) throw new Error('Le micro n’est pas autorisé.')
  await kit.audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
  const session = new kit.native.AudioRecorder(kit.audio.RecordingPresets.HIGH_QUALITY)
  await session.prepareToRecordAsync()
  session.record()
  recorder = {
    async stop() {
      await session.stop()
      await kit.audio.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      return session.uri
    },
  }
}

export async function stopDictation(): Promise<string> {
  const current = recorder
  recorder = null
  if (!current) return ''
  const uri = await current.stop()
  if (!uri) return ''
  const wav = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  return transcribe(wav)
}

async function transcribe(audio: string) {
  if (await studioUp()) {
    try {
      const response = await fetch(`${webOrigin}/api/atlas/hear`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audio }),
        signal: AbortSignal.timeout(20000),
      })
      const body = await response.json() as { text?: string }
      if (body.text?.trim()) return body.text.trim()
    } catch { /* le téléphone transcrit */ }
  }
  const key = nvidiaKey()
  if (!key || audio.length < 80) return ''
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        temperature: 0,
        max_tokens: 180,
        messages: [{
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: audio, format: 'wav' } },
            { type: 'text', text: 'Transcris uniquement les mots prononcés, dans leur langue. Sans commentaire.' },
          ],
        }],
      }),
      signal: AbortSignal.timeout(18000),
    })
    if (!response.ok) return ''
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
    return payload.choices?.[0]?.message?.content?.trim() || ''
  } catch {
    return ''
  }
}
