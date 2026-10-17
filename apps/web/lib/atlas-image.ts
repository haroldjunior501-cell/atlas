/**
 * Génération d’images — NVIDIA FLUX.1-schnell (cloud) + fallback Pollinations.
 * Docs : https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_1-schnell
 * Repo utile : https://github.com/black-forest-labs/flux
 */
import { saveUserBinaryFile } from '@/lib/atlas-desktop'
import { serverEnv } from '@/lib/server-env'

export type ImageGenResult = {
  path: string
  title: string
  dataUrl: string
  provider: 'nvidia-flux' | 'pollinations'
  summary: string
}

function sanitizePrompt(prompt: string) {
  return prompt.replace(/\s+/g, ' ').trim().slice(0, 1200)
}

function fileStem(prompt: string) {
  const stem = prompt
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return stem || `atlas-image-${Date.now()}`
}

async function generateWithNvidia(prompt: string): Promise<Buffer | null> {
  const key = serverEnv('NVIDIA_API_KEY')
  if (!key) return null
  const url = serverEnv('NVIDIA_IMAGE_URL')
    || 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell'
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        height: 1024,
        width: 1024,
        cfg_scale: 0,
        mode: 'base',
        samples: 1,
        seed: 0,
        steps: 4,
      }),
      signal: AbortSignal.timeout(90000),
    })
    if (!response.ok) return null
    const body = await response.json() as {
      artifacts?: Array<{ base64?: string }>
      data?: Array<{ b64_json?: string }>
    }
    const b64 = body.artifacts?.[0]?.base64 || body.data?.[0]?.b64_json
    if (!b64) return null
    return Buffer.from(b64, 'base64')
  } catch {
    return null
  }
}

async function generateWithPollinations(prompt: string): Promise<Buffer | null> {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now() % 100000}`
    const response = await fetch(url, {
      headers: { accept: 'image/*' },
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return bytes.length > 800 ? bytes : null
  } catch {
    return null
  }
}

export async function generateAtlasImage(opts: {
  prompt: string
  title?: string
  open?: boolean
}): Promise<ImageGenResult> {
  const prompt = sanitizePrompt(opts.prompt)
  if (prompt.length < 3) throw new Error('Décrivez l’image à générer.')

  let bytes = await generateWithNvidia(prompt)
  let provider: ImageGenResult['provider'] = 'nvidia-flux'
  if (!bytes) {
    bytes = await generateWithPollinations(prompt)
    provider = 'pollinations'
  }
  if (!bytes) {
    throw new Error('Génération d’image indisponible. Vérifiez NVIDIA_API_KEY ou réessayez.')
  }

  const title = (opts.title || fileStem(prompt)).slice(0, 60)
  const saved = await saveUserBinaryFile({
    title,
    ext: 'png',
    data: bytes,
    folder: 'documents',
    open: opts.open !== false,
  })
  const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`
  return {
    path: saved.path,
    title: saved.title,
    dataUrl,
    provider,
    summary: `Image générée (${provider === 'nvidia-flux' ? 'FLUX NVIDIA' : 'secours'}) : ${saved.title} dans Documents.`,
  }
}
