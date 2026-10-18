import { useEffect, useRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { WebView as WebViewBase } from 'react-native-webview'
import type { ComponentType } from 'react'
import { bindVoiceEar, pushListenEvent } from '../lib/listen'

const AtlasWebView = WebViewBase as unknown as ComponentType<{
  ref?: unknown
  source?: { html: string; baseUrl?: string }
  style?: object
  originWhitelist?: string[]
  javaScriptEnabled?: boolean
  domStorageEnabled?: boolean
  mediaPlaybackRequiresUserGesture?: boolean
  allowsInlineMediaPlayback?: boolean
  mediaCapturePermissionGrantType?: string
  mixedContentMode?: string
  allowFileAccess?: boolean
  onMessage?: (event: { nativeEvent: { data: string } }) => void
  onPermissionRequest?: (event: {
    nativeEvent: { resources: string[]; grant: (r: string[]) => void; deny: () => void }
  }) => void
  onLoadEnd?: () => void
}>

/**
 * SpeechRecognition dans un WebView de taille réelle (hors écran).
 * Un WebView 1×1 est ignoré par Android → micro muet.
 */
const EAR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="margin:0;padding:16px;background:#111;color:#fff;font-family:sans-serif">
<p id="st">oreille atlas</p>
<script>
(function () {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null;
  var lastPartial = '';
  var committed = '';
  var st = document.getElementById('st');

  function send(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch (e) {}
  }

  function stopRec() {
    try { if (rec) { rec.onend = null; rec.stop(); } } catch (e) {}
    try { if (rec) rec.abort(); } catch (e) {}
    rec = null;
  }

  window.__atlasListenStart = function () {
    stopRec();
    lastPartial = '';
    committed = '';
    if (st) st.textContent = 'listening…';
    if (!SR) {
      send({ type: 'error', message: 'unsupported' });
      return;
    }
    rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onstart = function () {
      if (st) st.textContent = 'micro ON';
    };
    rec.onresult = function (event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var piece = (event.results[i][0].transcript || '').trim();
        if (!piece) continue;
        if (event.results[i].isFinal) {
          committed = (committed ? committed + ' ' : '') + piece;
          lastPartial = '';
          send({ type: 'final', text: piece });
          if (st) st.textContent = committed;
        } else {
          interim += (interim ? ' ' : '') + piece;
        }
      }
      if (interim) {
        lastPartial = interim;
        send({ type: 'partial', text: interim });
        if (st) st.textContent = (committed ? committed + ' ' : '') + interim;
      }
    };
    rec.onerror = function (event) {
      var code = (event && event.error) || 'error';
      if (st) st.textContent = 'err ' + code;
      send({ type: 'error', message: code });
    };
    rec.onend = function () {
      var all = (committed + (lastPartial ? ' ' + lastPartial : '')).trim();
      send({ type: 'end', text: all || lastPartial });
    };
    try {
      rec.start();
    } catch (e) {
      send({ type: 'error', message: String(e && e.message || e) });
    }
  };

  window.__atlasListenStop = function () {
    stopRec();
  };

  send({ type: 'ready' });
})();
</script>
</body>
</html>`

export function VoiceEar() {
  const ref = useRef<{ injectJavaScript?: (js: string) => void } | null>(null)

  useEffect(() => {
    bindVoiceEar({
      ready: false,
      start() {
        ref.current?.injectJavaScript?.('window.__atlasListenStart && window.__atlasListenStart(); true;')
      },
      stop() {
        ref.current?.injectJavaScript?.('window.__atlasListenStop && window.__atlasListenStop(); true;')
      },
    })
    return () => bindVoiceEar(null)
  }, [])

  function markReady() {
    bindVoiceEar({
      ready: true,
      start() {
        ref.current?.injectJavaScript?.('window.__atlasListenStart && window.__atlasListenStart(); true;')
      },
      stop() {
        ref.current?.injectJavaScript?.('window.__atlasListenStop && window.__atlasListenStop(); true;')
      },
    })
    pushListenEvent({ type: 'ready' })
  }

  return (
    <View style={styles.host} pointerEvents="none" collapsable={false}>
      <AtlasWebView
        ref={ref}
        source={{
          html: EAR_HTML,
          baseUrl: 'https://atlas.local/',
        }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowFileAccess
        mediaPlaybackRequiresUserGesture={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        onLoadEnd={markReady}
        onPermissionRequest={(event) => {
          try {
            event.nativeEvent.grant(event.nativeEvent.resources)
          } catch {
            try { event.nativeEvent.deny() } catch { /* ignore */ }
          }
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as {
              type: 'partial' | 'final' | 'end' | 'error' | 'ready'
              text?: string
              message?: string
            }
            if (data.type === 'ready') markReady()
            else pushListenEvent(data)
          } catch { /* ignore */ }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 280,
    height: 160,
    left: -400,
    top: 0,
    opacity: Platform.OS === 'android' ? 0.02 : 0.01,
    overflow: 'hidden',
  },
  web: {
    width: 280,
    height: 160,
    backgroundColor: 'transparent',
  },
})
