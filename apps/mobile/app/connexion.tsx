import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { AtlasMark } from '../components/atlas-mark'
import { AuthField } from '../components/auth-field'
import { SsoRow } from '../components/sso-button'
import { brandGradient, colors } from '../lib/theme'
import { loginAccount, readSession, saveSession } from '../lib/session'

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export default function ConnexionScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [booting, setBooting] = useState(true)

  const ready = validEmail(email) && password.trim().length >= 8

  useEffect(() => {
    let live = true
    void (async () => {
      const session = await readSession()
      if (!live) return
      if (session?.id) {
        router.replace('/home')
        return
      }
      if (session?.email) setEmail(session.email)
      setBooting(false)
    })()
    return () => { live = false }
  }, [])

  async function submit() {
    if (!ready || pending) return
    setPending(true)
    setError('')
    try {
      await loginAccount({ email, password })
      router.replace('/home')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connexion impossible.'
      if (/injoignable|Network|Failed|fetch/i.test(message)) {
        const localName = email.trim().split('@')[0] || 'Toi'
        await saveSession({ id: `phone:${email.trim().toLowerCase()}`, name: localName, email: email.trim().toLowerCase(), organization: '' })
        router.replace('/home')
        return
      }
      setError(message)
      setPending(false)
    }
  }

  if (booting) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <LinearGradient colors={[colors.bg, '#09060a']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={colors.link} />
      </View>
    )
  }

  function ssoSoon(provider: string) {
    Alert.alert('Bientôt', `${provider} partagera le même compte Web / Mobile.`)
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.bg, '#09060a']} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(253,137,37,0.14)', 'transparent']}
        style={styles.planet}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={styles.navBrand}>
            <AtlasMark size={20} />
            <Text style={styles.navTitle}>ATLAS</Text>
          </View>
          <View style={styles.navSpacer} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Se connecter</Text>
              <Text style={styles.lead}>Le même compte que le Studio Web.</Text>
            </View>

            <View style={styles.form}>
              <AuthField
                label="E-mail"
                value={email}
                onChangeText={(value) => { setEmail(value); setError('') }}
                keyboardType="email-address"
                autoComplete="email"
                placeholder="exemple@domaine.com"
                icon={
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path d="M4 7.5h16v9H4v-9Z" stroke="rgba(255,255,255,0.4)" strokeWidth={1.6} fill="none" />
                    <Path d="M4.5 8l7.5 5.2L19.5 8" stroke="rgba(255,255,255,0.4)" strokeWidth={1.6} fill="none" />
                  </Svg>
                }
              />
              <AuthField
                label="Mot de passe"
                value={password}
                onChangeText={(value) => { setPassword(value); setError('') }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="Ton mot de passe"
                icon={
                  <Svg width={16} height={16} viewBox="0 0 24 24">
                    <Path d="M7 11V8.5a5 5 0 0 1 10 0V11" stroke="rgba(255,255,255,0.4)" strokeWidth={1.6} fill="none" />
                    <Path d="M6 11h12v9H6v-9Z" stroke="rgba(255,255,255,0.4)" strokeWidth={1.6} fill="none" />
                  </Svg>
                }
                trailing={
                  <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={10}>
                    <Text style={styles.eye}>{showPassword ? 'Masquer' : 'Voir'}</Text>
                  </Pressable>
                }
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>ou continuer avec</Text>
              <View style={styles.line} />
            </View>

            <SsoRow
              onGoogle={() => ssoSoon('Google')}
              onApple={() => ssoSoon('Apple')}
              onMicrosoft={() => ssoSoon('Microsoft')}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={!ready || pending}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.ctaWrap,
                pressed && ready && !pending && styles.pressed,
              ]}
            >
              <LinearGradient
                colors={ready ? [...brandGradient] : ['#2a2428', '#221c20']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.cta}
              >
                {pending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.ctaText, !ready && styles.ctaTextOff]}>Ouvrir ATLAS  →</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => router.push('/commencer')} style={styles.switch}>
              <Text style={styles.switchText}>
                Pas encore de compte ? <Text style={styles.switchLink}>Commencer</Text>
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  planet: {
    position: 'absolute',
    top: -80,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  safe: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '300' },
  navBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  navTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  navSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 16,
  },
  header: { alignItems: 'center', gap: 8 },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  lead: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  form: { gap: 10 },
  eye: { color: colors.link, fontSize: 12, fontWeight: '700' },
  error: {
    color: '#fb7185',
    backgroundColor: 'rgba(251,113,133,0.12)',
    padding: 12,
    borderRadius: 12,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  or: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(5,5,8,0.92)',
  },
  ctaWrap: { borderRadius: 999, overflow: 'hidden' },
  cta: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  ctaTextOff: { color: 'rgba(255,255,255,0.35)' },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  switch: { alignItems: 'center', paddingBottom: 4 },
  switchText: { color: colors.muted, fontSize: 14 },
  switchLink: { color: colors.link, fontWeight: '700' },
})
