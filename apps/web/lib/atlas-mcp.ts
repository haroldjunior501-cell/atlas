export interface McpTool {
  name: string
  description: string
}

export interface McpResult {
  content: string
  raw: unknown
}

const BLOCKED = new Set(['169.254.169.254', 'metadata.google.internal', '0.0.0.0'])

export function allowedMcpUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (BLOCKED.has(url.hostname.toLowerCase())) return false
    return true
  } catch {
    return false
  }
}

export function isWriteTool(name: string, input = ''): boolean {
  const tool = name.trim()
  // Lecture / brouillon / fichiers locaux du PC : exécution directe (pas d’approbation)
  if (/^(prepare_reply|draft_reply|list_messages|list_events|list_files|list_apps|list_channels|list_repos|get_profile|status|search|Lire|create_document|write_document|read_document|open_file|open_folder|open_app)$/i.test(tool)) {
    return false
  }
  return /send|create|update|delete|post|pay|charge|invite|share|write|remove|deploy|exec|run|patch|insert|publish|reply/i.test(`${tool} ${input}`)
}

export function isUnsafeMachine(input: string): boolean {
  return /rm\s+-rf|mkfs|format\s+|shutdown|reboot|dd\s+if=|fork.?bomb|curl[^\n]+\|\s*(ba)?sh/i.test(input)
}

function parseRpc(text: string): { result?: unknown; error?: { message?: string } } {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Réponse MCP vide.')
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as { result?: unknown; error?: { message?: string } }
  const lines = trimmed.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('data:'))
  for (const line of lines.reverse()) {
    const payload = line.replace(/^data:\s*/, '')
    if (!payload || payload === '[DONE]') continue
    try {
      return JSON.parse(payload) as { result?: unknown; error?: { message?: string } }
    } catch { /* ligne SSE non JSON */ }
  }
  throw new Error('Réponse MCP illisible.')
}

async function rpc(url: string, method: string, params: unknown, token?: string, id = Date.now()): Promise<unknown> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  if (token) headers.authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(14000),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`MCP ${response.status} : ${text.slice(0, 180)}`)
  const body = parseRpc(text)
  if (body.error?.message) throw new Error(body.error.message)
  return body.result
}

export async function mcpInitialize(url: string, token?: string) {
  const result = await rpc(url, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'atlas', version: '0.1.0' },
  }, token, 1)
  await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    signal: AbortSignal.timeout(4000),
  }).catch(() => undefined)
  return result
}

export async function mcpTools(url: string, token?: string): Promise<McpTool[]> {
  const result = await rpc(url, 'tools/list', {}, token, 2) as { tools?: Array<{ name?: string; description?: string }> }
  return (result?.tools ?? []).map((tool) => ({
    name: tool.name ?? '',
    description: tool.description ?? '',
  })).filter((tool) => tool.name)
}

export async function mcpCall(url: string, name: string, args: Record<string, unknown>, token?: string): Promise<McpResult> {
  const result = await rpc(url, 'tools/call', { name, arguments: args }, token, 3) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const content = (result?.content ?? []).map((item) => item.text ?? '').filter(Boolean).join('\n').trim()
  return { content: content || JSON.stringify(result).slice(0, 1200), raw: result }
}
