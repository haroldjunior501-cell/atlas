import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AtlasMark } from '../components/atlas-mark'
import { brandGradient, colors } from '../lib/theme'

export default function WelcomeScreen() {
  const { height } = useWindowDimensions()
  const earthH = Math.min(height * 0.42, 380)
  const brandOffset = Math.round(height * 0.11)

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bg, colors.bg, '#020205']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBlock}>
          <View style={{ height: brandOffset }} />
          <View style={styles.brand}>
            <AtlasMark size={78} />
            <Text style={styles.name}>ATLAS</Text>
            <Text style={styles.tag}>AI ORGANIZATION OS</Text>
          </View>
        </View>

        <View style={[styles.earthWrap, { height: earthH }]}>
          <Image
            source={require('../assets/earth-glow.jpg')}
            style={styles.earth}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={['rgba(5,5,8,0.55)', 'transparent', 'transparent', 'rgba(5,5,8,0.95)']}
            locations={[0, 0.22, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.headline}>
            Votre partenaire{'\n'}numérique de vie
          </Text>
          <Text style={styles.lead}>
            Créez, pilotez, vivez —{'\n'}avec une IA qui vous comprend.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/commencer')}
            style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[...brandGradient]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Commencer  →</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/connexion')}
            style={({ pressed }) => [styles.login, pressed && styles.pressed]}
          >
            <Text style={styles.loginText}>Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  topBlock: {
    flexGrow: 0,
    flexShrink: 0,
  },
  brand: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  name: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 4,
  },
  tag: {
    color: colors.soft,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3.2,
  },
  earthWrap: {
    marginHorizontal: -28,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  earth: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '8%',
    width: '100%',
    height: '120%',
  },
  copy: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
  },
  headline: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  lead: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '400',
  },
  actions: {
    gap: 16,
    paddingBottom: 8,
  },
  ctaWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: colors.brandHot,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cta: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ctaText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  login: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginText: {
    color: colors.link,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
})
