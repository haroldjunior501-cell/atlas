import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import {
  askAgentReport,
  chatWithAgent,
  faceUrl,
  fetchAgentThread,
  fetchOrgBoard,
  type OrgAgent,
  type OrgBoard,
  type OrgChatTurn,
} from '../lib/api'
import { saveAtlasArtifact } from '../lib/library'
import { colors } from '../lib/theme'

/** Même marque que le Studio web (`ZTC_MARK` / `ZTC_NAME`). */
const ZTC_NAME = 'ZtcHosting'
const ZTC_MARK_LOCAL = require('../assets/brand/ztc-mark.png')

type Level = 'orgs' | 'agents' | 'chat'

function orgDisplayName(raw?: string | null) {
  const name = String(raw || '').trim()
  if (!name || /nouvelle organisation|untitled|sans nom/i.test(name)) return ZTC_NAME
  if (/ztc/i.test(name)) return ZTC_NAME
  return name
}

const RING_COLOR: Record<string, string> = {
  R0: '#38bdf8',
  R1: '#fd8925',
  R2: '#a78bfa',
  R3: '#f472b6',
  R4: '#f87171',
}

function presenceDot(presence: string) {
  if (/working/i.test(presence)) return '#fd8925'
  if (/online|idle/i.test(presence)) return '#22c55e'
  return 'rgba(255,255,255,0.35)'
}

function AgentAvatar({ agent, size = 56 }: { agent: OrgAgent; size?: number }) {
  const uri = faceUrl(agent.face)
  const initial = (agent.firstName || '?').slice(0, 1).toUpperCase()
  const ring = RING_COLOR[agent.ring || ''] || colors.brandMid
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1a1a22' }} />
      ) : (
        <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: ring }]}>
          <Text style={[styles.avatarLetter, { fontSize: size * 0.38 }]}>{initial}</Text>
        </View>
      )}
      <View style={[styles.presence, { backgroundColor: presenceDot(agent.presence), borderColor: '#0b1220' }]} />
    </View>
  )
}

