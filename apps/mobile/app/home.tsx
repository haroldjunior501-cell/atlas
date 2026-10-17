import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { AssistantStage } from '../components/assistant-stage'
import { HomeDrawer, type Place } from '../components/home-drawer'
import { PlaceChatView, type ChatTurn } from '../components/place-chat'
import { PlaceHubView } from '../components/place-hub'
import { LibraryView } from '../components/library-view'
import { PluginConnectModal } from '../components/plugin-connect-modal'
import { PluginGalleryView } from '../components/plugin-gallery'
import { PluginToolView } from '../components/plugin-tool'
import { ProjectToolView } from '../components/project-workbench'
import { askAtlas, flushPcOrders, noteTurn } from '../lib/assistant'
import { fetchLatestChart } from '../lib/api'
import { fetchConnectLinks, linkedProvidersOf } from '../lib/connect'
import { webOrigin } from '../lib/config'
import { startDictation, stopDictation } from '../lib/dictate'
import { captureDocument, filesPrompt, pickDocuments, type AtlasFile } from '../lib/files'
import {
  importAtlasFiles,
  listLibrary,
  prepareLibraryAsk,
  removeLibraryItem,
  type LibraryItem,
} from '../lib/library'
import { absorbLifeOrder, listTasks, newTask, toggleTask, upsertTask, type LifeTask } from '../lib/life'
import { atlasFrame, chatKey, hubFor, isNavOnly, roomOf, routeFromOrder, type PlaceRoom } from '../lib/places'
import { connectorOf, matchPluginOrder, pluginPrompt, type ConnectorDescriptor } from '../lib/plugins'
import { parseProjectPack, spokenForPack, toolPrompt, type ProjectPack } from '../lib/project-tools'
import { type SkillKind } from '../lib/skills'
import { speakAtlas, stopAtlasSpeech } from '../lib/speak'
import { colors } from '../lib/theme'
import { clearSession, readSession, type Session } from '../lib/session'

