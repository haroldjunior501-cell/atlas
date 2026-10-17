import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function candidateEnvPaths(path: string): string[] {
  const cwd = process.cwd()
  return [
    resolve(cwd, path),
    resolve(cwd, '..', '..', path), // services/gateway → monorepo root
    resolve(cwd, '..', path),
  ]
}

export function loadEnv(path = '.env'): void {
  const file = candidateEnvPaths(path).find((candidate) => existsSync(candidate))
  if (!file) return
  try {
    const text = readFileSync(file, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim()
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // A missing .env is valid. The process environment still applies.
  }
}
