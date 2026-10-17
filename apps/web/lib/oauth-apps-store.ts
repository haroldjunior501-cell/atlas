import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type OauthAppSecrets = Record<string, string | undefined>

function filePath() {
  const candidates = [
    join(process.cwd(), 'data', 'oauth-apps.json'),
    join(process.cwd(), '..', '..', 'data', 'oauth-apps.json'),
  ]
  return candidates.find((item) => existsSync(dirname(item))) ?? candidates[0]!
}

export function readOauthApps(): OauthAppSecrets {
  const path = filePath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as OauthAppSecrets
  } catch {
    return {}
  }
}

export function writeOauthApps(patch: OauthAppSecrets): OauthAppSecrets {
  const path = filePath()
  mkdirSync(dirname(path), { recursive: true })
  const next = { ...readOauthApps(), ...patch }
  for (const key of Object.keys(next)) {
    if (!String(next[key] ?? '').trim()) delete next[key]
  }
  writeFileSync(path, JSON.stringify(next, null, 2))
  for (const [key, value] of Object.entries(next)) {
    if (value) process.env[key] = value
  }
  return next
}

export function oauthAppStatus() {
  const stored = readOauthApps()
  const envOr = (key: string) => process.env[key] || stored[key] || ''
  return {
    googleReady: Boolean(envOr('GOOGLE_CLIENT_ID') && envOr('GOOGLE_CLIENT_SECRET')),
    microsoftReady: Boolean(envOr('MICROSOFT_CLIENT_ID') && envOr('MICROSOFT_CLIENT_SECRET')),
    githubReady: Boolean(envOr('GITHUB_CLIENT_ID') && envOr('GITHUB_CLIENT_SECRET')),
    slackReady: Boolean(envOr('SLACK_CLIENT_ID') && envOr('SLACK_CLIENT_SECRET')),
    hubUrl: envOr('ATLAS_MCP_HUB_URL'),
    redirectUri: '',
    hasGoogleId: Boolean(envOr('GOOGLE_CLIENT_ID')),
    hasGoogleSecret: Boolean(envOr('GOOGLE_CLIENT_SECRET')),
    hasMicrosoftId: Boolean(envOr('MICROSOFT_CLIENT_ID')),
    hasMicrosoftSecret: Boolean(envOr('MICROSOFT_CLIENT_SECRET')),
  }
}
