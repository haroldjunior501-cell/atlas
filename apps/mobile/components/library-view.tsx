import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { LibraryFilter, LibraryItem } from '../lib/library'
import { colors } from '../lib/theme'

const FILTERS: Array<{ id: LibraryFilter; label: string }> = [
  { id: 'all', label: 'Tout' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Vidéos' },
  { id: 'document', label: 'Docs' },
  { id: 'generated', label: 'Générés' },
]

export function LibraryView({
  items,
  pending,
  status,
  onBack,
  onMenu,
  onRefresh,
  onAnalyze,
  onDelete,
}: {
  items: LibraryItem[]
  pending: boolean
  status?: string
  onBack: () => void
  onMenu: () => void
  onRefresh: () => void
  onAnalyze: (item: LibraryItem, ask?: string) => void
  onDelete: (item: LibraryItem) => void
}) {
  const { width } = useWindowDimensions()
  const pad = width > 700 ? Math.max(24, (width - 720) / 2) : 16
  const cols = width >= 900 ? 4 : width >= 700 ? 3 : 2
  const gap = 10
  const cardW = (width - pad * 2 - gap * (cols - 1)) / cols
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [selected, setSelected] = useState<LibraryItem | null>(null)

  const visible =
    filter === 'all'
      ? items
      : filter === 'generated'
        ? items.filter((item) => item.kind === 'generated' || item.source === 'atlas')
        : items.filter((item) => item.kind === filter)

  useEffect(() => {
    onRefresh()
  }, [])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={onBack} style={styles.navBtn} hitSlop={12}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path d="M15.5 5 8 12.5 15.5 20" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Bibliothèque</Text>
        <Pressable onPress={onMenu} style={styles.navBtn} hitSlop={12}>
          <View style={styles.burger}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: pad }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Tout ce que tu importes dans ATLAS (accueil, Fichiers, photo…) et ce qu’Atlas génère — rangé ici automatiquement.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filter, filter === item.id && styles.filterOn]}
            >
              <Text style={[styles.filterText, filter === item.id && styles.filterTextOn]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {status ? <Text style={styles.status}>{status}</Text> : null}

        {!visible.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Rien pour l’instant</Text>
            <Text style={styles.emptyBody}>
              Importe depuis l’accueil ou Fichiers : chaque document, image ou vidéo arrive ici tout seul.
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap }]}>
            {visible.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelected(item)}
                onLongPress={() =>
                  Alert.alert(item.name, 'Que faire ?', [
                    { text: 'Lire / Expliquer', onPress: () => onAnalyze(item) },
                    { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(item) },
                    { text: 'Annuler', style: 'cancel' },
                  ])
                }
                style={[styles.card, { width: cardW }]}
              >
                {item.thumbUri || (item.kind === 'image' || item.kind === 'generated' ? item.uri : null) ? (
                  <Image source={{ uri: item.thumbUri || item.uri }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Text style={styles.thumbLetter}>
                      {item.kind === 'video' ? '▶' : item.kind === 'document' ? 'DOC' : 'A'}
                    </Text>
                  </View>
                )}
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {labelOf(item)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {selected ? (
          <View style={styles.detail}>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <Text style={styles.detailMeta}>{labelOf(selected)}</Text>
            {selected.prompt ? <Text style={styles.detailPrompt}>Prompt : {selected.prompt}</Text> : null}
            <View style={styles.detailActions}>
              <Pressable
                onPress={() => onAnalyze(selected)}
                disabled={pending}
                style={[styles.primary, pending && styles.off]}
              >
                <Text style={styles.primaryText}>
                  {selected.kind === 'video'
                    ? 'Expliquer la vidéo'
                    : selected.kind === 'document'
                      ? 'Lire le document'
                      : 'Analyser'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setSelected(null)} style={styles.ghost}>
                <Text style={styles.ghostText}>Fermer</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function labelOf(item: LibraryItem) {
  if (item.kind === 'generated' || item.source === 'atlas') return 'Généré par Atlas'
  if (item.kind === 'video') return 'Vidéo'
  if (item.kind === 'document') return 'Document'
  if (item.source === 'camera') return 'Photo'
  return 'Image'
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  burger: { width: 16, gap: 4, alignItems: 'flex-end' },
  burgerLine: { height: 1.6, width: 16, backgroundColor: '#fff', borderRadius: 1 },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { paddingBottom: 48, gap: 14 },
  intro: { color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 20 },
  filters: { gap: 8, paddingRight: 8 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterOn: { backgroundColor: 'rgba(37,99,235,0.35)', borderColor: 'rgba(59,130,246,0.5)' },
  filterText: { color: 'rgba(255,255,255,0.55)', fontWeight: '600', fontSize: 13 },
  filterTextOn: { color: '#fff' },
  status: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19 },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  emptyBody: {
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: '#121212',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 10,
  },
  thumb: { width: '100%', aspectRatio: 1, backgroundColor: '#1a1a1a' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbLetter: { color: '#93c5fd', fontWeight: '800', fontSize: 18 },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 8, paddingHorizontal: 10 },
  cardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, paddingHorizontal: 10 },
  detail: {
    marginTop: 8,
    backgroundColor: '#161616',
    borderRadius: 18,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  detailTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  detailMeta: { color: colors.link, fontSize: 13 },
  detailPrompt: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 18 },
  detailActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  primary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  ghost: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: '#dbeafe', fontWeight: '600' },
  off: { opacity: 0.5 },
})
