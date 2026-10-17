/**
 * ATLAS runtime around NVIDIA.
 *
 * NIM serves each role as an OpenAI-compatible microservice.
 * NeMo Agent Toolkit is the orchestration model: one agent profile per role.
 * Riva is speech in and speech out, used only when its endpoints are set.
 * RAPIDS cuML is the observability estimator. Without a GPU sidecar the same
 * inputs are scored locally, in the shape of fit/predict from the RAPIDS examples.
 */

import { draftFromIntention, ORGANIZATION_PLAN_PROMPT, parseOrganizationPlan } from '@atlas/domain'

export interface AgentSignal {
  role: string
  openTasks: number
  costEur: number
  latencyMs: number
}

export interface LoadForecast {
  role: string
  score: number
  overloaded: boolean
}

export interface NvidiaRuntime {
  nim: { ready: boolean; model: string }
  nemo: { toolkit: 'nemo-agent-toolkit'; roles: string[] }
  riva: { ready: boolean }
  ace: { pipeline: readonly ['listen', 'think', 'speak']; llm: boolean; asr: boolean; tts: boolean }
  rapids: { engine: 'local' | 'rapids' }
}

export const NEMO_ROLES = ['CMO', 'CTO', 'CFO', 'Sales', 'Produit'] as const

const NIM_MODEL = () => process.env.NVIDIA_NIM_MODEL ?? 'meta/llama-3.2-11b-vision-instruct'
const PLAN_MODEL = 'nvidia/nemotron-3-super-120b-a12b'
const LLM_BASE = () => (process.env.AGENT_LLM_BASE_URL || process.env.NVIDIA_LLM_URL || '').replace(/\/$/, '')
const LLM_MODEL = () => process.env.AGENT_LLM_MODEL || process.env.NVIDIA_LLM_MODEL || NIM_MODEL()

export function nvidiaRuntime(): NvidiaRuntime {
  return {
    nim: { ready: Boolean(process.env.NVIDIA_API_KEY), model: NIM_MODEL() },
    nemo: { toolkit: 'nemo-agent-toolkit', roles: [...NEMO_ROLES] },
    riva: { ready: Boolean(process.env.RIVA_ASR_URL && process.env.RIVA_TTS_URL) },
    ace: {
      pipeline: ['listen', 'think', 'speak'],
      llm: Boolean(LLM_BASE() || process.env.NVIDIA_API_KEY),
      asr: Boolean(process.env.RIVA_ASR_URL || process.env.ASR_SERVER_URL || process.env.NVIDIA_API_KEY),
      tts: Boolean(process.env.RIVA_TTS_URL || process.env.TTS_SERVER_URL || process.env.NVIDIA_API_KEY),
    },
    rapids: { engine: process.env.RAPIDS_URL ? 'rapids' : 'local' },
  }
}

function localScore(row: AgentSignal): LoadForecast {
  const score = Number((row.openTasks * 0.15 + row.costEur * 0.02 + row.latencyMs / 5000).toFixed(2))
  return { role: row.role, score, overloaded: score >= 0.75 }
}

export async function forecastLoad(rows: AgentSignal[]): Promise<{ engine: 'local' | 'rapids'; items: LoadForecast[] }> {
  const sidecar = process.env.RAPIDS_URL
  if (sidecar) {
    try {
      const response = await fetch(`${sidecar.replace(/\/$/, '')}/predict`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (response.ok) {
        const items = (await response.json()) as LoadForecast[]
        if (Array.isArray(items)) return { engine: 'rapids', items }
      }
    } catch {
      // The GPU sidecar is optional. The local score keeps observability honest.
    }
  }
  return { engine: 'local', items: rows.map(localScore) }
}

export function localReply(agents: { firstName: string; role: string }[], forecast: LoadForecast[]): string {
  const roster = agents.slice(0, 5).map((agent) => `${agent.firstName} (${agent.role})`).join(', ')
  const extra = agents.length > 5 ? `, et ${agents.length - 5} autres` : ''
  const hot = forecast.filter((item) => item.overloaded).map((item) => item.role)
  const load = hot.length > 0
    ? `${hot.join(', ')} risque d’être en surcharge.`
    : 'Aucun employé n’est en surcharge.'
  return `C’est parti. ${roster}${extra} prennent leur poste. ${load}`
}

export async function askNim(intention: string, roster: string): Promise<string | null> {
  const messages = [
    { role: 'system', content: 'Tu es ATLAS. Réponds en français, en deux phrases courtes, comme un directeur qui confirme la composition de l’équipe. Pas de liste technique.' },
    { role: 'user', content: `Demande : ${intention}\nÉquipe : ${roster}` },
  ]
  if (LLM_BASE() && await llmAlive(LLM_BASE())) {
    const local = await chatAt(LLM_BASE(), LLM_MODEL(), messages, 220, 8000)
    if (local) return local
  }
  const key = process.env.NVIDIA_API_KEY
  if (!key) return null
  return chatAt('https://integrate.api.nvidia.com/v1', NIM_MODEL(), messages, 220, 8000, key)
}

async function llmAlive(base: string) {
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/models`, { signal: AbortSignal.timeout(600) })
    return response.ok
  } catch {
    return false
  }
}

async function chatAt(
  base: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  tokens: number,
  timeoutMs: number,
  key?: string,
): Promise<string | null> {
  if (!base) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (key) headers.authorization = `Bearer ${key}`
    const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({ model, temperature: 0.4, max_tokens: tokens, messages }),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    return body.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function planOrganization(intention: string): Promise<ReturnType<typeof draftFromIntention>> {
  const key = process.env.NVIDIA_API_KEY
  if (!key || key === 'test-key') return draftFromIntention(intention)
  let correction = ''
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: PLAN_MODEL,
          temperature: 0.3,
          max_tokens: 900,
          chat_template_kwargs: { enable_thinking: false },
          messages: [
            { role: 'system', content: ORGANIZATION_PLAN_PROMPT },
            { role: 'user', content: correction ? `Demande : ${intention}\n${correction}` : `Demande : ${intention}` },
          ],
        }),
      })
      if (!response.ok) break
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
      const parsed = parseOrganizationPlan(body.choices?.[0]?.message?.content ?? '', intention)
      if ('draft' in parsed) return parsed.draft
      correction = `Le JSON précédent est invalide : ${parsed.error}. Renvoie uniquement un JSON corrigé.`
    } catch {
      break
    } finally {
      clearTimeout(timer)
    }
  }
  return draftFromIntention(intention)
}

export async function answerFromMemory(question: string, dossier: string): Promise<string | null> {
  const key = process.env.NVIDIA_API_KEY
  if (!key) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: NIM_MODEL(),
        temperature: 0.2,
        max_tokens: 280,
        messages: [
          {
            role: 'system',
            content: 'Tu es ATLAS. Tu réponds au dirigeant en français, en trois phrases maximum. Tu n’utilises que la mémoire fournie. Si elle ne contient pas la réponse, dis-le. N’invente aucun employé, chiffre ou décision.',
          },
          {
            role: 'user',
            content: `Mémoire :\n${dossier}\n\nQuestion :\n${question}`,
          },
        ],
      }),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const text = body.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
