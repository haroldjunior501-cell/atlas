import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { gatewayUrl } from './config'

const KEYS = {
  userId: 'atlas-user',
  name: 'atlas-name',
  email: 'atlas-email',
  organization: 'atlas-company',
  useCases: 'atlas-use-cases',
} as const

const memory = new Map<string, string>()

export type AuthUser = {
  id: string
  name: string
  email: string
  organization: string
}

export type Session = AuthUser & {
  useCases: string[]
}

async function set(key: string, value: string) {
  if (Platform.OS === 'web') {
    memory.set(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

async function get(key: string) {
  if (Platform.OS === 'web') return memory.get(key) ?? null
  return SecureStore.getItemAsync(key)
}

async function del(key: string) {
  if (Platform.OS === 'web') {
    memory.delete(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}

export async function readSession(): Promise<Session | null> {
  const id = await get(KEYS.userId)
  if (!id) return null
  const useCasesRaw = (await get(KEYS.useCases)) || ''
  return {
    id,
    name: (await get(KEYS.name)) || '',
    email: (await get(KEYS.email)) || '',
    organization: (await get(KEYS.organization)) || '',
    useCases: useCasesRaw.split(',').map((item) => item.trim()).filter(Boolean),
  }
}

export async function saveSession(user: AuthUser, useCases: string[] = []) {
  await set(KEYS.userId, user.id)
  await set(KEYS.name, user.name)
  await set(KEYS.email, user.email)
  await set(KEYS.organization, user.organization)
  if (useCases.length) await set(KEYS.useCases, useCases.join(','))
}

export async function clearSession() {
  await Promise.all(Object.values(KEYS).map((key) => del(key)))
}

export async function currentUserId() {
  return (await get(KEYS.userId)) || null
}

async function authRequest(path: '/v1/auth/register' | '/v1/auth/login', body: Record<string, string>) {
  let response: Response
  try {
    response = await fetch(`${gatewayUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(`PC injoignable (${gatewayUrl}). Même Wi-Fi que l’ordinateur, puis relance Expo.`)
  }
  const payload = (await response.json().catch(() => ({}))) as AuthUser & { error?: string }
  if (!response.ok || !payload.id) {
    throw new Error(payload.error || 'Authentification impossible.')
  }
  return {
    id: payload.id,
    name: payload.name || body.name || '',
    email: payload.email || body.email || '',
    organization: payload.organization || body.organization || '',
  } satisfies AuthUser
}

/** Même endpoint que le Studio Web — un seul compte ATLAS. */
export async function registerAccount(input: {
  name: string
  email: string
  password: string
  organization: string
  useCases?: string[]
}) {
  const user = await authRequest('/v1/auth/register', {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    organization: input.organization.trim(),
  })
  await saveSession(user, input.useCases ?? [])
  return user
}

export async function loginAccount(input: { email: string; password: string }) {
  const user = await authRequest('/v1/auth/login', {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })
  await saveSession(user)
  return user
}
