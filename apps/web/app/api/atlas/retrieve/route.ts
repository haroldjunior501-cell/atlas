import { serverEnv } from '@/lib/server-env'
import { EMBED_MODEL, rankBySimilarity } from '@/lib/nvidia-voice'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { question?: string; documents?: string[] } | null
  const question = body?.question?.trim() ?? ''
  const documents = (body?.documents ?? []).map((name) => name.trim()).filter(Boolean).slice(0, 12)
  if (question.length < 2 || documents.length === 0) return Response.json({ documents: [] })
  const key = serverEnv('NVIDIA_API_KEY')
  if (!key) return Response.json({ documents })

  const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: [question, ...documents] }),
  }).catch(() => null)
  if (!response?.ok) return Response.json({ documents })
  const payload = await response.json() as { data?: { embedding?: number[] }[] }
  const vectors = (payload.data ?? []).map((item) => item.embedding ?? [])
  const questionVector = vectors[0] ?? []
  const labeled = documents.map((name, index) => ({ name, vector: vectors[index + 1] ?? [] })).filter((item) => item.vector.length > 0)
  if (!questionVector.length || labeled.length === 0) return Response.json({ documents })
  return Response.json({ documents: rankBySimilarity(questionVector, labeled) })
}
