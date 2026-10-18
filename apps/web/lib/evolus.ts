import { serverEnv } from './server-env'

/** Evolus event workspace — partner track. Agents must run on the team's AMD-hosted model. */

const CHAT = 'https://api.evolus.ai/v1'
const REST = 'https://api.evolus.ai/api/v1'

export function evolusConfigured() {
  return Boolean(serverEnv('EVOLUS_API_KEY') && serverEnv('EVOLUS_APP_ID'))
}

function restHeaders(): Record<string, string> {
  return {
    'X-ApiKey': serverEnv('EVOLUS_API_KEY'),
    'X-Application-Id': serverEnv('EVOLUS_APP_ID'),
    'content-type': 'application/json',
  }
}

function chatHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${serverEnv('EVOLUS_API_KEY')}`,
    'content-type': 'application/json',
  }
}

export async function evolusHealth() {
  if (!evolusConfigured()) {
    return { ok: false, agents: [] as string[], tools: [] as string[], note: 'EVOLUS_API_KEY et EVOLUS_APP_ID manquent. Workspace événement : app.evolus.ai + code kickoff.' }
  }
  try {
    const [models, tools] = await Promise.all([
      fetch(`${CHAT}/models`, { headers: chatHeaders(), signal: AbortSignal.timeout(8000) }),
      fetch(`${REST}/ai-tools`, { headers: restHeaders(), signal: AbortSignal.timeout(8000) }),
    ])
    const modelJson = models.ok ? await models.json() as { data?: Array<{ id?: string }> } : { data: [] }
    const toolJson = tools.ok ? await tools.json() as { tools?: Array<{ id?: string; name?: string }> } | Array<{ id?: string; name?: string }> : []
    const list = Array.isArray(toolJson) ? toolJson : toolJson.tools ?? []
    return {
      ok: models.ok || tools.ok,
      agents: (modelJson.data ?? []).map((item) => item.id ?? '').filter(Boolean),
      tools: list.map((item) => item.id || item.name || '').filter(Boolean),
      note: models.ok ? 'Workspace Evolus joignable' : `Chat ${models.status}, tools ${tools.status}`,
    }
  } catch {
    return { ok: false, agents: [] as string[], tools: [] as string[], note: 'api.evolus.ai injoignable' }
  }
}

export async function evolusChat(user: string, system?: string) {
  if (!evolusConfigured()) return { error: 'Evolus non configuré' }
  const model = serverEnv('EVOLUS_AGENT_ID')
  if (!model) return { error: 'EVOLUS_AGENT_ID manquant (applicationId:agentId)' }
  const messages = [
    ...(system ? [{ role: 'system' as const, content: system }] : []),
    { role: 'user' as const, content: user },
  ]
  const response = await fetch(`${CHAT}/chat/completions`, {
    method: 'POST',
    headers: chatHeaders(),
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model, messages }),
  })
  if (!response.ok) return { error: `Evolus chat ${response.status}` }
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
  return { text: payload.choices?.[0]?.message?.content?.trim() ?? '' }
}

/** AI Tool : résumé — 1re brique Evolus. */
export async function evolusSummarize(text: string) {
  if (!evolusConfigured()) return { error: 'Evolus non configuré' }
  const response = await fetch(`${REST}/ai-tools/summarize/run`, {
    method: 'POST',
    headers: restHeaders(),
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ text, options: { length: 'medium', style: 'bullets' } }),
  })
  if (!response.ok) return { error: `Evolus summarize ${response.status}` }
  const payload = await response.json() as { output?: string }
  return { text: payload.output ?? '' }
}

/** AI Tool : comparaison — 2e brique Evolus. */
export async function evolusCompare(text: string, secondaryText: string) {
  if (!evolusConfigured()) return { error: 'Evolus non configuré' }
  const response = await fetch(`${REST}/ai-tools/compare/run`, {
    method: 'POST',
    headers: restHeaders(),
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ text, secondaryText }),
  })
  if (!response.ok) return { error: `Evolus compare ${response.status}` }
  const payload = await response.json() as { output?: string }
  return { text: payload.output ?? '' }
}

/** Knowledge library : importe une page (3e brique, si EVOLUS_LIBRARY_ID). */
export async function evolusIndexUrl(url: string, title: string) {
  const library = serverEnv('EVOLUS_LIBRARY_ID')
  if (!evolusConfigured() || !library) return { error: 'EVOLUS_LIBRARY_ID manquant' }
  const response = await fetch(`${REST}/memories/${library}/documents/import-url`, {
    method: 'POST',
    headers: restHeaders(),
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ title, url }),
  })
  if (!response.ok && response.status !== 201) return { error: `Evolus library ${response.status}` }
  return { ok: true }
}

export async function evolusRunWorkflow(input: string) {
  const workflow = serverEnv('EVOLUS_WORKFLOW_ID')
  if (!evolusConfigured() || !workflow) return { error: 'EVOLUS_WORKFLOW_ID manquant' }
  const body = new FormData()
  body.set('input', input)
  const response = await fetch(`${REST}/workflows/${workflow}/execute`, {
    method: 'POST',
    headers: {
      'X-ApiKey': serverEnv('EVOLUS_API_KEY'),
      'X-Application-Id': serverEnv('EVOLUS_APP_ID'),
    },
    signal: AbortSignal.timeout(20000),
    body,
  })
  if (!response.ok) return { error: `Evolus workflow ${response.status}` }
  return await response.json() as Record<string, unknown>
}
