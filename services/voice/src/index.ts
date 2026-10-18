export interface TextToVideoTask {
  id: string
  status: 'created' | 'pending' | 'processing' | 'success' | 'failure' | 'cancelled'
  videoUrl: string | null
}

export class MootionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async createTextToVideo(prompt: string, language = 'en-US'): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/text2video`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        size: '1080x1920',
        storyboard: {
          style: 'photorealistic',
          user_input: { prompt, language },
        },
        composition: { voice_config: 'Ava' },
      }),
    })
    if (!response.ok) throw new Error(`Mootion a répondu ${response.status}`)
    const body = (await response.json()) as { data: { id: string } }
    return body.data.id
  }

  async getTextToVideo(id: string): Promise<TextToVideoTask> {
    const response = await fetch(`${this.baseUrl}/api/v1/text2video/${id}`, {
      headers: { authorization: `Bearer ${this.token}` },
    })
    if (!response.ok) throw new Error(`Mootion a répondu ${response.status}`)
    const body = (await response.json()) as {
      data: { id: string; status: TextToVideoTask['status']; video_url: string | null }
    }
    return {
      id: body.data.id,
      status: body.data.status,
      videoUrl: body.data.video_url,
    }
  }
}

export function mootionFromEnv(): MootionClient | null {
  const token = process.env.MOOTION_API_TOKEN
  if (!token) return null
  return new MootionClient(process.env.MOOTION_API_BASE ?? 'https://api.seedv.cn', token)
}

export {
  A2F_VISEMES,
  ARKIT_BLENDSHAPES,
  arkitWeights,
  mayaAceClip,
  sampleVisemeProgress,
  tokenizeVisemes,
  visemesFromSpeech,
  VOICE_PIPELINE,
} from './visemes'
export type { A2fViseme, MayaAceClip, VisemeFrame } from './visemes'
