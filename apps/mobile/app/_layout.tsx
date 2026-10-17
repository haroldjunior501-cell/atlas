import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { colors } from '../lib/theme'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="commencer" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="inscription" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="connexion" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="home" options={{ animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  )
}
