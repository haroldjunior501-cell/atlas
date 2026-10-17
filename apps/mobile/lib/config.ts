import Constants from 'expo-constants'

function hostFrom(raw: string | undefined | null) {
  if (!raw) return ''
  const cleaned = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').split('/')[0] ?? ''
  const host = cleaned.split(':')[0]?.trim() ?? ''
  if (!host || host === 'localhost' || host === '127.0.0.1') return ''
  return host
}

/** IP du PC telle que le téléphone l’a déjà jointe pour charger Expo. */
function pcHost() {
  const go = Constants.expoGoConfig as { debuggerHost?: string } | null
  return hostFrom(Constants.expoConfig?.hostUri)
    || hostFrom(go?.debuggerHost)
    || hostFrom(Constants.linkingUri)
    || hostFrom(Constants.experienceUrl)
    || ''
}

function origin(port: number, envValue: string | undefined) {
  const host = pcHost()
  if (host) return `http://${host}:${port}`
  if (envValue && !envValue.includes('192.168.1.132')) return envValue
  return `http://10.1.3.23:${port}`
}

export const gatewayUrl = origin(4000, process.env.EXPO_PUBLIC_ATLAS_GATEWAY_URL)
export const webOrigin = origin(3000, process.env.EXPO_PUBLIC_ATLAS_WEB_URL)
