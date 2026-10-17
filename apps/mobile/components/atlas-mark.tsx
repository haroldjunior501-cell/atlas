import { useEffect, useId, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Contour extérieur du A (triangle). */
const EDGE = 'M16 2.2 L29.4 30.2 L2.6 30.2 Z'
const PERIMETER = 89
const SPARK = 5.5

/** Marque A du site web ATLAS — petite lumière qui circule sur le triangle. */
export function AtlasMark({ size = 72 }: { size?: number }) {
  const uid = useId().replace(/:/g, '')
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [progress])

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -PERIMETER],
  })

  // Position du point lumineux le long des 3 côtés
  const cx = progress.interpolate({
    inputRange: [0, 0.35, 0.65, 1],
    outputRange: [16, 29.4, 2.6, 16],
  })
  const cy = progress.interpolate({
    inputRange: [0, 0.35, 0.65, 1],
    outputRange: [2.2, 30.2, 30.2, 2.2],
  })

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityRole="image" accessibilityLabel="ATLAS">
      <Defs>
        <LinearGradient id={`${uid}a`} x1="4" y1="2" x2="28" y2="31" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#ffc98a" />
          <Stop offset="38%" stopColor="#fd8925" />
          <Stop offset="100%" stopColor="#ff1a08" />
        </LinearGradient>
        <LinearGradient id={`${uid}b`} x1="16" y1="16" x2="16" y2="27" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#ffe3bf" />
          <Stop offset="100%" stopColor="#ff7a32" />
        </LinearGradient>
        <RadialGradient id={`${uid}glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fff6e8" stopOpacity="1" />
          <Stop offset="45%" stopColor="#ffd29a" stopOpacity="0.85" />
          <Stop offset="100%" stopColor="#fd8925" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Path d="M16 2.2 29.4 30.2H22.2L16 15.4 9.8 30.2H2.6Z" fill={`url(#${uid}a)`} />
      <Path d="M16 18 19.4 25.8H12.6Z" fill={`url(#${uid}b)`} />

      <G>
        {/* Traînée douce */}
        <AnimatedPath
          d={EDGE}
          fill="none"
          stroke="#ffe3bf"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeOpacity={0.35}
          strokeDasharray={`${SPARK * 2.2} ${PERIMETER - SPARK * 2.2}`}
          strokeDashoffset={dashOffset}
        />
        {/* Étincelle nette */}
        <AnimatedPath
          d={EDGE}
          fill="none"
          stroke="#fff8f0"
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeOpacity={0.95}
          strokeDasharray={`${SPARK} ${PERIMETER - SPARK}`}
          strokeDashoffset={dashOffset}
        />
        {/* Point lumineux en tête */}
        <AnimatedCircle cx={cx} cy={cy} r={2.1} fill={`url(#${uid}glow)`} />
        <AnimatedCircle cx={cx} cy={cy} r={0.7} fill="#ffffff" />
      </G>
    </Svg>
  )
}
