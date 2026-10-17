import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import type { ConnectorDescriptor } from '../lib/plugins'
import {
  authorizeConnect,
  fetchConnectLinks,
  linkedProvidersOf,
  saveConnectMcp,
  saveConnectToken,
  type ConnectField,
  type ConnectLink,
} from '../lib/connect'
import { PluginMark } from './plugin-mark'

export function PluginConnectModal({
  app,
  organizationId,
  linked,
  visible,
  onClose,
  onLinks,
  onOpenApp,
}: {
  app: ConnectorDescriptor | null
  organizationId: string | null
  linked: boolean
  visible: boolean
  onClose: () => void
  onLinks: (links: ConnectLink[]) => void
  onOpenApp: (provider: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [setup, setSetup] = useState<'token' | 'mcp' | 'oauth' | null>(null)
  const [fields, setFields] = useState<ConnectField[]>([])
  const [hint, setHint] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!visible) {
      setBusy(false)
      setMessage('')
      setSetup(null)
      setFields([])
      setHint('')
      setValues({})
    }
  }, [visible, app?.provider])

  if (!app) return null

  async function continueConnect() {
    if (!organizationId) {
      setMessage('Ouvre le Studio sur le PC et choisis une organisation, puis réessaie.')
      return
    }
    setBusy(true)
    setMessage('')
    setSetup(null)
    try {
      const current = await fetchConnectLinks(organizationId)
      onLinks(current)
      if (linkedProvidersOf(current).has(app!.provider)) {
        setMessage('Déjà connecté.')
        onOpenApp(app!.provider)
        onClose()
        return
      }
      const result = await authorizeConnect(organizationId, app!.provider)
      if (result.links) onLinks(result.links)
      if (result.method === 'connected' && result.ok) {
        setMessage('Connecté.')
        onOpenApp(app!.provider)
        onClose()
        return
      }
      if (result.startUrl) {
        await Linking.openURL(result.startUrl)
        setMessage('Autorise l’accès dans le navigateur, puis reviens et appuie encore sur Continuer.')
        return
      }
      if (result.method === 'setup' && result.setup) {
        setSetup(result.setup === 'oauth' ? 'oauth' : result.setup)
        setHint(result.hint || '')
        setFields(result.fields || [])
        if (result.setup === 'oauth') {
          setMessage(
            result.envKeys?.length
              ? `Configure ${result.envKeys.join(' / ')} dans le Studio, puis réessaie.`
              : result.hint || 'Configuration OAuth requise sur le Studio.',
          )
        }
        return
      }
      setMessage(result.error || 'Connexion impossible. Vérifie que le Studio tourne sur le PC.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Studio injoignable.')
    } finally {
      setBusy(false)
    }
  }

  async function submitSetup() {
    if (!organizationId || !app) return
    setBusy(true)
    setMessage('')
    try {
      if (setup === 'mcp') {
        const url = (values.url || '').trim()
        if (!url) {
          setMessage('URL MCP requise.')
          return
        }
        const body = await saveConnectMcp(organizationId, app.provider, url, (values.token || '').trim() || undefined)
        if (body.links) onLinks(body.links)
        setMessage('Connecté.')
        setSetup(null)
        onOpenApp(app.provider)
        onClose()
        return
      }
      if (setup === 'token') {
        const secrets: Record<string, string> = {}
        for (const field of fields) {
          const value = (values[field.key] || '').trim()
          if (!value) {
            setMessage(`Champ requis : ${field.label}`)
            return
          }
          secrets[field.key] = value
        }
        const body = await saveConnectToken(organizationId, app.provider, secrets)
        if (body.links) onLinks(body.links)
        setMessage('Connecté.')
        setSetup(null)
        onOpenApp(app.provider)
        onClose()
        return
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Échec de la connexion.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Pressable onPress={onClose} style={styles.close} hitSlop={12}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M6 6l12 12M18 6 6 18" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>

          <View style={styles.logos}>
            <AtlasMark />
            <Text style={styles.dots}>···</Text>
            <PluginMark provider={app.provider} label={app.label} size={52} />
          </View>

          <Text style={styles.title}>{linked ? app.label : `Connecter ${app.label}`}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.box} showsVerticalScrollIndicator={false}>
            <Text style={styles.blockTitle}>Vous avez la main</Text>
            <Text style={styles.blockBody}>
              Atlas respecte tes préférences. Tu décides quelles applications relier, et tu peux les déconnecter à tout moment depuis le Studio.
            </Text>

            <Text style={styles.blockTitle}>L’utilisation d’applications peut comporter des risques</Text>
            <Text style={styles.blockBody}>
              Atlas est conçu pour protéger tes données. Relier {app.label} autorise Atlas à agir via cet outil externe sur le PC où tourne le Studio.
            </Text>

            <Text style={styles.blockTitle}>Données partagées avec cette application</Text>
            <Text style={styles.blockBody}>
              (1) Infos de session Studio (organisation, utilisateur). (2) Le contexte de ta demande pour exécuter l’action (
              {app.capabilities.slice(0, 3).join(', ')}
              ).
            </Text>

            {setup === 'token' || setup === 'mcp' ? (
              <View style={styles.setup}>
                {hint ? <Text style={styles.hint}>{hint}</Text> : null}
                {(setup === 'mcp'
                  ? [
                      { key: 'url', label: 'URL MCP', placeholder: 'https://…/mcp' },
                      { key: 'token', label: 'Token Bearer (optionnel)', placeholder: 'optionnel', secret: true },
                    ]
                  : fields
                ).map((field) => (
                  <View key={field.key} style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      style={styles.field}
                      value={values[field.key] || ''}
                      onChangeText={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
                      placeholder={field.placeholder}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      secureTextEntry={Boolean(field.secret)}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ScrollView>

          {setup === 'token' || setup === 'mcp' ? (
            <Pressable
              onPress={() => void submitSetup()}
              disabled={busy}
              style={({ pressed }) => [styles.cta, busy && styles.off, pressed && styles.pressed]}
            >
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>Enregistrer la connexion</Text>}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void continueConnect()}
              disabled={busy}
              style={({ pressed }) => [styles.cta, busy && styles.off, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.ctaText}>
                  {linked ? `Ouvrir ${app.label}` : `Continuer vers ${app.label} ↗`}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  )
}

function AtlasMark() {
  return (
    <View style={styles.atlasMark}>
      <Svg width={34} height={34} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="atlasA" x1="4" y1="2" x2="28" y2="31" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#ffc98a" />
            <Stop offset="38%" stopColor="#fd8925" />
            <Stop offset="100%" stopColor="#ff1a08" />
          </LinearGradient>
          <LinearGradient id="atlasB" x1="16" y1="16" x2="16" y2="27" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#ffe3bf" />
            <Stop offset="100%" stopColor="#ff7a32" />
          </LinearGradient>
        </Defs>
        <Path d="M16 2.2 29.4 30.2H22.2L16 15.4 9.8 30.2H2.6Z" fill="url(#atlasA)" />
        <Path d="M16 18 19.4 25.8H12.6Z" fill="url(#atlasB)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    backgroundColor: '#1a1a1a',
    borderRadius: 28,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  dots: { color: 'rgba(255,255,255,0.35)', fontSize: 22, letterSpacing: 2 },
  atlasMark: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(253,137,37,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  scroll: { flexGrow: 0 },
  box: {
    backgroundColor: '#242424',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    gap: 10,
  },
  blockTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 4 },
  blockBody: { color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 21 },
  setup: { gap: 10, marginTop: 8 },
  hint: { color: '#93c5fd', fontSize: 13, lineHeight: 18 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  field: {
    borderRadius: 12,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  message: { color: '#fbbf24', fontSize: 13, lineHeight: 18, marginTop: 6 },
  cta: {
    marginTop: 16,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '700' },
  off: { opacity: 0.55 },
  pressed: { opacity: 0.9 },
})