/** La phrase écrite suit la voix, avec un court retard. */
const CAPTION_LAG = 520

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function openCaptionLag(text: string, write: (slice: string) => void) {
  const marks: { at: number; char: number }[] = []
  let timer = 0 as unknown as ReturnType<typeof setInterval>
  let shown = 0
  let armedAt = 0
  let lastNote = 0
  const paint = () => {
    const cut = Date.now() - CAPTION_LAG
    let count = 0
    for (const mark of marks) if (mark.at <= cut) count = mark.char
    if (Date.now() - lastNote > 180) {
      const estimated = Math.floor(((Date.now() - armedAt - CAPTION_LAG) / 1000) * 13)
      count = Math.max(count, estimated)
    }
    count = Math.max(0, Math.min(text.length, count))
    if (count <= shown) return
    shown = count
    write(text.slice(0, shown))
  }
  return {
    arm() {
      armedAt = Date.now()
      lastNote = Date.now()
      clearInterval(timer)
      timer = setInterval(paint, 50)
    },
    note(char: number) {
      lastNote = Date.now()
      marks.push({ at: lastNote, char: Math.max(0, Math.floor(char)) })
      if (marks.length > 80) marks.splice(0, marks.length - 80)
    },
    stop() {
      clearInterval(timer)
    },
  }
}

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [script, setScript] = useState('')
  const [spoken, setSpoken] = useState('')
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [engine, setEngine] = useState<'neural' | 'device'>('neural')
  const voiceSink = useRef<((event: 'start' | 'end' | 'fail' | 'tick', char?: number) => void) | null>(null)
  const sayGen = useRef(0)
  const cancelVoice = useRef<(() => void) | null>(null)
  const sayRef = useRef<(line: string) => Promise<void>>(async () => {})
  const voiceSession = useRef(false)
  const placeRef = useRef<Place>('home')
  const [voiceOn, setVoiceOn] = useState(false)
  const [pending, setPending] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [place, setPlace] = useState<Place>('home')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [chats, setChats] = useState<Record<string, ChatTurn[]>>({})
  const [skill, setSkill] = useState<SkillKind | null>(null)
  const [tasks, setTasks] = useState<LifeTask[]>([])
  const [files, setFiles] = useState<AtlasFile[]>([])
  const [dictating, setDictating] = useState(false)
  const [packs, setPacks] = useState<Record<string, ProjectPack>>({})
  const [linkedPlugins, setLinkedPlugins] = useState<Set<string>>(() => new Set())
  const [connectApp, setConnectApp] = useState<ConnectorDescriptor | null>(null)
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])

  async function refreshPluginLinks(organizationId?: string | null) {
    const id = organizationId ?? orgId
    if (!id) return
    try {
      const links = await fetchConnectLinks(id)
      setLinkedPlugins(linkedProvidersOf(links))
    } catch {
      /* Studio offline — keep last known links */
    }
  }

  useEffect(() => {
    void (async () => {
      const next = await readSession()
      if (!next) {
        router.replace('/')
        return
      }
      setSession(next)
      const hello = `Salut ${next.name.split(' ')[0] || ''}, que puis-je faire pour toi ?`.replace(/\s+/g, ' ').trim()
      setScript(hello)
      setSpoken('')
      noteTurn('atlas', hello)
      try {
        const chart = await fetchLatestChart()
        const id = chart.organization?.id ?? null
        setOrgId(id)
        if (id) await refreshPluginLinks(id)
      } catch {
        setOrgId(null)
      }
      setLoading(false)
      setTasks(await listTasks())
      await say(hello)
    })()
    return () => {
      sayGen.current += 1
      cancelVoice.current?.()
      voiceSink.current = null
      stopAtlasSpeech()
    }
  }, [])

  function stopTalking() {
    sayGen.current += 1
    cancelVoice.current?.()
    cancelVoice.current = null
    voiceSink.current = null
    stopAtlasSpeech()
  }

  async function say(line: string) {
    const text = line.trim()
    if (!text) return
    const gen = ++sayGen.current
    cancelVoice.current?.()
    cancelVoice.current = null
    stopAtlasSpeech()
    setEngine('neural')
    setScript(text)
    setSpoken((prev) => (prev === 'Je réfléchis.' ? prev : ''))
    setCursor(0)
    setSpeaking(true)
    const lag = openCaptionLag(text, (slice) => {
      if (sayGen.current === gen) setSpoken(slice)
    })
    const neural = await new Promise<boolean>((resolve) => {
      let started = false
      let settled = false
      let timer = 0 as unknown as ReturnType<typeof setTimeout>
      let tail = 0 as unknown as ReturnType<typeof setTimeout>
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        clearTimeout(tail)
        lag.stop()
        if (cancelVoice.current === finishFalse) cancelVoice.current = null
        resolve(ok)
      }
      const finishFalse = () => finish(false)
      cancelVoice.current = finishFalse
      timer = setTimeout(() => finish(false), 18000)
      voiceSink.current = (event, char) => {
        if (sayGen.current !== gen) return
        if (event === 'start') {
          started = true
          lag.arm()
          clearTimeout(timer)
          timer = setTimeout(() => finish(true), Math.min(70000, 10000 + text.length * 80))
          return
        }
        if (event === 'tick') {
          if (!started) return
          lag.note(typeof char === 'number' ? char : 0)
          return
        }
        if (event === 'end') {
          tail = setTimeout(() => {
            if (sayGen.current !== gen) return
            setSpoken(text)
            finish(true)
          }, CAPTION_LAG)
          return
        }
        if (event === 'fail' && !started) finish(false)
      }
    })
    if (sayGen.current !== gen) return
    if (!neural) {
      setEngine('device')
      lag.arm()
      await speakAtlas(text, (next) => {
        if (sayGen.current !== gen) return
        setCursor(next.char)
        if (next.speaking) lag.note(next.char)
      })
      await wait(CAPTION_LAG)
      lag.stop()
    }
    if (sayGen.current === gen) {
      setSpoken(text)
      setSpeaking(false)
    }
  }

  sayRef.current = say

  useEffect(() => {
    const timer = setInterval(() => {
      void (async () => {
        const done = await flushPcOrders()
        if (done) await sayRef.current(done)
      })()
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  async function logout() {
    setMenuOpen(false)
    await clearSession()
    router.replace('/')
  }

  function pushChat(key: string, turn: ChatTurn) {
    setChats((prev) => ({ ...prev, [key]: [...(prev[key] || []), turn] }))
  }

  function applyRoute(next: Place, nextRoom?: string) {
    setPlace(next)
    setRoomId(nextRoom ?? null)
    setMenuOpen(false)
    if (next === 'home') {
      setSkill(null)
      return
    }
    const room = roomOf(next, nextRoom)
    setSkill(room?.skill ?? null)
  }

  function seedChat(room: PlaceRoom, inPlace: Place) {
    const key = chatKey(inPlace, room.id)
    setChats((prev) => {
      if (prev[key]?.length) return prev
      return { ...prev, [key]: [{ id: `hi-${room.id}`, role: 'atlas', text: room.hint, at: Date.now() }] }
    })
  }

  function openRoom(room: PlaceRoom, inPlace: Place) {
    applyRoute(inPlace, room.id)
    if (inPlace !== 'projects' && inPlace !== 'plugins') seedChat(room, inPlace)
    if (inPlace === 'files' && room.id === 'import') void importFiles()
    if (inPlace === 'files' && room.id === 'photos') void scan('camera')
  }

  function openPlugin(provider: string) {
    setPlace('plugins')
    setRoomId(provider)
    setMenuOpen(false)
    setSkill(null)
  }

  async function execute(order?: string, extraFiles?: AtlasFile[]) {
    const text = (order ?? draft).trim()
    const attached = extraFiles ?? files
    if ((!text && !attached.length) || pending) return
    stopTalking()
    setPending(true)
    setListening(false)
    setSpeaking(false)
    setSpoken('Je réfléchis.')

    const stayInTool = (place === 'projects' || place === 'plugins') && Boolean(roomId)
    const pluginHit = !stayInTool && text.length >= 2 ? matchPluginOrder(text) : null
    const routed = text.length >= 2 && !stayInTool ? routeFromOrder(text) : null
    let here = place
    let hereRoom = roomOf(place, roomId)
    let pluginId = place === 'plugins' ? roomId : null
    if (pluginHit && !(place === 'plugins' && roomId === pluginHit)) {
      openPlugin(pluginHit)
      here = 'plugins'
      pluginId = pluginHit
      hereRoom = null
      if (isNavOnly(text) && !attached.length) {
        setDraft('')
        setPending(false)
        setSpoken(connectorOf(pluginHit)?.hint || '')
        return
      }
    } else if (routed && (routed.place !== place || (routed.room || null) !== roomId)) {
      applyRoute(routed.place, routed.room)
      here = routed.place
      hereRoom = roomOf(routed.place, routed.room)
      pluginId = here === 'plugins' ? routed.room || null : null
      if (hereRoom && here !== 'projects' && here !== 'plugins') seedChat(hereRoom, here)
      if (isNavOnly(text) && !attached.length) {
        const hub = hubFor(here)
        setDraft('')
        setPending(false)
        if (here === 'projects' || here === 'plugins') {
          setSpoken(hereRoom?.hint || hub?.intro || '')
          return
        }
        await say(hereRoom?.hint || hub?.intro || 'C’est ouvert.')
        return
      }
    }

    const activePlugin = pluginId ? connectorOf(pluginId) : null
    const toolOnly = (here === 'projects' && Boolean(hereRoom)) || (here === 'plugins' && Boolean(activePlugin))
    const key = hereRoom ? chatKey(here, hereRoom.id) : activePlugin ? chatKey('plugins', activePlugin.provider) : null
    if (key && text && !toolOnly) {
      pushChat(key, { id: `u-${Date.now()}`, role: 'user', text, at: Date.now() })
    }

    try {
      const life = attached.length || here !== 'home' ? null : await absorbLifeOrder(text)
      if (life?.spoken) {
        setTasks(life.tasks)
        setDraft('')
        await say(life.spoken)
        return
      }
      const job =
        here === 'projects' && hereRoom
          ? toolPrompt(hereRoom.id, text, attached)
          : activePlugin
            ? pluginPrompt(activePlugin.provider, text)
            : attached.length
              ? filesPrompt(attached, text)
              : text
      const image = attached.find((file) => file.image)?.image
      const result = await askAtlas(job, orgId, session?.name, {
        image,
        skill: hereRoom?.skill || skill,
        context: atlasFrame(here, hereRoom, job, session?.name, activePlugin?.label),
      })
      setDraft('')
      let voice = result.reply
      if (key) {
        const written = result.board?.body && result.board.body.length > result.reply.length ? result.board.body : result.reply
        let spoken = result.reply
        let tiles = hereRoom
          ? written.length > spoken.length + 40
            ? [{
                title: result.board?.title || hereRoom.card || hereRoom.title,
                body: written,
                action: hereRoom.id === 'exercises' || hereRoom.id === 'explain'
                  ? 'Voir la solution étape par étape'
                  : hereRoom.id === 'quiz'
                    ? 'Lancer le quiz'
                    : 'Ouvrir',
              }]
            : /exercice|entraînement|fiche|quiz|corrig/i.test(spoken + written)
              ? [{
                  title: hereRoom.id === 'quiz' ? 'Quiz' : hereRoom.title,
                  meta: hereRoom.tags.join(' • '),
                  action: 'Ouvrir',
                }]
              : undefined
          : undefined
        if (here === 'projects' && hereRoom) {
          const pack = parseProjectPack(hereRoom.id, written, attached)
          if (hereRoom.id === 'strategy' && pack.steps?.length) {
            pack.steps = pack.steps.map((step) => ({
              ...step,
              done: false,
            }))
          }
          setPacks((prev) => {
            const keep = prev[key]
            return {
              ...prev,
              [key]: {
                ...pack,
                ideas: pack.ideas?.length ? pack.ideas : keep?.ideas,
                table: pack.table || keep?.table,
              },
            }
          })
          spoken = spokenForPack(pack, result.reply)
          tiles = undefined
        }
        voice = spoken
        if (!toolOnly) {
          pushChat(key, {
            id: `a-${Date.now()}`,
            role: 'atlas',
            text: spoken,
            at: Date.now(),
            tiles,
          })
        }
      }
      if (result.pack?.tasks?.length) {
        for (const item of result.pack.tasks) {
          if (item.title?.trim()) await upsertTask(newTask(item.title, item.due))
        }
        setTasks(await listTasks())
      }
      if (!orgId) {
        const chart = await fetchLatestChart().catch(() => null)
        if (chart?.organization?.id) setOrgId(chart.organization.id)
      }
      if (toolOnly) setSpoken(voice)
      else await say(voice)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Atlas n’a pas pu exécuter.'
      const line = /Network|Failed|fetch/i.test(message)
        ? `Studio Web injoignable (${webOrigin}). Lance le Studio sur le PC pour piloter la machine.`
        : message
      if (key && !toolOnly) pushChat(key, { id: `e-${Date.now()}`, role: 'atlas', text: line, at: Date.now() })
      if (toolOnly) setSpoken(line)
      else await say(line)
    } finally {
      setPending(false)
    }
  }

  function goPlace(next: Place) {
    if (next !== 'home') void endVoiceSession(false)
    setMenuOpen(false)
    setRoomId(null)
    setPlace(next)
    placeRef.current = next
    setSkill(null)
    setConnectApp(null)
    if (next === 'plugins') void refreshPluginLinks()
    if (next === 'library') void refreshLibrary()
  }

  async function beginListen() {
    stopTalking()
    await startDictation()
    setDictating(true)
    setListening(true)
    setSpoken('Je t’écoute. Parle, puis appuie encore pour envoyer.')
  }

  async function endVoiceSession(bye = true) {
    voiceSession.current = false
    setVoiceOn(false)
    if (dictating) {
      setDictating(false)
      try {
        await stopDictation()
      } catch {
        /* ignore */
      }
    }
    setListening(false)
    if (bye) {
      setSpoken('Conversation vocale terminée.')
      await say('À tout à l’heure.')
    }
  }

  async function toggleVoiceChat() {
    if (pending) return
    try {
      if (dictating) {
        setDictating(false)
        setListening(false)
        setSpoken('Je transcris…')
        const text = await stopDictation()
        if (!text.trim()) {
          await say('Je n’ai rien entendu. Réessaie.')
          if (voiceSession.current && placeRef.current === 'home') {
            try {
              await beginListen()
            } catch {
              voiceSession.current = false
              setVoiceOn(false)
            }
          }
          return
        }
        setDraft(text)
        setSkill('voice')
        await execute(text)
        if (voiceSession.current && placeRef.current === 'home') {
          try {
            await beginListen()
          } catch (err) {
            voiceSession.current = false
            setVoiceOn(false)
            Alert.alert('Micro', err instanceof Error ? err.message : 'Micro indisponible.')
          }
        }
        return
      }

      if (!voiceSession.current) {
        voiceSession.current = true
        setVoiceOn(true)
      }
      await beginListen()
    } catch (err) {
      setDictating(false)
      setListening(false)
      voiceSession.current = false
      setVoiceOn(false)
      Alert.alert('Micro', err instanceof Error ? err.message : 'Conversation vocale impossible.')
    }
  }

  async function refreshLibrary() {
    setLibraryItems(await listLibrary('all'))
  }

  async function analyzeLibraryItem(item: LibraryItem, ask?: string) {
    if (pending) return
    stopTalking()
    setPending(true)
    setSpeaking(false)
    setSpoken('Je lis le contenu…')
    try {
      const prepared = await prepareLibraryAsk(item, ask)
      const result = await askAtlas(prepared.text, orgId, session?.name, {
        image: prepared.image,
        skill: prepared.skill,
        context: atlasFrame('library', null, prepared.text, session?.name),
      })
      setSpoken(result.reply)
      await say(result.reply)
    } catch (err) {
      const line = err instanceof Error ? err.message : 'Analyse impossible.'
      setSpoken(line)
      await say(line)
    } finally {
      setPending(false)
    }
  }

  async function deleteLibraryItem(item: LibraryItem) {
    await removeLibraryItem(item.id)
    await refreshLibrary()
    setSpoken('Élément retiré de la Bibliothèque.')
  }

  async function importFiles() {
    try {
      const next = await pickDocuments()
      if (!next.length) return
      setFiles(next)
      setSkill((current) => current || 'document')
      await importAtlasFiles(next, 'import').then(() => refreshLibrary()).catch(() => null)
      const names = next.map((file) => file.name).join(', ')
      setSpoken(`${next.length} fichier${next.length > 1 ? 's' : ''} : ${names}`)
      void execute(draft.trim() || `Analyse ${names}. Lis tout le contenu, explique clairement, et extrais ce qui compte.`, next)
    } catch (err) {
      Alert.alert('Import', err instanceof Error ? err.message : 'Impossible de lire le fichier.')
    }
  }

  async function scan(mode: 'camera' | 'library') {
    try {
      const next = await captureDocument(mode)
      if (!next.length) return
      setFiles(next)
      setSkill('scan')
      await importAtlasFiles(next, mode === 'camera' ? 'camera' : 'import').then(() => refreshLibrary()).catch(() => null)
      void execute(draft.trim() || 'Analyse cette image : lis le texte, le tableau ou la facture, et explique.', next)
    } catch (err) {
      Alert.alert('Scan', err instanceof Error ? err.message : 'La caméra n’est pas disponible.')
    }
  }

  async function toggleDictation() {
    await toggleVoiceChat()
  }

  async function markTask(id: string) {
    setTasks(await toggleTask(id))
  }

  async function markProjectStep(key: string, title: string) {
    const pack = packs[key]
    const step = pack?.steps?.find((item) => item.title === title)
    const nextDone = !step?.done
    setPacks((prev) => {
      const current = prev[key]
      if (!current?.steps) return prev
      return {
        ...prev,
        [key]: {
          ...current,
          steps: current.steps.map((item) => (item.title === title ? { ...item, done: nextDone } : item)),
        },
      }
    })
    if (nextDone) {
      await upsertTask(newTask(title))
      setTasks(await listTasks())
    }
  }

  if (loading || !session) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    )
  }

  const hub = hubFor(place)
  const activeRoom = roomOf(place, roomId)
  const thread = activeRoom ? chats[chatKey(place, activeRoom.id)] || [] : []

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#000000', '#050510', '#000000']} style={StyleSheet.absoluteFill} />

      <View
        pointerEvents={place === 'home' ? 'auto' : 'none'}
        style={place === 'home' ? styles.safe : styles.voiceKeep}
        collapsable={false}
      >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.nav}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.iconBtn} hitSlop={10}>
            <View style={styles.burger}>
              <View style={styles.burgerLine} />
              <View style={styles.burgerLine} />
              <View style={styles.burgerLineShort} />
            </View>
          </Pressable>
          <Text style={styles.logo}>
            ATL<Text style={styles.logoAccent}>AS</Text>
          </Text>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.profileBtn}>
            <LinearGradient colors={['#38bdf8', '#a855f7']} style={styles.profileOrb} />
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.badge, (voiceOn || dictating) && styles.badgeLive]}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path
                  d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5 11a7 7 0 0 0 14 0M12 18v3"
                  stroke={dictating ? '#38bdf8' : '#c4b5fd'}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
              <Text style={styles.badgeText}>
                {dictating
                  ? 'Je t’écoute — appuie pour envoyer'
                  : voiceOn
                    ? 'Conversation vocale'
                    : 'Assistance vocale'}
              </Text>
            </View>

            <AssistantStage
              listening={listening || pending || dictating}
              speaking={speaking}
              speech={script}
              cursor={cursor}
              engine={engine}
              onPress={() => void toggleVoiceChat()}
              onVoice={(event, char) => voiceSink.current?.(event, char)}
            />

            <Text style={styles.atlasLine}>
              {spoken}
              {speaking && spoken.length > 0 && spoken !== 'Je réfléchis.' && spoken.length < script.length ? ' ▍' : ''}
            </Text>

            {files.length ? (
              <Text style={styles.attach}>{files.map((file) => file.name).join(' · ')}</Text>
            ) : null}

            <View style={styles.orderRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Écris ici, ou tape le visage pour parler"
                placeholderTextColor="rgba(255,255,255,0.35)"
                returnKeyType="send"
                onSubmitEditing={() => void execute()}
              />
              <Pressable
                onPress={() => void execute()}
                disabled={pending || (draft.trim().length < 2 && !files.length)}
                style={({ pressed }) => [
                  styles.exec,
                  (pending || (draft.trim().length < 2 && !files.length)) && styles.execOff,
                  pressed && styles.pressed,
                ]}
              >
                {pending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.execText}>Exécuter</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.actions}>
              <QuietAction
                label={dictating ? 'Envoyer' : voiceOn ? 'Écouter' : 'Parler'}
                icon="mic"
                onPress={() => void toggleVoiceChat()}
              />
              <QuietAction label="Importer" icon="file" onPress={() => void importFiles()} />
              <QuietAction label="Photo" icon="camera" onPress={() => void scan('camera')} />
              {voiceOn ? (
                <QuietAction label="Stop voix" icon="mic" onPress={() => void endVoiceSession(true)} />
              ) : null}
            </View>

            <Text style={styles.footnote}>
              Tape le visage ou Parler : dis ton message, retape pour envoyer. Atlas répond à voix haute, puis réécoute.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </View>

      {place === 'library' ? (
        <View style={styles.overlay}>
          <LibraryView
            items={libraryItems}
            pending={pending}
            status={spoken}
            onBack={() => goPlace('home')}
            onMenu={() => setMenuOpen(true)}
            onRefresh={() => void refreshLibrary()}
            onAnalyze={(item, ask) => void analyzeLibraryItem(item, ask)}
            onDelete={(item) => void deleteLibraryItem(item)}
          />
        </View>
      ) : null}

      {place === 'plugins' && !roomId ? (
        <View style={styles.overlay}>
          <PluginGalleryView
            linked={linkedPlugins}
            onBack={() => goPlace('home')}
            onMenu={() => setMenuOpen(true)}
            onOpen={(app) => openPlugin(app.provider)}
            onConnect={(app) => {
              setConnectApp(app)
              void refreshPluginLinks()
            }}
          />
          <PluginConnectModal
            app={connectApp}
            organizationId={orgId}
            linked={connectApp ? linkedPlugins.has(connectApp.provider) : false}
            visible={Boolean(connectApp)}
            onClose={() => setConnectApp(null)}
            onLinks={(links) => setLinkedPlugins(linkedProvidersOf(links))}
            onOpenApp={(provider) => {
              setConnectApp(null)
              openPlugin(provider)
            }}
          />
        </View>
      ) : null}

      {place === 'plugins' && roomId && connectorOf(roomId) ? (
        <View style={styles.overlay}>
          <PluginToolView
            app={connectorOf(roomId)!}
            pending={pending}
            status={spoken}
            onBack={() => {
              setRoomId(null)
              setSkill(null)
            }}
            onMenu={() => setMenuOpen(true)}
            onRun={(prompt) => void execute(prompt)}
          />
        </View>
      ) : null}

      {place !== 'home' && place !== 'plugins' && place !== 'library' && hub && !activeRoom ? (
        <View style={styles.overlay}>
          <PlaceHubView
            hub={hub}
            onBack={() => goPlace('home')}
            onMenu={() => setMenuOpen(true)}
            onRoom={(room) => openRoom(room, place)}
          />
        </View>
      ) : null}

      {place === 'projects' && activeRoom ? (
        <View style={styles.overlay}>
          <ProjectToolView
            title={activeRoom.title}
            hint={activeRoom.hint}
            roomId={activeRoom.id}
            pending={pending}
            status={spoken}
            pack={packs[chatKey(place, activeRoom.id)]}
            filesLabel={files.length ? files.map((file) => file.name).join(' · ') : undefined}
            onBack={() => {
              setRoomId(null)
              setSkill(null)
            }}
            onMenu={() => setMenuOpen(true)}
            onRun={(prompt) => void execute(prompt)}
            onImport={() => void importFiles()}
            onToggleStep={(title) => void markProjectStep(chatKey(place, activeRoom.id), title)}
          />
        </View>
      ) : null}

      {place !== 'home' && place !== 'projects' && place !== 'plugins' && place !== 'library' && hub && activeRoom ? (
        <View style={styles.overlay}>
          <PlaceChatView
            title={activeRoom.title}
            room={activeRoom}
            messages={thread}
            draft={draft}
            pending={pending}
            dictating={dictating}
            attachLabel={files.length ? files.map((file) => file.name).join(' · ') : undefined}
            userName={session.name}
            onBack={() => {
              setRoomId(null)
              setSkill(null)
            }}
            onMenu={() => setMenuOpen(true)}
            onChangeDraft={setDraft}
            onSend={() => void execute()}
            onAttach={() => void importFiles()}
            onPhoto={() => void scan('camera')}
            onMic={() => void toggleDictation()}
            onOpenTile={(tile) => void execute(tile.action ? `${tile.action}. ${tile.title}` : tile.title)}
          />
        </View>
      ) : null}

      <HomeDrawer
        open={menuOpen}
        session={session}
        place={place}
        onClose={() => setMenuOpen(false)}
        onLogout={() => void logout()}
        onPlace={goPlace}
      />
    </View>
  )
}

