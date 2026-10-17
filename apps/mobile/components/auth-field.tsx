import type { ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { colors } from '../lib/theme'

export function AuthField({
  label,
  icon,
  trailing,
  compact,
  ...input
}: {
  label: string
  icon?: ReactNode
  trailing?: ReactNode
  compact?: boolean
} & TextInputProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <TextInput
          placeholderTextColor="rgba(255,255,255,0.32)"
          style={styles.input}
          autoCapitalize="none"
          {...input}
        />
        {trailing}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 8,
  },
  wrapCompact: {
    flex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
  },
  icon: { width: 18, alignItems: 'center' },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    paddingVertical: 4,
  },
})
