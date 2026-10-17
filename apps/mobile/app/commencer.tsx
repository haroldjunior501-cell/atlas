import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AtlasMark } from '../components/atlas-mark'
import { UseCaseCard } from '../components/use-case-card'
import { brandGradient, colors } from '../lib/theme'
import { USE_CASES, type UseCaseId } from '../lib/use-cases'

export default function CommencerScreen() {
  const [selected, setSelected] = useState<UseCaseId[]>([])
  const header = useRef(new Animated.Value(0)).current
  const cta = useRef(new Animated.Value(0)).current
  const hasSelection = selected.length > 0

  useEffect(() => {
    Animated.timing(header, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [header])

  useEffect(() => {
    Animated.timing(cta, {
      toValue: hasSelection ? 1 : 0.35,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start()
  }, [hasSelection, cta])

  function toggle(id: UseCaseId) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function continueNext() {
    if (!hasSelection) return
    router.push({ pathname: '/inscription', params: { useCases: selected.join(',') } })
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bg, '#0a0608', colors.bg]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(253,137,37,0.12)', 'transparent']}
        style={styles.ambient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.nav,
            {
              opacity: header,
              transform: [{ translateY: header.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
            },
          ]}
        >
          <Pressable onPress={() => router.back()} hitSlop={14} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={styles.navBrand}>
            <AtlasMark size={22} />
            <Text style={styles.navTitle}>ATLAS</Text>
          </View>
          <View style={styles.navSpacer} />
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: header,
              transform: [{ translateY: header.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            <Text style={styles.kicker}>Premier pas</Text>
            <Text style={styles.title}>Où ATLAS peut{'\n'}t’aider aujourd’hui ?</Text>
            <Text style={styles.lead}>
              Coche tout ce qui te parle — un ou plusieurs. Tu pourras ajuster plus tard.
            </Text>
          </Animated.View>

          <View style={styles.list}>
            {USE_CASES.map((item, index) => (
              <UseCaseCard
                key={item.id}
                item={item}
                index={index}
                selected={selected.includes(item.id)}
                onPress={() => toggle(item.id)}
              />
            ))}
          </View>
        </ScrollView>

        <Animated.View style={[styles.footer, { opacity: cta }]}>
          <Pressable
            accessibilityRole="button"
            disabled={!hasSelection}
            onPress={continueNext}
            style={({ pressed }) => [
              styles.ctaWrap,
              !hasSelection && styles.ctaDisabled,
              pressed && hasSelection && styles.pressed,
            ]}
          >
            <LinearGradient
              colors={hasSelection ? [...brandGradient] : ['#3a3034', '#2a2428']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, !hasSelection && styles.ctaTextOff]}>
                {hasSelection
                  ? `Continuer · ${selected.length}  →`
                  : 'Continuer  →'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  ambient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  safe: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.ink, fontSize: 32, lineHeight: 34, fontWeight: '300' },
  navBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', letterSpacing: 2 },
  navSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 18,
  },
  kicker: {
    color: colors.brandMid,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 10,
  },
  lead: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  list: { gap: 10 },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 8,
  },
  ctaWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: colors.brandHot,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaDisabled: { shadowOpacity: 0 },
  cta: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  ctaTextOff: { color: 'rgba(255,255,255,0.35)' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
})