function QuietAction({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string
  icon: 'file' | 'camera' | 'mic'
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.quiet, disabled && styles.quietOff, pressed && styles.pressed]}
    >
      {icon === 'file' ? (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M7 3h7l5 5v13H7V3Z" stroke="#cbd5e1" strokeWidth={1.6} fill="none" />
          <Path d="M14 3v5h5" stroke="#cbd5e1" strokeWidth={1.6} fill="none" />
        </Svg>
      ) : icon === 'camera' ? (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M4 8h3l2-2h6l2 2h3v12H4V8Z" stroke="#cbd5e1" strokeWidth={1.6} fill="none" />
          <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#cbd5e1" strokeWidth={1.6} fill="none" />
        </Svg>
      ) : (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" stroke="#cbd5e1" strokeWidth={1.6} fill="none" />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="#cbd5e1" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </Svg>
      )}
      <Text style={styles.quietText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1 },
  voiceKeep: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
    backgroundColor: '#000',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  iconBtn: { width: 42, height: 42, justifyContent: 'center' },
  burger: { gap: 5, width: 22 },
  burgerLine: { height: 1.5, backgroundColor: '#fff', borderRadius: 1 },
  burgerLineShort: { height: 1.5, width: '70%', backgroundColor: '#fff', borderRadius: 1 },
  logo: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 4 },
  logoAccent: { color: colors.brandMid },
  profileBtn: { width: 42, height: 42, alignItems: 'flex-end', justifyContent: 'center' },
  profileOrb: { width: 28, height: 28, borderRadius: 14 },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  badgeLive: {
    backgroundColor: 'rgba(56,189,248,0.14)',
    borderColor: 'rgba(56,189,248,0.35)',
  },
  atlasLine: {
    color: '#c4b5fd',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
    minHeight: 44,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.18)',
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 8,
  },
  exec: {
    backgroundColor: '#3b82f6',
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  execOff: { opacity: 0.4 },
  execText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  quiet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  quietOff: { opacity: 0.5 },
  quietText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  attach: {
    color: 'rgba(196,181,253,0.9)',
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  footnote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },
  pressed: { opacity: 0.88 },
})
