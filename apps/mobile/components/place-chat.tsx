import { useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { PlaceRoom } from '../lib/places'
import { colors } from '../lib/theme'

export type ChatTile = {
  title: string
  body?: string
  meta?: string
  action?: string
}

export type ChatTurn = {
  id: string
  role: 'user' | 'atlas'
  text: string
  at?: number
  tiles?: ChatTile[]
}

export function PlaceChatView({
  title,
  messages,
  draft,
  pending,
  dictating,
  attachLabel,
  userName,
  onBack,
  onMenu,
  onChangeDraft,
  onSend,
  onAttach,
  onPhoto,
  onMic,
  onOpenTile,
}: {
  title: string
  room?: PlaceRoom
  messages: ChatTurn[]
  draft: string
  pending: boolean
  dictating: boolean
  attachLabel?: string
  userName?: string
  onBack: () => void
  onMenu: () => void
  onChangeDraft: (value: string) => void
  onSend: () => void
  onAttach: () => void
  onPhoto: () => void
  onMic: () => void
  onOpenTile?: (tile: ChatTile) => void
}) {
  const scroller = useRef<ScrollView>(null)
  useEffect(() => {
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(timer)
  }, [messages.length, pending])
  const initial = (userName || 'U').trim().slice(0, 1).toUpperCase()

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={onBack} style={styles.navBtn} hitSlop={10}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 5 8 12l7 7" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.brand}>
          ATL<Text style={styles.brandAccent}>AS</Text>
        </Text>
        <Pressable onPress={onMenu} style={styles.navBtn}>
          <View style={styles.userOrb}>
            <Text style={styles.userOrbLetter}>{initial}</Text>
          </View>
        </Pressable>
      </View>
      <Text style={styles.roomName}>{title}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((turn) =>
            turn.role === 'user' ? (
              <View key={turn.id} style={styles.userRow}>
                <View style={styles.userCol}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userText}>{turn.text}</Text>
                  </View>
                  <Text style={styles.stampRight}>{stamp(turn.at)} ✓✓</Text>
                </View>
                <View style={styles.face}>
                  <Text style={styles.faceLetter}>{initial}</Text>
                </View>
              </View>
            ) : (
              <View key={turn.id} style={styles.atlasRow}>
                <View style={styles.atlasFace}>
                  <Text style={styles.atlasA}>A</Text>
                </View>
                <View style={styles.atlasCol}>
                  {turn.text ? (
                    <View style={styles.atlasBubble}>
                      <Text style={styles.atlasText}>{turn.text}</Text>
                    </View>
                  ) : null}
                  {(turn.tiles || []).map((tile) => (
                    <Pressable
                      key={`${turn.id}-${tile.title}`}
                      onPress={() => onOpenTile?.(tile)}
                      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                    >
                      {tile.body ? (
                        <>
                          <Text style={styles.tileTitle}>{tile.title}</Text>
                          <Text style={styles.tileBody} numberOfLines={6}>
                            {tile.body}
                          </Text>
                          {tile.action ? (
                            <View style={styles.tileCta}>
                              <View style={styles.tileCtaIcon}>
                                <Svg width={14} height={14} viewBox="0 0 24 24">
                                  <Path d="M7 3h7l5 5v13H7V3Z" stroke="#93c5fd" strokeWidth={1.7} fill="none" />
                                </Svg>
                              </View>
                              <Text style={styles.tileCtaText}>{tile.action}</Text>
                              <Text style={styles.chev}>›</Text>
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <View style={styles.fileRow}>
                          <View style={styles.fileIcon}>
                            <Svg width={18} height={18} viewBox="0 0 24 24">
                              <Path d="M7 3h7l5 5v13H7V3Z" stroke="#93c5fd" strokeWidth={1.7} fill="none" />
                              <Path d="M14 3v6h6" stroke="#93c5fd" strokeWidth={1.7} fill="none" />
                            </Svg>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fileTitle}>{tile.title}</Text>
                            {tile.meta ? <Text style={styles.fileMeta}>{tile.meta}</Text> : null}
                          </View>
                          <Text style={styles.chev}>›</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                  <Text style={styles.stampLeft}>{stamp(turn.at)}</Text>
                </View>
              </View>
            ),
          )}
          {pending ? <Text style={styles.think}>Atlas rédige…</Text> : null}
        </ScrollView>

        {attachLabel ? <Text style={styles.attach}>{attachLabel}</Text> : null}

        <View style={styles.bar}>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="Écrire un message à ATLAS…"
              placeholderTextColor="rgba(255,255,255,0.38)"
              returnKeyType="send"
              onSubmitEditing={onSend}
              multiline
            />
            <Pressable onPress={onAttach} style={styles.tool} hitSlop={6}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 0 1 5.7 5.7L9.2 18.2a2 2 0 1 1-2.8-2.8l8.5-8.5"
                  stroke="#94a3b8"
                  strokeWidth={1.7}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
            <Pressable onPress={onPhoto} style={styles.tool} hitSlop={6}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path d="M4 8h3l2-2h6l2 2h3v11H4V8Z" stroke="#94a3b8" strokeWidth={1.7} fill="none" />
                <Path d="M12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="#94a3b8" strokeWidth={1.7} fill="none" />
              </Svg>
            </Pressable>
            <Pressable onPress={onMic} style={styles.tool} hitSlop={6}>
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5 11a7 7 0 0 0 14 0M12 18v3"
                  stroke={dictating ? '#38bdf8' : '#94a3b8'}
                  strokeWidth={1.7}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>
          <Pressable
            onPress={onSend}
            disabled={pending || draft.trim().length < 1}
            style={[styles.send, (pending || draft.trim().length < 1) && styles.sendOff]}
          >
            {pending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M4 12h16M13 5l7 7-7 7" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function stamp(at?: number) {
  const d = new Date(at || Date.now())
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 3 },
  brandAccent: { color: colors.brandMid },
  userOrb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userOrbLetter: { color: '#fff', fontWeight: '800', fontSize: 13 },
  roomName: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  thread: { paddingHorizontal: 12, paddingBottom: 18, gap: 16 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8 },
  userCol: { maxWidth: '78%', alignItems: 'flex-end' },
  userBubble: {
    backgroundColor: '#3b9bff',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  stampRight: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, marginRight: 4 },
  stampLeft: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, marginLeft: 4 },
  face: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceLetter: { color: '#fff', fontWeight: '800', fontSize: 14 },
  atlasRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  atlasFace: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  atlasA: { color: '#fff', fontWeight: '800', fontSize: 14 },
  atlasCol: { flex: 1, maxWidth: '82%', gap: 8 },
  atlasBubble: {
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  atlasText: { color: '#e8eef8', fontSize: 15, lineHeight: 22 },
  tile: {
    backgroundColor: '#141414',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,155,255,0.22)',
  },
  tileTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  tileBody: { color: '#c9d6ea', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  tileCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37,99,235,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tileCtaIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCtaText: { flex: 1, color: '#dbeafe', fontSize: 13, fontWeight: '600' },
  chev: { color: 'rgba(255,255,255,0.4)', fontSize: 22, marginTop: -2 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59,155,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fileMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  think: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginLeft: 42 },
  attach: { color: '#7dd3fc', fontSize: 12, paddingHorizontal: 18, marginBottom: 6 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  composer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#161616',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  tool: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  pressed: { opacity: 0.88 },
})
