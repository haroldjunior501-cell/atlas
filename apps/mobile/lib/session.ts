import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as SecureStore from 'expo-secure-store'
import { gatewayUrl } from './config'

const BLOB_KEY = 'atlas-session-v1'
const LEGACY = {
  userId: 'atlas-user',
  name: 'atlas-name',
  email: 'atlas-email',
  organization: 'atlas-company',
  useCases: 'atlas-use-cases',
} as const

const FILE = `${FileSystem.documentDirectory || ''}atlas-session.json`
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

function parseSession(raw: string | null | undefined): Session | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Session>
    if (!parsed?.id) return null
    return {
      id: String(parsed.id),
      name: String(parsed.name || ''),
      email: String(parsed.email || ''),
      organization: String(parsed.organization || ''),
      useCases: Array.isArray(parsed.useCases)
        ? parsed.useCases.map((item) => String(item).trim()).filter(Boolean)
        : String(parsed.useCases || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
    }
  } catch {
    return null
  }
}

async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    memory.set(key, value)
    return
  }
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    /* Expo Go / appareil sans coffre — le fichier prend le relais */
  }
}

async function secureGet(key: string) {
  if (Platform.OS === 'web') return memory.get(key) ?? null
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function secureDel(key: string) {
  if (Platform.OS === 'web') {
    memory.delete(key)
    return
  }
  try {
    await SecureStore.deleteItemAsync(key)
  } catch { /* ignore */ }
}

async function fileWrite(raw: string) {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return
  try {
    await FileSystem.writeAsStringAsync(FILE, raw)
  } catch { /* ignore */ }
}

async function fileRead() {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null
  try {
    const info = await FileSystem.getInfoAsync(FILE)
    if (!info.exists) return null
    return await FileSystem.readAsStringAsync(FILE)
  } catch {
    return null
  }
}

async function fileClear() {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return
  try {
    const info = await FileSystem.getInfoAsync(FILE)
    if (info.exists) await FileSystem.deleteAsync(FILE)
  } catch { /* ignore */ }
}

async function readLegacy(): Promise<Session | null> {
  const id = await secureGet(LEGACY.userId)
  if (!id) return null
  const useCasesRaw = (await secureGet(LEGACY.useCases)) || ''
  return {
    id,
    name: (await secureGet(LEGACY.name)) || '',
    email: (await secureGet(LEGACY.email)) || '',
    organization: (await secureGet(LEGACY.organization)) || '',
    useCases: useCasesRaw.split(',').map((item) => item.trim()).filter(Boolean),
  }
}

export async function readSession(): Promise<Session | null> {
  const fromSecure = parseSession(await secureGet(BLOB_KEY))
  if (fromSecure) return fromSecure
  const fromFile = parseSession(await fileRead())
  if (fromFile) {
    // Remet le coffre à jour si le fichier a survécu seul.
    await secureSet(BLOB_KEY, JSON.stringify(fromFile))
    return fromFile
  }
  const legacy = await readLegacy()
  if (legacy) {
    await saveSession(legacy, legacy.useCases)
    return legacy
  }
  return null
}

export async function saveSession(user: AuthUser, useCases: string[] = []) {
  const session: Session = {
    id: user.id,
    name: user.name,
    email: user.email,
    organization: user.organization,
    useCases,
  }
  const raw = JSON.stringify(session)
  await Promise.all([secureSet(BLOB_KEY, raw), fileWrite(raw)])
  // Anciennes clés : garder name/email pour compat, id pour currentUserId rapide.
  await secureSet(LEGACY.userId, user.id)
  await secureSet(LEGACY.name, user.name)
  await secureSet(LEGACY.email, user.email)
  await secureSet(LEGACY.organization, user.organization)
  if (useCases.length) await secureSet(LEGACY.useCases, useCases.join(','))
}

export async function clearSession() {
  await Promise.all([
    secureDel(BLOB_KEY),
    ...Object.values(LEGACY).map((key) => secureDel(key)),
    fileClear(),
  ])
}

export async function currentUserId() {
  const session = await readSession()
  return session?.id || null
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
