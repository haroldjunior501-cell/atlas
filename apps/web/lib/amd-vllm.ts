import { serverEnv } from './server-env'

/** OpenAI-compatible vLLM on AMD Developer Cloud / Token Factory. Additive path. */

export function amdVllmUrl() {
  return (serverEnv('AMD_VLLM_URL') || serverEnv('AMD_TOKENFACTORY_URL')).replace(/\/$/, '')
}

export function amdVllmModel() {
  return serverEnv('AMD_VLLM_MODEL') || 'nvidia/Nemotron-3-Super-120B-A12B'
}

export function amdGemmaUrl() {
  return (serverEnv('AMD_GEMMA_URL') || amdVllmUrl()).replace(/\/$/, '')
}

export function amdGemmaModel() {
  return serverEnv('AMD_GEMMA_MODEL') || 'google/gemma-3-12b-it'
}

export function amdHeaders(): Record<string, string> {
  const key = serverEnv('AMD_VLLM_API_KEY') || serverEnv('AMD_TOKENFACTORY_API_KEY')
  return key
    ? { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
    : { 'content-type': 'application/json' }
}

export function amdModels() {
  const names = [amdVllmModel()]
  if (amdGemmaModel() && !names.includes(amdGemmaModel())) names.push(amdGemmaModel())
  return names
}

function amdTokenBudget(asked: number) {
  const floor = Number(serverEnv('AMD_MIN_TOKENS') || '768')
  const boost = Number(serverEnv('AMD_TOKEN_BOOST') || '1.8')
  return Math.min(8192, Math.max(floor, Math.round(asked * boost), asked))
}

function amdWait(asked: number) {
  return Math.min(180000, Math.max(asked, Number(serverEnv('AMD_MIN_TIMEOUT_MS') || '32000')))
}

async function chat(url: string, model: string, system: string, user: string, tokens: number, timeoutMs: number) {
  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: amdHeaders(),
      body: JSON.stringify({
        model,
        temperature: 0.35,
        top_p: 0.9,
        max_tokens: tokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(/localhost|127\.0\.0\.1|:8000|:8001/.test(url) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      }),
    })
    if (!response.ok) return ''
    const payload = await response.json() as { choices?: { message?: { content?: string; reasoning_content?: string } }[] }
    const message = payload.choices?.[0]?.message
    return (message?.content || message?.reasoning_content || '').trim()
  } catch {
    return ''
  }
}

/** DeepSeek Token Factory d’abord, Gemma 31B en secours — et en relecture si le livrable est long. */
export async function thinkOnAmd(system: string, user: string, tokens: number, timeoutMs: number) {
  const out = amdTokenBudget(tokens)
  const wait = amdWait(timeoutMs)
  const main = amdVllmUrl()
  let text = ''
  if (main) text = await chat(main, amdVllmModel(), system, user, out, wait)
  const gemma = amdGemmaUrl()
  const canGemma = Boolean(gemma && amdGemmaModel() !== amdVllmModel())
  if (!text && canGemma) text = await chat(gemma, amdGemmaModel(), system, user, out, wait)
  if (text && canGemma && tokens >= 1000) {
    const refined = await chat(
      gemma,
      amdGemmaModel(),
      'You are Gemma, ATLAS team reviewer on AMD. Improve the deliverable: more precise, better structured, polished English. Invent no figures. Return only the final version.',
      text.slice(0, 14000),
      out,
      wait,
    )
    if (refined.length >= Math.min(text.length, 80)) text = refined
  }
  return text
}

export async function amdProbe(base: string) {
  if (!base) return { ok: false, models: [] as string[], latencyMs: 0, note: 'URL absente' }
  const started = Date.now()
  try {
    const response = await fetch(`${base}/models`, { headers: amdHeaders(), signal: AbortSignal.timeout(4000) })
    const latencyMs = Date.now() - started
    if (!response.ok) return { ok: false, models: [] as string[], latencyMs, note: `HTTP ${response.status}` }
    const payload = await response.json() as { data?: Array<{ id?: string }> }
    const models = (payload.data ?? []).map((item) => item.id ?? '').filter(Boolean)
    return { ok: true, models, latencyMs, note: models.length ? models.join(', ') : 'vLLM répond, liste vide' }
  } catch {
    return { ok: false, models: [] as string[], latencyMs: Date.now() - started, note: 'Injoignable depuis ATLAS' }
  }
}
