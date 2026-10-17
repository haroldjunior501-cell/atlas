/**
 * Web Audio meter for lip-sync — RMS → 0…1 aperture.
 * Works with HTMLMediaElement (NIM / file TTS). SpeechSynthesis has no node;
 * for that path we synthesize level from viseme JawOpen in the avatar.
 */

export type AudioMeter = {
  ctx: AudioContext
  analyser: AnalyserNode
  data: Uint8Array
  source: MediaElementAudioSourceNode | null
  lastT: number
}

export function createAudioMeter(): AudioMeter {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.35
  return {
    ctx,
    analyser,
    data: new Uint8Array(analyser.frequencyBinCount),
    source: null,
    lastT: performance.now(),
  }
}

export function connectMediaElement(meter: AudioMeter, media: HTMLMediaElement) {
  try {
    if (meter.source) {
      try { meter.source.disconnect() } catch { /* already disconnected */ }
      meter.source = null
    }
    // One MediaElementSource per element — reuse if already created on this element
    const tagged = media as HTMLMediaElement & { __atlasMeterSource?: MediaElementAudioSourceNode }
    if (tagged.__atlasMeterSource) {
      meter.source = tagged.__atlasMeterSource
    } else {
      meter.source = meter.ctx.createMediaElementSource(media)
      tagged.__atlasMeterSource = meter.source
    }
    meter.source.connect(meter.analyser)
    meter.analyser.connect(meter.ctx.destination)
  } catch {
    /* Autoplay / already connected — still try resume */
  }
  void meter.ctx.resume().catch(() => {})
}

/** Returns instantaneous aperture 0…1 from time-domain RMS. */
export function sampleAudioAperture(meter: AudioMeter): number {
  meter.analyser.getByteTimeDomainData(meter.data)
  let sum = 0
  for (let i = 0; i < meter.data.length; i += 1) {
    const v = (meter.data[i]! - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / Math.max(1, meter.data.length))
  // Speech RMS often ~0.02–0.2 — expand into visible jaw range
  const gated = Math.max(0, rms - 0.01)
  return Math.min(1, gated * 7.2)
}

export function disposeAudioMeter(meter: AudioMeter | null) {
  if (!meter) return
  try { meter.source?.disconnect() } catch { /* ignore */ }
  try { meter.analyser.disconnect() } catch { /* ignore */ }
  void meter.ctx.close().catch(() => {})
}
