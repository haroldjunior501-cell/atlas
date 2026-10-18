/**
 * Écoute vocale Atlas — le texte parlé s’écrit en direct dans la barre de chat.
 */

export type ListenHandlers = {
  start: () => void
  stop: () => void
  ready: boolean
}

type Waiter = {
  resolve: (text: string) => void
  reject: (err: Error) => void
  partial: string
  finals: string[]
}

let handlers: ListenHandlers | null = null
let waiter: Waiter | null = null
let listening = false
let onLiveText: ((text: string) => void) | null = null
let silenceTimer: ReturnType<typeof setTimeout> | null = null

export function setLiveTranscriptHandler(handler: ((text: string) => void) | null) {
  onLiveText = handler
}

export function bindVoiceEar(next: ListenHandlers | null) {
  handlers = next
}

export function isVoiceEarReady() {
  return Boolean(handlers?.ready)
}

export function isListeningNow() {
  return listening
}

function emitLive(text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  if (!line) return
  try { onLiveText?.(line) } catch { /* ignore */ }
}

function combinedText(w: Waiter) {
  const parts = [...w.finals]
  if (w.partial.trim()) parts.push(w.partial.trim())
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function clearSilence() {
  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
}

/** Après une pause (~1,3 s) sans nouveau mot → phrase terminée. */
function armSilenceCommit() {
  clearSilence()
  if (!waiter) return
  silenceTimer = setTimeout(() => {
    if (!waiter) return
    const text = combinedText(waiter)
    if (text.length < 2) return
    const done = waiter
    waiter = null
    listening = false
    clearSilence()
    try { handlers?.stop() } catch { /* ignore */ }
    done.resolve(text)
  }, 1300)
}

/** Démarre l’écoute. Les mots s’écrivent en live dans la barre. */
export function listenOnce(timeoutMs = 28000): Promise<string> {
  if (!handlers?.ready) {
    return Promise.reject(new Error('Reconnaissance vocale pas prête. Réessaie dans une seconde.'))
  }
  if (waiter) {
    waiter.reject(new Error('Écoute déjà en cours.'))
    waiter = null
  }
  clearSilence()
  return new Promise<string>((resolve, reject) => {
    waiter = { resolve, reject, partial: '', finals: [] }
    listening = true
    try {
      handlers!.start()
    } catch (err) {
      listening = false
      waiter = null
      reject(err instanceof Error ? err : new Error('Micro impossible.'))
      return
    }
    const timer = setTimeout(() => {
      if (!waiter) return
      const text = combinedText(waiter)
      const done = waiter
      waiter = null
      listening = false
      clearSilence()
      try { handlers?.stop() } catch { /* ignore */ }
      if (text) done.resolve(text)
      else done.reject(new Error('Je n’ai rien entendu. Reparle un peu plus fort.'))
    }, timeoutMs)
    const prevResolve = waiter.resolve
    const prevReject = waiter.reject
    waiter.resolve = (text) => {
      clearTimeout(timer)
      clearSilence()
      prevResolve(text)
    }
    waiter.reject = (err) => {
      clearTimeout(timer)
      clearSilence()
      prevReject(err)
    }
  })
}

export function cancelListen() {
  listening = false
  clearSilence()
  try { handlers?.stop() } catch { /* ignore */ }
  if (waiter) {
    const done = waiter
    waiter = null
    done.resolve('')
  }
}

/** Force la fin → envoie tout le texte déjà écrit dans la barre. */
export function forceEndListen() {
  clearSilence()
  if (waiter) {
    const text = combinedText(waiter)
    const done = waiter
    waiter = null
    listening = false
    try { handlers?.stop() } catch { /* ignore */ }
    done.resolve(text)
    return
  }
  try { handlers?.stop() } catch { /* ignore */ }
}

export function pushListenEvent(event: {
  type: 'partial' | 'final' | 'end' | 'error' | 'ready'
  text?: string
  message?: string
}) {
  if (event.type === 'partial' && waiter) {
    const piece = (event.text || '').trim()
    if (piece) {
      waiter.partial = piece
      emitLive(combinedText(waiter))
      armSilenceCommit()
    }
    return
  }
  if (event.type === 'final' && waiter) {
    const piece = (event.text || waiter.partial || '').trim()
    if (piece) {
      waiter.finals.push(piece)
      waiter.partial = ''
      emitLive(combinedText(waiter))
      armSilenceCommit()
    }
    return
  }
  if (event.type === 'end' && waiter) {
    const text = combinedText(waiter)
    if (text.length >= 2) {
      const done = waiter
      waiter = null
      listening = false
      clearSilence()
      done.resolve(text)
      return
    }
    // Pas encore de texte : relancer l’écoute
    try { handlers?.start() } catch { /* ignore */ }
    return
  }
  if (event.type === 'error' && waiter) {
    const msg = event.message || 'Erreur micro'
    if (/no-speech/i.test(msg)) {
      try { handlers?.start() } catch { /* ignore */ }
      return
    }
    if (/aborted/i.test(msg)) return
    const done = waiter
    waiter = null
    listening = false
    clearSilence()
    done.reject(new Error(
      /not-allowed|permission|denied|unsupported/i.test(msg)
        ? 'Autorise le micro pour qu’Atlas t’entende.'
        : /network/i.test(msg)
          ? 'Réseau requis pour la reconnaissance vocale (Google).'
          : `Micro : ${msg}`,
    ))
  }
}
