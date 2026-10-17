import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { ConnectorDescriptor } from '../lib/plugins'
import { featuredPlugins, pluginBlurb, pluginsByCategory } from '../lib/plugins'
import { PluginMark } from './plugin-mark'

export function PluginGalleryView({
  linked,
  onBack,
  onMenu,
  onOpen,
  onConnect,
}: {
  linked: Set<string>
  onBack: () => void
  onMenu: () => void
  onOpen: (app: ConnectorDescriptor) => void
  onConnect: (app: ConnectorDescriptor) => void
}) {
  const { width } = useWindowDimensions()
  const pad = width > 900 ? Math.max(32, (width - 840) / 2) : width > 700 ? 28 : 16
  const cols = width >= 900 ? 3 : 2
  const gap = 10
  const cardW = (width - pad * 2 - gap * (cols - 1)) / cols
  const featured = featuredPlugins()
  const groups = pluginsByCategory()

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={onBack} style={styles.navBtn} hitSlop={12}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path d="M15.5 5 8 12.5 15.5 20" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Plugins</Text>
        <Pressable onPress={onMenu} style={styles.navBtn} hitSlop={12}>
          <View style={styles.burger}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingHorizontal: pad }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>Studio ATLAS</Text>
        <Text style={styles.intro}>Appuie sur + pour connecter une app. Ensuite Atlas peut l’utiliser vraiment.</Text>

        <Section title="Les plus utilisés" items={featured} linked={linked} cardW={cardW} gap={gap} onOpen={onOpen} onConnect={onConnect} />
        {groups.map((group) => (
          <Section
            key={group.category}
            title={group.title}
            items={group.items}
            linked={linked}
            cardW={cardW}
            gap={gap}
            onOpen={onOpen}
            onConnect={onConnect}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({
  title,
  items,
  linked,
  cardW,
  gap,
  onOpen,
  onConnect,
}: {
  title: string
  items: ConnectorDescriptor[]
  linked: Set<string>
  cardW: number
  gap: number
  onOpen: (app: ConnectorDescriptor) => void
  onConnect: (app: ConnectorDescriptor) => void
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionChev}>›</Text>
      </View>
      <View style={[styles.grid, { gap }]}>
        {items.map((item) => {
          const isLinked = linked.has(item.provider)
          return (
            <Pressable
              key={item.provider}
              onPress={() => (isLinked ? onOpen(item) : onConnect(item))}
              style={({ pressed }) => [styles.card, { width: cardW }, pressed && styles.pressed]}
            >
              <PluginMark provider={item.provider} label={item.label} size={48} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.cardHint} numberOfLines={1}>
                  {isLinked ? 'Connecté' : pluginBlurb(item)}
                </Text>
              </View>
              {isLinked ? (
                <View style={styles.check}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path d="M5 12.5 10 17.5 19 7" stroke="#22c55e" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              ) : (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation?.()
                    onConnect(item)
                  }}
                  hitSlop={8}
                  style={styles.plus}
                >
                  <Text style={styles.plusText}>+</Text>
                </Pressable>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
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
  list: { paddingTop: 4, paddingBottom: 56, gap: 26 },
  kicker: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  intro: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 22, marginTop: -12 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionChev: { color: 'rgba(255,255,255,0.35)', fontSize: 22, marginTop: -2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#121212',
    borderRadius: 18,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minHeight: 76,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardHint: { color: 'rgba(255,255,255,0.42)', fontSize: 12 },
  plus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: '#fff', fontSize: 20, fontWeight: '400', marginTop: -1 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
})
