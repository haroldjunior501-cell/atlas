import { Asset } from 'expo-asset'
import { type ComponentType, type Ref, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView as WebViewBase } from 'react-native-webview'
import faceGlb from '../assets/atlas-flame.zip'
import faceHtml from '../assets/atlas-face.html'
import { synthesizeSpeech } from '../lib/speech-cloud'

type FaceHandle = { injectJavaScript: (script: string) => void }

// Le générique par défaut de WebView rend ses props `never` sous ce React.
const AtlasWebView = WebViewBase as unknown as ComponentType<{
  ref?: Ref<FaceHandle>
  source: { uri: string }
  allowingReadAccessToURL?: string
  style?: object
  originWhitelist?: string[]
  javaScriptEnabled?: boolean
  domStorageEnabled?: boolean
  scrollEnabled?: boolean
  bounces?: boolean
  showsHorizontalScrollIndicator?: boolean
  showsVerticalScrollIndicator?: boolean
  allowsInlineMediaPlayback?: boolean
  mediaPlaybackRequiresUserAction?: boolean
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only'
  onLoadEnd?: () => void
  onMessage?: (event: { nativeEvent: { data: string } }) => void
  onError?: () => void
  onHttpError?: () => void
}>

/**
 * Même visage FLAME que le Studio PC : la page embed charge atlas-flame.glb.
 */
export function AssistantStage({
  listening,
  speaking,
  speech,
  cursor = 0,
  engine = 'neural',
  onPress,
  onVoice,
}: {
  listening?: boolean
  speaking?: boolean
  speech?: string
  /** Caractère en cours dans la voix (synchro des lèvres). */
  cursor?: number
  /** neural = Magpie, device = voix du téléphone si Magpie échoue. */
  engine?: 'neural' | 'device'
  onPress?: () => void
  onVoice?: (event: 'start' | 'end' | 'fail' | 'tick', char?: number) => void
}) {
  const webRef = useRef<FaceHandle | null>(null)
  const speechRef = useRef(speech || '')
  const pendingText = useRef('')
  const synthToken = useRef(0)
  const [failed, setFailed] = useState(false)
  const [uri, setUri] = useState<string | null>(null)
  const [readAccess, setReadAccess] = useState<string | undefined>(undefined)
  speechRef.current = speech || ''

  useEffect(() => {
    if (!speaking) pendingText.current = ''
  }, [speaking])

  useEffect(() => {
    let live = true
    void (async () => {
      const html = Asset.fromModule(faceHtml)
      const glb = Asset.fromModule(faceGlb)
      await Promise.all([html.downloadAsync(), glb.downloadAsync()])
      if (!live) return
      const page = html.uri.startsWith('http') ? html.uri : (html.localUri || html.uri)
      const model = glb.uri.startsWith('http') ? glb.uri : (glb.localUri || glb.uri)
      setUri(`${page}#glb=${encodeURIComponent(model)}`)
      if (model.startsWith('file:')) setReadAccess(model.slice(0, model.lastIndexOf('/')))
    })()
    return () => { live = false }
  }, [])

  async function provideVoice() {
    const text = speechRef.current.trim()
    if (!text || pendingText.current === text) return
    pendingText.current = text
    const token = ++synthToken.current
    const clip = await synthesizeSpeech(text)
    if (token !== synthToken.current) return
    if (!clip?.data) {
      pendingText.current = ''
      onVoice?.('fail')
      return
    }
    webRef.current?.injectJavaScript(
      `window.__atlasPlayClip && window.__atlasPlayClip(${JSON.stringify(clip.data)}, ${JSON.stringify(clip.mime)}); true;`,
    )
  }

  function pushState() {
    const payload = JSON.stringify({
      listening: Boolean(listening),
      speaking: Boolean(speaking),
      speech: speech || '',
      char: cursor,
      engine,
      at: Date.now(),
    })
    webRef.current?.injectJavaScript(
      `window.__atlasFaceApply && window.__atlasFaceApply(${payload}); true;`,
    )
  }

  useEffect(() => {
    pushState()
    if (speaking && engine === 'neural' && speech?.trim()) void provideVoice()
  }, [listening, speaking, speech, engine])

  useEffect(() => {
    if (engine !== 'device' || !speaking) return
    const payload = JSON.stringify({ char: cursor, engine: 'device', speaking: true })
    webRef.current?.injectJavaScript(
      `window.__atlasFaceApply && window.__atlasFaceApply(${payload}); true;`,
    )
  }, [cursor, engine, speaking])

  return (
    <View style={styles.stage} collapsable={false}>
      {uri ? <AtlasWebView
        ref={webRef}
        source={{ uri }}
        allowingReadAccessToURL={readAccess}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onLoadEnd={() => {
          setFailed(false)
          pushState()
        }}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data) as { type?: string; event?: string; char?: number }
            if (msg.type !== 'atlas-voice') return
            if (msg.event === 'need-audio') {
              void provideVoice()
              return
            }
            if (msg.event === 'start' || msg.event === 'end' || msg.event === 'fail' || msg.event === 'tick') {
              onVoice?.(msg.event, msg.char)
            }
          } catch { /* message du visage ignoré */ }
        }}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
      /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Parler à Atlas"
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      />
      {failed ? (
        <Text style={styles.fail}>
          Le visage n’a pas pu s’afficher. Recharge l’app.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    height: 420,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  web: {
    width: '100%',
    height: 420,
    backgroundColor: '#000',
  },
  fail: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 16,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
})
