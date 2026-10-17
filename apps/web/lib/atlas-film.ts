/**
 * Compétence film d’Atlas.
 * Open-Sora pose la plaque, SkyReels V2 la porte au cinéma,
 * EverAnimate tient le personnage, MOVA cale la voix et les sons.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { saveUserBinaryFile } from '@/lib/atlas-desktop'
import { nemotron } from '@/lib/nemotron'
import { serverEnv } from '@/lib/server-env'

export type FilmResult = {
  path: string
  title: string
  used: string[]
  summary: string
}

type Brief = {
  title: string
  visual: string
  speech: string
  cast: 'person' | 'scene'
  seconds: number
}

type StageReport = { name: string; ok: boolean; reason?: string }

const DIRECTOR = `Tu es le directeur d'Atlas Film. Tu prépares UN plan pour quatre modèles combinés :
Open-Sora (plaque visuelle), SkyReels V2 (lumière cinéma, mouvement, durée), EverAnimate (identité d'un personnage), MOVA (voix, lèvres, bruitages synchronisés).
Réponds UNIQUEMENT avec un JSON :
{"title":"court","visual":"prompt anglais très précis : sujet, lumière, objectif, mouvement de caméra","speech":"réplique dite ou chaîne vide","cast":"person|scene","seconds":8}
visual : une seule scène, en anglais. speech : langue de l'utilisateur, vide si personne ne parle. seconds : 4 à 12.`

const NAMES: Record<string, string> = {
  'open-sora': 'Open-Sora',
  skyreels: 'SkyReels V2',
  everanimate: 'EverAnimate',
  mova: 'MOVA',
}

function filmUrl() {
  return (serverEnv('ATLAS_FILM_URL') || 'http://127.0.0.1:7870').replace(/\/$/, '')
}

function benchScript() {
  const candidates = [
    join(process.cwd(), 'tools', 'atlas-film', 'bench.py'),
    join(process.cwd(), '..', 'tools', 'atlas-film', 'bench.py'),
    join(process.cwd(), '..', '..', 'tools', 'atlas-film', 'bench.py'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) || ''
}

async function health(): Promise<Record<string, boolean> | null> {
  try {
    const response = await fetch(`${filmUrl()}/health`, { signal: AbortSignal.timeout(800) })
    if (!response.ok) return null
    const body = await response.json() as { stages?: Record<string, boolean> }
    return body.stages || null
  } catch {
    return null
  }
}

let booting: Promise<void> | null = null

function bootBench() {
  if (booting) return booting
  const script = benchScript()
  if (!script) {
    booting = Promise.resolve()
    return booting
  }
  booting = new Promise((resolve) => {
    const child = spawn('python', [script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('error', () => resolve())
    child.unref()
    setTimeout(resolve, 700)
  })
  return booting
}

async function waitHealth() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const stages = await health()
    if (stages) return stages
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return null
}

export async function filmReadiness(): Promise<{ ready: boolean; detail: string }> {
  let stages = await health()
  if (!stages) {
    await bootBench()
    stages = await waitHealth()
  }
  if (!stages) {
    return {
      ready: false,
      detail: 'Le banc film ne répond pas. Lance python tools/atlas-film/bench.py sur le PC.',
    }
  }
  const ready = Object.entries(stages).filter(([, on]) => on).map(([name]) => NAMES[name] || name)
  if (!ready.length) {
    return {
      ready: false,
      detail: 'Les quatre modèles ne sont pas encore sur ce PC. Indique leurs dossiers : ATLAS_OPEN_SORA_HOME, ATLAS_SKYREELS_HOME, ATLAS_EVERANIMATE_HOME, ATLAS_MOVA_HOME, puis relance le banc film.',
    }
  }
  return {
    ready: true,
    detail: `Je lance le film avec ${ready.join(', ')}. Le fichier arrive dans Documents.`,
  }
}

function fileStem(prompt: string) {
  const stem = prompt
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return stem || `atlas-film-${Date.now()}`
}

function briefFrom(raw: string, prompt: string, title?: string): Brief {
  const match = raw.match(/\{[\s\S]*\}/)
  let parsed: Partial<Brief> = {}
  if (match) {
    try {
      parsed = JSON.parse(match[0]) as Partial<Brief>
    } catch { /* le texte utilisateur reste le plan */ }
  }
  const seconds = Number(parsed.seconds)
  return {
    title: (title || parsed.title || fileStem(prompt)).slice(0, 60),
    visual: String(parsed.visual || prompt).replace(/\s+/g, ' ').trim().slice(0, 1600),
    speech: String(parsed.speech || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    cast: parsed.cast === 'person' ? 'person' : 'scene',
    seconds: Number.isFinite(seconds) ? Math.max(4, Math.min(12, Math.round(seconds))) : 8,
  }
}

export async function generateAtlasFilm(opts: {
  prompt: string
  title?: string
  open?: boolean
}): Promise<FilmResult> {
  const prompt = opts.prompt.replace(/\s+/g, ' ').trim()
  if (prompt.length < 3) throw new Error('Décrivez la vidéo à générer.')

  const gate = await filmReadiness()
  if (!gate.ready) throw new Error(gate.detail)

  const planned = await nemotron(DIRECTOR, `Demande : ${prompt}`, 280, 12000).catch(() => '')
  const brief = briefFrom(planned, prompt, opts.title)
  const response = await fetch(`${filmUrl()}/v1/film`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(brief),
    signal: AbortSignal.timeout(20 * 60 * 1000),
  })
  const body = await response.json().catch(() => ({})) as {
    ok?: boolean
    path?: string
    error?: string
    used?: string[]
    stages?: StageReport[]
  }
  if (!response.ok || !body.ok || !body.path || !existsSync(body.path)) {
    const why = body.stages?.filter((stage) => !stage.ok).map((stage) => `${NAMES[stage.name] || stage.name} : ${stage.reason || 'échec'}`).join(' ')
    throw new Error(body.error || why || 'La génération vidéo a échoué.')
  }
  const saved = await saveUserBinaryFile({
    title: brief.title,
    ext: 'mp4',
    data: readFileSync(body.path),
    folder: 'documents',
    open: opts.open !== false,
  })
  const used = (body.used || []).map((name) => NAMES[name] || name)
  return {
    path: saved.path,
    title: saved.title,
    used,
    summary: `Film prêt (${used.join(' → ')}) : ${saved.title} dans Documents.`,
  }
}
