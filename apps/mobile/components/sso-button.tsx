import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { colors } from '../lib/theme'

type Provider = 'google' | 'apple' | 'microsoft'

const SHORT: Record<Provider, string> = {
  google: 'Google',
  apple: 'Apple',
  microsoft: 'Microsoft',
}

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === 'google') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z" />
        <Path fill="#34A853" d="M6.6 14.3l-.9.7-2.9 2.2C4.6 20.3 8 22.2 12 22.2c2.4 0 4.4-.8 5.9-2.1l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.5z" />
        <Path fill="#4A90E2" d="M3.8 6.8C2.8 8.6 2.2 10.6 2.2 12.8c0 1.9.5 3.7 1.5 5.2l3.8-2.9c-.4-.9-.6-1.9-.6-2.9 0-1 .2-2 .5-2.9L3.8 6.8z" />
        <Path fill="#FBBC05" d="M12 5.5c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.4 2.6 14.4 1.8 12 1.8 8 1.8 4.6 3.7 2.9 6.8l3.7 2.9C7.3 7.6 9.4 5.5 12 5.5z" />
      </Svg>
    )
  }
  if (provider === 'apple') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path
          fill={colors.ink}
          d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.2-.8-2.2-3.7zM14.3 6.5c.6-.7 1-1.7.9-2.7-.9.1-1.9.6-2.6 1.3-.6.6-1.1 1.6-1 2.6 1 .1 1.9-.5 2.7-1.2z"
        />
      </Svg>
    )
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
      <Rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
      <Rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
      <Rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
    </Svg>
  )
}

export function SsoButton({
  provider,
  onPress,
}: {
  provider: Provider
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continuer avec ${SHORT[provider]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <ProviderIcon provider={provider} />
      <Text style={styles.label}>{SHORT[provider]}</Text>
    </Pressable>
  )
}

export function SsoRow({
  onGoogle,
  onApple,
  onMicrosoft,
}: {
  onGoogle: () => void
  onApple: () => void
  onMicrosoft: () => void
}) {
  return (
    <View style={styles.row}>
      <SsoButton provider="google" onPress={onGoogle} />
      <SsoButton provider="apple" onPress={onApple} />
      <SsoButton provider="microsoft" onPress={onMicrosoft} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pressed: { opacity: 0.85, backgroundColor: 'rgba(255,255,255,0.08)' },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
})
