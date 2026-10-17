import { serverEnv } from './server-env'
import { readOauthApps } from './oauth-apps-store'

/**
 * Origin used for OAuth redirects. Must match Google Cloud authorized URIs exactly.
 * Prefer ATLAS_OAUTH_ORIGIN so Cursor/proxies cannot inject a wrong x-forwarded-host
 * (e.g. localhost:5000 while Next listens on :3000).
 */
export function publicOrigin(request: Request) {
  const stored = readOauthApps() as { ATLAS_OAUTH_ORIGIN?: string }
  const forced = (
    stored.ATLAS_OAUTH_ORIGIN
    || serverEnv('ATLAS_OAUTH_ORIGIN')
    || serverEnv('NEXT_PUBLIC_APP_URL')
    || ''
  ).replace(/\/$/, '')
  if (forced) return forced

  const hostHeader = request.headers.get('host') || 'localhost:3000'
  // On local dev, never trust a forwarded host that disagrees with Host
  const host = hostHeader.includes('localhost') || hostHeader.startsWith('127.')
    ? hostHeader
    : (request.headers.get('x-forwarded-host') || hostHeader)
  const proto = host.includes('localhost') || host.startsWith('127.')
    ? 'http'
    : (request.headers.get('x-forwarded-proto') || 'https')
  return `${proto}://${host}`
}

export function oauthCallbackUrl(request: Request) {
  return `${publicOrigin(request)}/api/atlas/oauth/callback`
}
