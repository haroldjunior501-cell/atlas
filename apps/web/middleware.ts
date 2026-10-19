import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Origins allowed to call ATLAS APIs from the browser (ZTC / DEVOID / Studio). */
const ALLOWED = [
  'https://ztchosting.com',
  'https://www.ztchosting.com',
  'https://atlast.strimetv.site',
  'https://strimetv.site',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

function allowOrigin(origin: string | null) {
  if (!origin) return null
  if (ALLOWED.includes(origin)) return origin
  if (/^https:\/\/([a-z0-9-]+\.)*ztchosting\.com$/i.test(origin)) return origin
  if (/^https:\/\/([a-z0-9-]+\.)*strimetv\.site$/i.test(origin)) return origin
  if (/^https:\/\/.*\.expo\.dev$/i.test(origin)) return origin
  return null
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowed = allowOrigin(origin)

  if (request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 })
    if (allowed) {
      preflight.headers.set('Access-Control-Allow-Origin', allowed)
      preflight.headers.set('Access-Control-Allow-Credentials', 'true')
      preflight.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      preflight.headers.set(
        'Access-Control-Allow-Headers',
        request.headers.get('access-control-request-headers')
          || 'content-type, authorization, x-atlas-user, x-atlas-bridge',
      )
      preflight.headers.set('Access-Control-Max-Age', '86400')
      preflight.headers.set('Vary', 'Origin')
    }
    return preflight
  }

  const response = NextResponse.next()
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', allowed)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Vary', 'Origin')
  }
  return response
}

export const config = {
  matcher: ['/api/:path*', '/v1/:path*', '/embed/:path*'],
}
