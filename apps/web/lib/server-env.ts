import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function serverEnv(name: string): string {
  const current = process.env[name]
  if (current) return current
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
    join(process.cwd(), '..', '..', '.env'),
  ]
  const path = candidates.find((candidate) => existsSync(candidate))
  if (!path) return ''
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(`${name}=`)) continue
    const value = trimmed.slice(name.length + 1).trim()
    process.env[name] = value
    return value
  }
  return ''
}
