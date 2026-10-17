import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { oauthAppStatus, readOauthApps, writeOauthApps } from '@/lib/oauth-apps-store'
import { oauthCallbackUrl } from '@/lib/public-origin'

function syncEnvFile(keys: Record<string, string>) {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '..', '.env'),
  ]
  const path = candidates.find((item) => existsSync(item)) ?? candidates[0]!
  let text = existsSync(path) ? readFileSync(path, 'utf8') : ''
  for (const [key, value] of Object.entries(keys)) {
    if (!value) continue
    const line = `${key}=${value}`
    if (new RegExp(`^${key}=`, 'm').test(text)) {
      text = text.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    } else {
      text = `${text.trimEnd()}\n${line}\n`
    }
    process.env[key] = value
  }
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`)
}

export async function GET(request: Request) {
  const status = oauthAppStatus()
  return Response.json({
    ...status,
    redirectUri: oauthCallbackUrl(request),
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    microsoftConsoleUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    enableApis: [
      'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
      'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
      'https://console.cloud.google.com/apis/library/drive.googleapis.com',
    ],
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
    ],
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, string | undefined> | null
  const patch: Record<string, string> = {}
  for (const [key, raw] of Object.entries(body ?? {})) {
    const value = String(raw ?? '').trim()
    if (value) patch[key] = value
  }
  if (!Object.keys(patch).length) {
    return Response.json({ error: 'Indiquez au moins une clé (Google, Microsoft, ou URL MCP hub).' }, { status: 400 })
  }
  writeOauthApps(patch)
  syncEnvFile(patch)
  const status = oauthAppStatus()
  return Response.json({
    ok: true,
    ...status,
    redirectUri: oauthCallbackUrl(request),
    stored: Object.keys(readOauthApps()),
  })
}
