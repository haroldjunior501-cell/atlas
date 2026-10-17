import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { ConnectorDescriptor } from '../lib/plugins'
import { colors } from '../lib/theme'
import { PluginMark } from './plugin-mark'

const STARTERS: Record<string, string[]> = {
  gmail: ['Lire mes derniers mails', 'Résumer la boîte de réception', 'Préparer une réponse'],
  outlook: ['Lire les mails', 'Résumer Outlook', 'Préparer un envoi'],
  slack: ['Lire les canaux', 'Préparer un message', 'Résumer le fil'],
  teams: ['Lire Teams', 'Préparer un message'],
  google_calendar: ['Voir aujourd’hui', 'Créer un événement', 'Créneaux libres'],
  outlook_calendar: ['Voir aujourd’hui', 'Créer un événement'],
  github: ['Lister les issues', 'Résumer les PR', 'État du CI'],
  google_drive: ['Lister les fichiers', 'Chercher un document'],
  notion: ['Chercher dans Notion', 'Résumer une page'],
  machine: ['Ouvrir une app', 'Lister les apps', 'Contrôler le bureau'],
  filesystem: ['Lister Bureau', 'Lister Documents', 'Créer un document'],
  stripe: ['Voir les paiements', 'Lister les factures'],
  figma: ['Lister les fichiers', 'Exporter un frame'],
  canva: ['Lister les designs'],
  shopify: ['Catalogue', 'Commandes récentes'],
}

export function PluginToolView({
  app,
  pending,
  status,
  onBack,
  onMenu,
  onRun,
}: {
  app: ConnectorDescriptor
  pending: boolean
  status?: string
  onBack: () => void
  onMenu: () => void
  onRun: (prompt: string) => void
}) {
  const [ask, setAsk] = useState('')
  const chips = STARTERS[app.provider] || app.capabilities.slice(0, 3)

  function run(extra?: string) {
    const text = [ask.trim(), extra].filter(Boolean).join('. ')
    onRun(text || `Utilise ${app.label} : première action utile.`)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={onBack} style={styles.navBtn} hitSlop={10}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 5 8 12l7 7" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.brand}>
          ATL<Text style={styles.brandAccent}>AS</Text>
        </Text>
        <Pressable onPress={onMenu} style={styles.navBtn} hitSlop={10}>
          <View style={styles.burger}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </View>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <PluginMark provider={app.provider} label={app.label} size={56} />
            <Text style={styles.title}>{app.label}</Text>
            <Text style={styles.hint}>{app.hint}</Text>
            <View style={styles.caps}>
              {app.capabilities.map((cap) => (
                <View key={cap} style={styles.cap}>
                  <Text style={styles.capText}>{cap}</Text>
                </View>
              ))}
            </View>
          </View>

          <TextInput
            style={styles.field}
            value={ask}
            onChangeText={setAsk}
            placeholder={`Que faire avec ${app.label} ?`}
            placeholderTextColor="rgba(255,255,255,0.38)"
            multiline
          />

          <Pressable
            onPress={() => run()}
            disabled={pending}
            style={({ pressed }) => [styles.primary, pending && styles.off, pressed && styles.pressed]}
          >
            {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Exécuter via Studio</Text>}
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((chip) => (
              <Pressable key={chip} onPress={() => run(chip)} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {status && status !== 'Je réfléchis.' ? (
            <View style={styles.result}>
              <Text style={styles.resultLabel}>Résultat</Text>
              <Text style={styles.resultText}>{status}</Text>
            </View>
          ) : null}
          {pending ? <Text style={styles.status}>Atlas exécute {app.label}…</Text> : null}

          <Text style={styles.note}>
            La connexion OAuth / token se fait dans le Studio web (Intégrations). Sur mobile, Atlas pilote l’app déjà reliée.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 3 },
  brandAccent: { color: colors.brandMid },
  burger: { width: 18, gap: 4 },
  burgerLine: { height: 1.8, backgroundColor: '#fff', borderRadius: 2 },
  body: { paddingHorizontal: 16, paddingBottom: 36, gap: 14 },
  head: { alignItems: 'center', gap: 8, paddingTop: 8, marginBottom: 4 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 8 },
  caps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  cap: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  capText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  field: {
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: '#141414',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  primary: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: { color: '#cbd5e1', fontSize: 13 },
  result: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  resultLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '700' },
  resultText: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  status: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  note: { color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 18, marginTop: 8 },
  off: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
})
