import type { IncomingMessage, ServerResponse } from 'node:http'

export function actorId(req: IncomingMessage): string | null {
  const header = req.headers['x-atlas-user']
  if (typeof header === 'string' && header.trim()) return header.trim()
  return process.env.ATLAS_DEV_USER ?? null
}

export function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-atlas-user',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  })
  res.end(JSON.stringify(body))
}

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return {} as T
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index]
    const actual = pathParts[index]
    if (!expected || !actual) return null
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual)
    else if (expected !== actual) return null
  }
  return params
}
