import { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { UseCase } from '../lib/use-cases'
import { brandGradient, colors } from '../lib/theme'
import { UseCaseIcon } from './use-case-icon'

export function UseCaseCard({
  item,
  selected,
  index,
  onPress,
}: {
  item: UseCase
  selected: boolean
  index: number
  onPress: () => void
}) {
  const enter = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      delay: 80 + index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [enter, index])

  useEffect(() => {
    if (!selected) {
      pulse.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [selected, pulse])

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] })
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] })

  const inner = (
    <View style={[styles.inner, selected && styles.innerOn]}>
      <View style={[styles.iconWrap, selected && styles.iconOn]}>
        <UseCaseIcon id={item.id} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label} numberOfLines={2}>{item.label}</Text>
        <Text style={styles.hint} numberOfLines={1}>{item.hint}</Text>
      </View>
      <View style={[styles.dot, selected && styles.dotOn]} />
    </View>
  )

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {selected ? (
          <View>
            <Animated.View style={[styles.glow, { opacity: glowOpacity }]} pointerEvents="none" />
            <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.border}>
              {inner}
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.borderIdle}>{inner}</View>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  glow: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 10,
    bottom: 0,
    borderRadius: 22,
    backgroundColor: colors.brandMid,
    shadowColor: colors.brandHot,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  border: {
    borderRadius: 20,
    padding: 1.5,
  },
  borderIdle: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18.5,
    backgroundColor: '#0c0c10',
  },
  innerOn: {
    backgroundColor: '#12080c',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconOn: {
    backgroundColor: 'rgba(253,137,37,0.18)',
  },
  copy: { flex: 1, gap: 3 },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  hint: {
    color: colors.soft,
    fontSize: 12,
    lineHeight: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  dotOn: {
    backgroundColor: colors.brandMid,
    borderColor: colors.brandStart,
  },
})
