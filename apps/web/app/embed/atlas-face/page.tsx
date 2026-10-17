'use client'

import { useEffect, useState } from 'react'
import { AceFace } from '@/app/bureau/ace-face'

type FaceState = { listening?: boolean; speaking?: boolean; speech?: string }

function notifyNative(ready: boolean) {
  const payload = JSON.stringify({ type: 'atlas-face', ready })
  const bridge = (window as unknown as {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }).ReactNativeWebView
  bridge?.postMessage(payload)
}

/**
 * Visage FLAME Atlas pour le cockpit mobile (WebView).
 * Même modèle Three.js / GLB que le Studio Web.
 */
export default function AtlasFaceEmbedPage() {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speech, setSpeech] = useState('')

  useEffect(() => {
    const apply = (state: FaceState) => {
      if (typeof state.listening === 'boolean') setListening(state.listening)
      if (typeof state.speaking === 'boolean') setSpeaking(state.speaking)
      if (typeof state.speech === 'string') setSpeech(state.speech)
    }
    ;(window as unknown as { __atlasFaceApply?: (state: FaceState) => void }).__atlasFaceApply = apply
    document.documentElement.style.background = '#000'
    document.body.style.background = '#000'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      delete (window as unknown as { __atlasFaceApply?: (state: FaceState) => void }).__atlasFaceApply
    }
  }, [])

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100%',
        height: '100vh',
        display: 'grid',
        placeItems: 'center',
        margin: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 42%, rgba(37,99,235,0.34), transparent 46%), #000',
      }}
    >
      <style>{`
        [data-avatar-look="flame-glb"] {
          width: 100vw !important;
          height: 100vh !important;
        }
      `}</style>
      <AceFace
        seed="Atlas"
        label="Atlas"
        size="hero"
        listening={listening}
        speaking={speaking}
        speech={speech}
        onReady={() => notifyNative(true)}
        onError={() => notifyNative(false)}
      />
    </main>
  )
}