export function OrgBoardView({
  pending,
  onBack,
  onMenu,
}: {
  pending?: boolean
  onBack: () => void
  onMenu: () => void
}) {
  const { width } = useWindowDimensions()
  const pad = width > 700 ? Math.max(28, (width - 640) / 2) : 18
  const cols = width > 520 ? 4 : 3
  const tile = Math.floor((width - pad * 2 - 12 * (cols - 1)) / cols)

  const [level, setLevel] = useState<Level>('orgs')
  const [board, setBoard] = useState<OrgBoard | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [agent, setAgent] = useState<OrgAgent | null>(null)
  const [thread, setThread] = useState<OrgChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await fetchOrgBoard()
      setBoard(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Organisation indisponible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function openAgent(next: OrgAgent) {
    setAgent(next)
    setLevel('chat')
    setThread([])
    try {
      const messages = await fetchAgentThread(next.id)
      if (messages.length) {
        setThread(messages)
      } else {
        setThread([{
          id: 'hi',
          role: 'agent',
          text: `Salut — je suis ${next.firstName}, ${next.role}. Confie-moi une mission, demande un rapport, ou pose ta question.`,
          at: new Date().toISOString(),
        }])
      }
    } catch {
      setThread([{
        id: 'hi',
        role: 'agent',
        text: `Salut — je suis ${next.firstName}. Dis-moi ce dont tu as besoin.`,
        at: new Date().toISOString(),
      }])
    }
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }))
  }

  async function send(text: string, mode: 'chat' | 'report' = 'chat') {
    const line = text.trim()
    if (!agent || line.length < 2 || busy || pending) return
    setBusy(true)
    const userTurn: OrgChatTurn = { id: `u-${Date.now()}`, role: 'user', text: line, at: new Date().toISOString() }
    setThread((prev) => [...prev, userTurn])
    setDraft('')
    try {
      const result = mode === 'report'
        ? await askAgentReport(agent.id, line)
        : await chatWithAgent(line, agent.id)
      const reply = result.reply
      // Réponse de l’agent uniquement dans le chat — pas la voix ATLAS (réservée à l’accueil).
      const turns: OrgChatTurn[] = [
        { id: `a-${Date.now()}`, role: 'agent', text: reply, at: new Date().toISOString() },
      ]
      try {
        const saved = await saveAtlasArtifact({
          ask: line,
          title: mode === 'report'
            ? `Rapport ${agent.firstName}`
            : /facture|invoice/i.test(line + reply)
              ? `Facture ${agent.firstName}`
              : undefined,
          body: reply,
          author: agent.firstName,
          note: `${agent.role} · ZtcHosting`,
          hint: mode === 'report'
            ? 'report'
            : /facture|invoice/i.test(line + reply)
              ? 'invoice'
              : /rapport|bilan|document/i.test(line)
                ? 'report'
                : 'auto',
        })
        if (saved) {
          turns.push({
            id: `lib-${Date.now()}`,
            role: 'agent',
            text: `📎 ${saved.summary}`,
            at: new Date().toISOString(),
          })
        }
      } catch { /* conversation prioritaire */ }
      setThread((prev) => [...prev, ...turns])
      void refresh()
    } catch (err) {
      const note = err instanceof Error ? err.message : 'Réponse impossible'
      setThread((prev) => [...prev, { id: `e-${Date.now()}`, role: 'agent', text: note, at: new Date().toISOString() }])
    } finally {
      setBusy(false)
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    }
  }

  function navBack() {
    if (level === 'chat') {
      setAgent(null)
      setLevel('agents')
      return
    }
    if (level === 'agents') {
      setLevel('orgs')
      return
    }
    onBack()
  }

  const orgName = orgDisplayName(board?.organization.name)

  const title = level === 'orgs'
    ? 'Organisation'
    : level === 'agents'
      ? orgName
      : (agent ? `${agent.firstName}` : 'Agent')

  const sub = level === 'orgs'
    ? 'Organisation produit'
    : level === 'agents'
      ? `${board?.agents.length || 0} employés · ${board?.pulse.activeAgents || 0} actifs`
      : (agent ? `${agent.role} · ${agent.department || agent.ring || 'desk'}` : '')

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={navBack} style={styles.navBtn} hitSlop={12}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path d="M15.5 5 8 12.5 15.5 20" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.navMid}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <Pressable onPress={onMenu} style={styles.navBtn} hitSlop={12}>
          <View style={styles.burger}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </View>
        </Pressable>
      </View>

      {loading && !board ? (
        <ActivityIndicator color={colors.brandMid} style={{ marginTop: 48 }} />
      ) : null}
      {error ? <Text style={[styles.error, { marginHorizontal: pad }]}>{error}</Text> : null}

      {level === 'orgs' && board ? (
        <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: pad }]} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => setLevel('agents')}
            style={({ pressed }) => [styles.orgCard, pressed && styles.pressed]}
          >
            <View style={styles.orgLogoWrap}>
              <Image
                source={ZTC_MARK_LOCAL}
                style={styles.orgLogo}
                resizeMode="contain"
                accessibilityLabel="Logo ZtcHosting"
              />
            </View>
            <View style={styles.orgCopy}>
              <Text style={styles.orgBrand}>ZTC HOSTING</Text>
              <Text style={styles.orgName}>{orgName}</Text>
              <Text style={styles.orgMeta}>
                {board.agents.length} agents · {board.pulse.openTasks} tâches
                {board.product ? ` · ${board.product.sku} SKU` : ''}
              </Text>
              <Text style={styles.orgHint}>Entrer dans l’équipe →</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => void refresh()} style={styles.refresh}>
            <Text style={styles.refreshText}>Actualiser</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {level === 'agents' && board ? (
        <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: pad }]} showsVerticalScrollIndicator={false}>
          <View style={styles.agentsBrand}>
            <Image source={ZTC_MARK_LOCAL} style={styles.agentsMark} resizeMode="contain" />
            <Text style={styles.agentsBrandName}>{orgName}</Text>
          </View>
          <Text style={styles.sectionLabel}>Employés</Text>
          <View style={styles.grid}>
            {board.agents.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void openAgent(item)}
                style={({ pressed }) => [styles.tile, { width: tile }, pressed && styles.pressed]}
              >
                <AgentAvatar agent={item} size={Math.min(64, tile - 24)} />
                <Text style={styles.tileName} numberOfLines={1}>{item.firstName}</Text>
                <Text style={styles.tileRole} numberOfLines={2}>{item.role}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {level === 'chat' && agent ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.chatHead, { paddingHorizontal: pad }]}>
            <AgentAvatar agent={agent} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chatName}>{agent.firstName} {agent.lastName}</Text>
              <Text style={styles.chatSkills} numberOfLines={1}>{agent.skills.slice(0, 3).join(' · ')}</Text>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.thread, { paddingHorizontal: pad }]}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {thread.map((turn) => (
              <View key={turn.id} style={[styles.bubble, turn.role === 'user' ? styles.bubbleUser : styles.bubbleAgent]}>
                <Text style={styles.bubbleText}>{turn.text}</Text>
              </View>
            ))}
            {busy ? <ActivityIndicator color={colors.brandMid} style={{ marginVertical: 8 }} /> : null}
          </ScrollView>

          <View style={[styles.quick, { paddingHorizontal: pad }]}>
            <Pressable style={styles.chip} onPress={() => void send('Donne-moi ton rapport de poste maintenant.', 'report')} disabled={busy}>
              <Text style={styles.chipText}>Rapport</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => void send(`Mission : avance sur ton poste ${agent.role} avec les données live.`)} disabled={busy}>
              <Text style={styles.chipText}>Mission</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => void send('Quelles sont tes compétences et ton périmètre ?')} disabled={busy}>
              <Text style={styles.chipText}>Périmètre</Text>
            </Pressable>
          </View>

          <View style={[styles.composer, { paddingHorizontal: pad }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={`Écrire à ${agent.firstName}…`}
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              editable={!busy}
            />
            <Pressable
              style={[styles.send, (busy || draft.trim().length < 2) && styles.sendOff]}
              disabled={busy || draft.trim().length < 2}
              onPress={() => void send(draft)}
            >
              <Text style={styles.sendText}>Envoyer</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 8 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navMid: { flex: 1 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  burger: { gap: 5 },
  burgerLine: { width: 18, height: 2, backgroundColor: '#fff', borderRadius: 1 },
  body: { paddingBottom: 40, gap: 16, paddingTop: 8 },
  error: { color: '#fb7185', marginTop: 12 },
  orgCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(253,137,37,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253,137,37,0.35)',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  orgLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orgLogo: { width: 52, height: 52 },
  orgCopy: { flex: 1, gap: 4 },
  orgBrand: { color: '#fd8925', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  orgName: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  orgMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  orgHint: { color: '#fd8925', fontWeight: '700', marginTop: 4, fontSize: 13 },
  agentsBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  agentsMark: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff' },
  agentsBrandName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sectionLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 8,
  },
  tileName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tileRole: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', lineHeight: 14 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#0b1220', fontWeight: '800' },
  presence: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  chatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  chatName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  chatSkills: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  thread: { paddingVertical: 14, gap: 10, paddingBottom: 20 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#fd8925' },
  bubbleAgent: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)' },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  quick: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  composer: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', paddingBottom: 8, paddingTop: 4 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.07)',
    textAlignVertical: 'top',
  },
  send: {
    backgroundColor: '#fd8925',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  sendText: { color: '#0b1220', fontWeight: '800', fontSize: 14 },
  refresh: { alignItems: 'center', paddingVertical: 10 },
  refreshText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
})
