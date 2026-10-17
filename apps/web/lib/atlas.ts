export const gatewayUrl = process.env.NEXT_PUBLIC_ATLAS_GATEWAY_URL ?? 'http://localhost:4000'

export async function gateway<T>(path: string, init?: RequestInit): Promise<T> {
  const stored = typeof window === 'undefined' ? null : window.localStorage.getItem('atlas-user')
  const response = await fetch(`${gatewayUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-atlas-user': stored || 'harold',
      ...init?.headers,
    },
  })
  if (!response.ok) throw new Error(`Gateway ${response.status} on ${path}`)
  return response.json() as Promise<T>
}

export const studioNav = [
  { href: '/', label: 'Studio' },
  { href: '/builder', label: 'Organization Builder' },
  { href: '/factory', label: 'Agent Factory' },
  { href: '/permissions', label: 'Permissions' },
  { href: '/knowledge', label: 'Company Knowledge' },
  { href: '/connect', label: 'ATLAS Connect' },
]

export const osNav = [
  { href: '/dashboard', label: 'CEO Dashboard' },
  { href: '/approvals', label: 'Approval Center' },
  { href: '/observability', label: 'Mission Control' },
]
