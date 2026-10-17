import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import type { PlaceHub, PlaceRoom, RoomMark } from '../lib/places'

export function PlaceHubView({
  hub,
  onBack,
  onMenu,
  onRoom,
}: {
  hub: PlaceHub
  onBack: () => void
  onMenu: () => void
  onRoom: (room: PlaceRoom) => void
}) {
  const { width } = useWindowDimensions()
  const pad = width > 700 ? Math.max(28, (width - 640) / 2) : 18

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={onBack} style={styles.navBtn} hitSlop={12}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path d="M15.5 5 8 12.5 15.5 20" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>{hub.title}</Text>
        <Pressable onPress={onMenu} style={styles.navBtn} hitSlop={12}>
          <View style={styles.burger}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingHorizontal: pad }]} showsVerticalScrollIndicator={false}>
        {hub.variant === 'list' ? (
          <View style={styles.sheet}>
            {hub.rooms.map((room, index) => (
              <Pressable
                key={room.id}
                onPress={() => onRoom(room)}
                style={({ pressed }) => [styles.sheetRow, index < hub.rooms.length - 1 && styles.sheetLine, pressed && styles.pressed]}
              >
                <View style={[styles.listIcon, { backgroundColor: room.color }]}>
                  <Mark name={room.mark} size={20} />
                </View>
                <Text style={styles.sheetTitle}>{room.title}</Text>
                <Text style={styles.sheetChev}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          hub.rooms.map((room) => (
            <Pressable key={room.id} onPress={() => onRoom(room)} style={({ pressed }) => [pressed && styles.pressed]}>
              <LinearGradient colors={room.tone} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                <View style={styles.iconWrap}>
                  <Mark name={room.mark} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.cardTitle}>{room.title}</Text>
                  <Text style={styles.cardHint} numberOfLines={2}>
                    {room.hint}
                  </Text>
                  <View style={styles.tags}>
                    {room.tags.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Mark({ name, size = 26 }: { name: RoomMark; size?: number }) {
  if (name === 'quiz') {
    return <Text style={[styles.quizMark, size < 24 && { fontSize: 20, lineHeight: 22 }]}>?</Text>
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'book' ? (
        <Path
          fill="#fff"
          fillRule="evenodd"
          d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533Zm1.5 16.103A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"
        />
      ) : null}
      {name === 'page' || name === 'sheet' ? (
        <>
          <Path
            fill="#fff"
            fillRule="evenodd"
            d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z"
          />
          <Path fill="#fff" d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .295.24.535.535.535H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
        </>
      ) : null}
      {name === 'target' ? (
        <>
          <Circle cx="11" cy="13" r="8" stroke="#fff" strokeWidth={1.8} fill="none" />
          <Circle cx="11" cy="13" r="4.6" stroke="#fff" strokeWidth={1.8} fill="none" />
          <Circle cx="11" cy="13" r="1.6" fill="#fff" />
          <Path d="M21 3 13.2 10.8" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M16.2 3H21v4.8" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'folder' ? (
        <Path fill="#fff" d="M2.25 6.75A2.25 2.25 0 0 1 4.5 4.5h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12H19.5A2.25 2.25 0 0 1 21.75 8.31v9.44A2.25 2.25 0 0 1 19.5 20H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75Z" />
      ) : null}
      {name === 'code' ? (
        <Path fill="#fff" d="M8.2 7.2 3.6 12l4.6 4.8 1.55-1.48L6.55 12l3.2-3.32L8.2 7.2Zm7.6 0-1.55 1.48L17.45 12l-3.2 3.32 1.55 1.48L20.4 12l-4.6-4.8Z" />
      ) : null}
      {name === 'idea' ? (
        <>
          <Path fill="#fff" d="M12 3.2A6.3 6.3 0 0 0 5.7 9.5c0 2.3 1.2 3.7 2.3 4.8.4.4.8 1.2.8 1.9h6.4c0-.7.4-1.5.8-1.9 1.1-1.1 2.3-2.5 2.3-4.8A6.3 6.3 0 0 0 12 3.2Z" />
          <Path fill="#fff" d="M9.4 18.4h5.2v1.3c0 .7-.6 1.3-1.3 1.3h-2.6c-.7 0-1.3-.6-1.3-1.3v-1.3Z" />
        </>
      ) : null}
      {name === 'chart' ? (
        <Path fill="#fff" d="M4.5 19.5h15v1.7h-15V19.5Zm2.2-6.2h2.4V18H6.7v-4.7Zm4.4-5h2.4V18h-2.4V8.3Zm4.4 2.6h2.4V18h-2.4v-7.1Z" />
      ) : null}
      {name === 'paint' ? (
        <Path fill="#fff" d="M12 3a9 9 0 0 0-9 9c0 3.4 3.4 4.2 5.4 4.2.8 0 1.4.6 1.4 1.5 0 1.6 1.3 2.8 2.9 2.8A8.2 8.2 0 0 0 21 12 9 9 0 0 0 12 3Zm-4.4 8.1a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm2.3-3.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm2.4 3.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
      ) : null}
      {name === 'radar' ? (
        <>
          <Circle cx="12" cy="12" r="8.2" stroke="#fff" strokeWidth={1.8} fill="none" />
          <Circle cx="12" cy="12" r="4.4" stroke="#fff" strokeWidth={1.8} fill="none" />
          <Path d="M12 12 18.2 7.4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx="12" cy="12" r="1.5" fill="#fff" />
        </>
      ) : null}
      {name === 'scan' ? (
        <Path fill="#fff" d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9ZM2.25 8.25A6.75 6.75 0 0 1 9 1.5h.008a.75.75 0 0 1 0 1.5H9A5.25 5.25 0 0 0 3.75 8.25v.008a.75.75 0 0 1-1.5 0V8.25Zm19.5 0A6.75 6.75 0 0 0 15 1.5h-.008a.75.75 0 0 0 0 1.5H15A5.25 5.25 0 0 1 20.25 8.25v.008a.75.75 0 0 0 1.5 0V8.25ZM2.25 15.742a.75.75 0 0 1 .75.75A5.25 5.25 0 0 0 8.25 21.75h.008a.75.75 0 0 1 0 1.5H8.25A6.75 6.75 0 0 1 1.5 16.5v-.008a.75.75 0 0 1 .75-.75Zm19.5 0a.75.75 0 0 0-.75.75 5.25 5.25 0 0 1-5.25 5.258H15.742a.75.75 0 0 0 0 1.5H15.75A6.75 6.75 0 0 0 22.5 16.5v-.008a.75.75 0 0 0-.75-.75Z" />
      ) : null}
      {name === 'clock' ? (
        <Path fill="#fff" fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .192.078.384.22.53l3.5 3.25a.75.75 0 1 0 1.06-1.06l-3.28-3.046V6Z" />
      ) : null}
      {name === 'plugin' ? (
        <Path fill="#fff" d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v.055c1.141.232 2.206.71 3.123 1.39A.75.75 0 0 1 18 7.25v4.5a6 6 0 0 1-4.5 5.81V21a.75.75 0 0 1-1.5 0v-3.44A6 6 0 0 1 7.5 11.75v-4.5a.75.75 0 0 1 .877-1.305 8.18 8.18 0 0 1 3.123-1.39V4.5Z" />
      ) : null}
      {name === 'gear' ? (
        <Path fill="#fff" fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L8.95 5.16a2.25 2.25 0 0 1-1.527.92l-1.378.2c-.89.13-1.545.89-1.545 1.79v1.86c0 .9.655 1.66 1.545 1.79l1.378.2c.66.096 1.22.447 1.527.92l.278 1.343c.151.904.933 1.567 1.85 1.567h1.844c.917 0 1.699-.663 1.85-1.567l.278-1.343c.307-.473.867-.824 1.527-.92l1.378-.2c.89-.13 1.545-.89 1.545-1.79v-1.86c0-.9-.655-1.66-1.545-1.79l-1.378-.2a2.25 2.25 0 0 1-1.527-.92l-.278-1.343c-.151-.904-.933-1.567-1.85-1.567h-1.844ZM12 9.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
      ) : null}
      {name === 'help' ? (
        <Path fill="#fff" fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.933-2.4-.933-3.29 0a.75.75 0 0 1-1.08-1.04c1.49-1.552 4.0-1.552 5.45 0a2.87 2.87 0 0 1 0 3.958c-.5.52-1.02.78-1.458.958-.36.147-.672.274-.672.584v.25a.75.75 0 0 1-1.5 0v-.25c0-1.03.71-1.45 1.14-1.626.48-.196.78-.38 1.028-.64a1.37 1.37 0 0 0 0-1.894ZM12 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      ) : null}
    </Svg>
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
  list: { paddingTop: 10, paddingBottom: 40, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 92,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizMark: { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 32, marginTop: -2 },
  body: { flex: 1, gap: 4 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardHint: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  sheet: {
    backgroundColor: '#141414',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sheetLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  sheetChev: { color: 'rgba(255,255,255,0.28)', fontSize: 26, marginTop: -2 },
})
