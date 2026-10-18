import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import type { Place } from '../lib/places'
import { colors } from '../lib/theme'
import type { Session } from '../lib/session'

export type { Place }

const PLACES: Array<{ id: Place; label: string; icon: IconName }> = [
  { id: 'library', label: 'Bibliothèque', icon: 'book' },
  { id: 'study', label: 'Organisation', icon: 'org' },
  { id: 'projects', label: 'Projets', icon: 'folder' },
  { id: 'plugins', label: 'Plugins', icon: 'plugin' },
  { id: 'agenda', label: 'Agenda', icon: 'clock' },
  { id: 'files', label: 'Fichiers', icon: 'file' },
  { id: 'help', label: 'Aide', icon: 'help' },
]

type IconName = 'book' | 'org' | 'folder' | 'plugin' | 'clock' | 'file' | 'gear' | 'help' | 'out'

export function HomeDrawer({
  open,
  session,
  place,
  onClose,
  onLogout,
  onPlace,
}: {
  open: boolean
  session: Session
  place: Place
  onClose: () => void
  onLogout: () => void
  onPlace: (place: Place) => void
}) {
  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.panel} edges={['top', 'bottom', 'left']}>
          <Text style={styles.brand}>
            ATL<Text style={styles.brandAccent}>AS</Text>
          </Text>
          <Text style={styles.who}>{session.name}</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listInner} showsVerticalScrollIndicator={false}>
            {PLACES.map((item) => {
              const active = item.id === place
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onPlace(item.id)}
                  style={({ pressed }) => [styles.row, active && styles.rowOn, pressed && styles.pressed]}
                >
                  <View style={styles.iconSlot}>
                    <NavIcon name={item.icon} />
                  </View>
                  <Text style={[styles.label, active && styles.labelOn]}>{item.label}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={styles.foot}>
            <Pressable
              onPress={onLogout}
              style={({ pressed }) => [styles.row, styles.logout, pressed && styles.pressed]}
            >
              <View style={styles.iconSlot}>
                <NavIcon name="out" />
              </View>
              <Text style={styles.label}>Déconnexion</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Paramètres"
              onPress={() => onPlace('settings')}
              style={({ pressed }) => [styles.gearBtn, place === 'settings' && styles.gearBtnOn, pressed && styles.pressed]}
            >
              <NavIcon name="gear" />
            </Pressable>
          </View>
        </SafeAreaView>
        <Pressable style={styles.dim} onPress={onClose} />
      </View>
    </Modal>
  )
}

const STROKE = {
  stroke: '#f2f2f2',
  strokeWidth: 1.75,
  fill: 'none' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function NavIcon({ name }: { name: IconName }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'book' ? (
        <>
          <Path d="M12 7v13" {...STROKE} />
          <Path d="M4 19V5h5a3 3 0 0 1 3 3" {...STROKE} />
          <Path d="M20 19V5h-5a3 3 0 0 0-3 3" {...STROKE} />
        </>
      ) : null}
      {name === 'org' ? (
        <>
          <Path d="M4 20V10" {...STROKE} />
          <Path d="M10 20V4" {...STROKE} />
          <Path d="M16 20v-7" {...STROKE} />
          <Path d="M3 20h18" {...STROKE} />
        </>
      ) : null}
      {name === 'folder' ? (
        <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" {...STROKE} />
      ) : null}
      {name === 'plugin' ? (
        <>
          <Circle cx="12" cy="12" r="9" {...STROKE} />
          <Path d="M16 8a4 4 0 1 0 .2 5.5" {...STROKE} />
          <Path d="M16 8v4a2 2 0 0 0 4 0" {...STROKE} />
        </>
      ) : null}
      {name === 'clock' ? (
        <>
          <Circle cx="12" cy="12" r="9" {...STROKE} />
          <Path d="M12 7v6l4 2" {...STROKE} />
        </>
      ) : null}
      {name === 'file' ? (
        <>
          <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" {...STROKE} />
          <Path d="M14 3v6h6" {...STROKE} />
        </>
      ) : null}
      {name === 'gear' ? (
        <>
          <Circle cx="12" cy="12" r="3" {...STROKE} />
          <Path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" {...STROKE} />
        </>
      ) : null}
      {name === 'help' ? (
        <>
          <Circle cx="12" cy="12" r="9" {...STROKE} />
          <Path d="M9.2 9.2a2.8 2.8 0 1 1 3.4 2.7c-.8.3-1.3.9-1.3 1.7V14.2" {...STROKE} />
          <Path d="M12 17.2h.01" {...STROKE} />
        </>
      ) : null}
      {name === 'out' ? (
        <>
          <Path d="M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...STROKE} />
          <Path d="M16 17l5-5-5-5" {...STROKE} />
          <Path d="M21 12H10" {...STROKE} />
        </>
      ) : null}
    </Svg>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: 'row' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    width: '78%',
    maxWidth: 320,
    backgroundColor: '#000',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  brand: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 3, marginBottom: 2 },
  brandAccent: { color: colors.brandMid },
  who: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 22 },
  list: { flex: 1 },
  listInner: { gap: 2, paddingBottom: 12 },
  iconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowOn: { backgroundColor: 'rgba(255,255,255,0.08)' },
  label: { color: '#fff', fontSize: 17, fontWeight: '500' },
  labelOn: { fontWeight: '700' },
  pressed: { opacity: 0.7 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  logout: { flex: 1, paddingHorizontal: 0 },
  gearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearBtnOn: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.08)' },
})
