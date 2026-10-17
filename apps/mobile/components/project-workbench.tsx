import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { ProjectPack } from '../lib/project-tools'
import { colors } from '../lib/theme'

const STARTERS: Record<string, { run: string; chips: string[]; field: string; cta: string }> = {
  ideas: {
    run: 'Génère 6 idées concrètes, avec un pitch et comment les tester.',
    chips: ['App mobile', 'Startup', 'Outil interne', 'Jeu'],
    field: 'Sujet, public, contrainte…',
    cta: 'Générer 6 idées',
  },
  code: {
    run: 'Écris le code prêt à coller : fichiers complets, comment lancer.',
    chips: ['API REST', 'Script Python', 'Composant React', 'Corriger un bug'],
    field: 'Ce que le code doit faire…',
    cta: 'Écrire le code',
  },
  docs: {
    run: 'Rédige le document complet : titre, sections, contenu utilisable tel quel.',
    chips: ['Cahier des charges', 'Rapport', 'Compte-rendu', 'Pitch deck'],
    field: 'Type de document et sujet…',
    cta: 'Rédiger le document',
  },
  data: {
    run: 'Analyse les données importées : résumé, insights, suite à faire.',
    chips: ['Importer un CSV', 'Tendances', 'Anomalies'],
    field: 'Ce que tu veux savoir sur ces chiffres…',
    cta: 'Analyser',
  },
  design: {
    run: 'Propose une maquette : écrans, blocs, couleurs, hiérarchie.',
    chips: ['App iPad', 'Dashboard', 'Landing', 'Onboarding'],
    field: 'Produit et écrans à concevoir…',
    cta: 'Générer la maquette',
  },
  strategy: {
    run: 'Construis un plan d’action : objectif, étapes, priorités, première action.',
    chips: ['Lancement', '30 jours', 'Équipe', 'Priorités'],
    field: 'Objectif à atteindre…',
    cta: 'Construire le plan',
  },
}

export function ProjectToolView({
  title,
  hint,
  roomId,
  pending,
  status,
  pack,
  filesLabel,
  onBack,
  onMenu,
  onRun,
  onImport,
  onToggleStep,
}: {
  title: string
  hint: string
  roomId: string
  pending: boolean
  status?: string
  pack?: ProjectPack
  filesLabel?: string
  onBack: () => void
  onMenu: () => void
  onRun: (prompt: string) => void
  onImport: () => void
  onToggleStep?: (title: string) => void
}) {
  const [subject, setSubject] = useState('')
  const starter = STARTERS[roomId] || STARTERS.ideas

  function run(extra?: string) {
    const topic = [subject.trim(), extra].filter(Boolean).join('. ')
    onRun(topic ? `${starter.run} Sujet : ${topic}.` : starter.run)
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
      <Text style={styles.toolTitle}>{title}</Text>
      <Text style={styles.toolHint}>{hint}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextInput
            style={styles.field}
            value={subject}
            onChangeText={setSubject}
            placeholder={starter.field}
            placeholderTextColor="rgba(255,255,255,0.38)"
            multiline
          />

          <View style={styles.actions}>
            <Pressable
              onPress={() => (roomId === 'data' && !pack?.table ? onImport() : run())}
              disabled={pending}
              style={({ pressed }) => [styles.primary, pending && styles.off, pressed && styles.pressed]}
            >
              {pending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>
                  {roomId === 'data' && !pack?.table ? 'Importer un CSV' : starter.cta}
                </Text>
              )}
            </Pressable>
            {roomId === 'data' && pack?.table ? (
              <Pressable onPress={onImport} style={styles.ghost}>
                <Text style={styles.ghostText}>Autre fichier</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {starter.chips.map((chip) => (
              <Pressable
                key={chip}
                onPress={() => (chip.startsWith('Importer') ? onImport() : run(chip))}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {filesLabel ? <Text style={styles.files}>{filesLabel}</Text> : null}
          {status && status !== 'Je réfléchis.' ? <Text style={styles.status}>{status}</Text> : null}
          {pending ? <Text style={styles.status}>Atlas exécute l’outil…</Text> : null}

          {pack?.ideas?.length ? (
            <View style={styles.grid}>
              {pack.ideas.map((idea) => (
                <Pressable
                  key={idea.title}
                  onPress={() =>
                    onRun(`Développe cette idée en plan concret, livrable : ${idea.title}. ${idea.pitch}`)
                  }
                  style={styles.card}
                >
                  <Text style={styles.cardTitle}>{idea.title}</Text>
                  {idea.pitch ? <Text style={styles.cardBody}>{idea.pitch}</Text> : null}
                  <Text style={styles.link}>Développer ›</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {pack?.files?.map((file) => (
            <View key={file.name} style={styles.block}>
              <View style={styles.blockHead}>
                <Text style={styles.cardTitle}>{file.name}</Text>
                <Pressable onPress={() => void shareText(file.name, file.content)} style={styles.mini}>
                  <Text style={styles.miniText}>Partager</Text>
                </Pressable>
              </View>
              <Text style={styles.code} selectable>
                {file.content.slice(0, 4000)}
              </Text>
            </View>
          ))}

          {pack?.document ? (
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <Text style={styles.cardTitle}>{pack.document.title}</Text>
                <Pressable
                  onPress={() => void shareText(pack.document!.title, pack.document!.body)}
                  style={styles.mini}
                >
                  <Text style={styles.miniText}>Partager</Text>
                </Pressable>
              </View>
              <Text style={styles.doc} selectable>
                {pack.document.body}
              </Text>
            </View>
          ) : null}

          {pack?.table ? (
            <ScrollView horizontal style={styles.tableWrap}>
              <View>
                <View style={styles.tr}>
                  {pack.table.headers.map((cell) => (
                    <Text key={cell} style={[styles.td, styles.th]}>
                      {cell}
                    </Text>
                  ))}
                </View>
                {pack.table.rows.map((row, i) => (
                  <View key={i} style={styles.tr}>
                    {row.map((cell, j) => (
                      <Text key={`${i}-${j}`} style={styles.td} numberOfLines={2}>
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {pack?.insights?.length ? (
            <View style={styles.block}>
              {pack.insights.map((line) => (
                <Text key={line} style={styles.bullet}>
                  • {line}
                </Text>
              ))}
            </View>
          ) : null}

          {pack?.colors?.length ? (
            <View style={styles.swatches}>
              {pack.colors.map((hex) => (
                <View key={hex} style={styles.swatch}>
                  <View style={[styles.dot, { backgroundColor: safeColor(hex) }]} />
                  <Text style={styles.chipText}>{hex}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {pack?.screens?.map((screen) => (
            <View key={screen.name} style={styles.mock}>
              <Text style={styles.cardTitle}>{screen.name}</Text>
              {screen.blocks.map((block) => (
                <View key={block} style={styles.mockBlock}>
                  <Text style={styles.mockText}>{block}</Text>
                </View>
              ))}
            </View>
          ))}

          {pack?.steps?.length ? (
            <View style={styles.block}>
              {pack.steps.map((step, i) => (
                <Pressable
                  key={`${i}-${step.title}`}
                  onPress={() => onToggleStep?.(step.title)}
                  style={styles.step}
                >
                  <View style={[styles.box, step.done && styles.boxOn]} />
                  <Text style={[styles.stepText, step.done && styles.done]}>{step.title}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

async function shareText(title: string, message: string) {
  await Share.share({ title, message })
}

function safeColor(hex: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : '#3b82f6'
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
  toolTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', paddingHorizontal: 20 },
  toolHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 6,
    marginBottom: 12,
  },
  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
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
  actions: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ghost: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: '#dbeafe', fontWeight: '600' },
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
  files: { color: '#7dd3fc', fontSize: 13 },
  status: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  grid: { gap: 8 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,155,255,0.2)',
  },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 },
  cardBody: { color: '#c9d6ea', marginTop: 6, lineHeight: 20, fontSize: 14 },
  link: { color: '#93c5fd', marginTop: 10, fontWeight: '600' },
  block: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  mini: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.35)',
  },
  miniText: { color: '#dbeafe', fontSize: 12, fontWeight: '700' },
  code: { color: '#bbf7d0', fontFamily: 'Courier', fontSize: 12, lineHeight: 18 },
  doc: { color: '#e2e8f0', fontSize: 14, lineHeight: 22 },
  tableWrap: { maxHeight: 280 },
  tr: { flexDirection: 'row' },
  td: {
    width: 110,
    padding: 8,
    color: '#e2e8f0',
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  th: { color: '#fff', fontWeight: '700', backgroundColor: '#1d4ed8' },
  bullet: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  mock: {
    backgroundColor: '#0b1220',
    borderRadius: 18,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  mockBlock: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  mockText: { color: '#cbd5e1', fontSize: 13 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  boxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  stepText: { color: '#e2e8f0', flex: 1, fontSize: 14 },
  done: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.45)' },
  off: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
})
