import type { AtlasFile } from './files'

export type IdeaCard = { title: string; pitch: string }
export type CodeFile = { name: string; language: string; content: string }
export type ScreenMock = { name: string; blocks: string[] }
export type PlanStep = { title: string; done?: boolean }

export type ProjectPack = {
  room: string
  ideas?: IdeaCard[]
  files?: CodeFile[]
  document?: { title: string; body: string }
  table?: { headers: string[]; rows: string[][] }
  insights?: string[]
  screens?: ScreenMock[]
  colors?: string[]
  steps?: PlanStep[]
}

export function toolPrompt(roomId: string, ask: string, files?: AtlasFile[]) {
  const develop = /Développe cette idée/i.test(ask)
  const job =
    roomId === 'ideas' && develop
      ? `Développe l’idée en livrable. JSON : {"title":"...","body":"...plan...","steps":[{"title":"..."}]}`
      : roomId === 'ideas'
      ? `Génère 6 idées concrètes, originales et réalisables. JSON uniquement : {"ideas":[{"title":"...","pitch":"..."}]}`
      : roomId === 'code'
        ? `Livrable code réel, prêt à coller. JSON : {"explain":"...","files":[{"name":"fichier.ext","language":"ts|py|js|sql","content":"..."}]}`
        : roomId === 'docs'
          ? `Rédige le document complet, utilisable tel quel. JSON : {"title":"...","body":"...markdown..."}`
          : roomId === 'data'
            ? `Analyse les données fournies (lis vraiment le tableau). JSON : {"summary":"...","insights":["..."],"next":["..."]}`
            : roomId === 'design'
              ? `Propose une maquette d’écrans. JSON : {"colors":["#112233"],"screens":[{"name":"Accueil","blocks":["Header","Liste","CTA"]}]}`
              : `Construis un plan d’action opérationnel. JSON : {"goal":"...","steps":[{"title":"..."}]}`
  const extra = files?.length
    ? `\nDonnées :\n${files.map((file) => `--- ${file.name} ---\n${(file.text || '').slice(0, 12000)}`).join('\n')}`
    : ''
  return `${job}\n\nDemande : ${ask.trim() || 'Propose une première version utile.'}${extra}`
}

export function parseCsv(text: string) {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 40)
  if (lines.length < 2) return null
  const split = (line: string) => line.split(/[;,\t]/).map((cell) => cell.replace(/^"|"$/g, '').trim())
  const headers = split(lines[0]).slice(0, 8)
  if (headers.length < 2) return null
  const rows = lines.slice(1, 13).map((line) => split(line).slice(0, headers.length))
  return { headers, rows }
}

export function spokenForPack(pack: ProjectPack, fallback: string) {
  const clean = fallback.replace(/\{[\s\S]*\}/, '').replace(/```[\s\S]*?```/g, '').trim()
  if (pack.ideas?.length) return clean || `${pack.ideas.length} idées prêtes. Tape-en une pour que je la développe.`
  if (pack.files?.length) return clean || `${pack.files.length} fichier${pack.files.length > 1 ? 's' : ''} prêts. Tu peux les partager ou me demander une correction.`
  if (pack.document) return clean || `${pack.document.title} est rédigé. Partage-le ou dis-moi ce qu’il faut ajuster.`
  if (pack.screens?.length) return clean || `Maquette prête : ${pack.screens.map((s) => s.name).join(', ')}.`
  if (pack.steps?.length) return clean || `Plan en ${pack.steps.length} étapes. Coche-les pour les envoyer dans l’agenda.`
  if (pack.insights?.length || pack.table) return clean || 'Analyse prête. Lis le tableau et les insights, ou importe un autre fichier.'
  return clean || fallback.slice(0, 420)
}

export function parseProjectPack(room: string, raw: string, files?: AtlasFile[]): ProjectPack {
  const pack: ProjectPack = { room }
  const json = pullJson(raw)
  if (json) {
    if (Array.isArray(json.ideas)) {
      pack.ideas = json.ideas
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          title: String((item as { title?: string }).title || 'Idée'),
          pitch: String((item as { pitch?: string }).pitch || ''),
        }))
        .slice(0, 8)
    }
    if (Array.isArray(json.files)) {
      pack.files = json.files
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          name: String((item as { name?: string }).name || 'fichier.txt'),
          language: String((item as { language?: string }).language || ''),
          content: String((item as { content?: string }).content || ''),
        }))
        .filter((file) => file.content.trim())
        .slice(0, 6)
    }
    if (json.title || json.body) {
      pack.document = {
        title: String(json.title || 'Document'),
        body: String(json.body || raw),
      }
    }
    if (Array.isArray(json.insights)) pack.insights = json.insights.map(String).slice(0, 8)
    if (Array.isArray(json.next) && !pack.insights?.length) pack.insights = json.next.map(String).slice(0, 8)
    if (Array.isArray(json.screens)) {
      pack.screens = json.screens.map((item) => ({
        name: String((item as { name?: string }).name || 'Écran'),
        blocks: Array.isArray((item as { blocks?: string[] }).blocks)
          ? (item as { blocks: string[] }).blocks.map(String)
          : [],
      }))
    }
    if (Array.isArray(json.colors)) pack.colors = json.colors.map(String).slice(0, 8)
    if (Array.isArray(json.steps)) {
      pack.steps = json.steps.map((item) => ({
        title: typeof item === 'string' ? item : String((item as { title?: string }).title || ''),
      })).filter((step) => step.title)
    }
    if (typeof json.explain === 'string' && json.explain && !pack.document) {
      pack.document = { title: 'Explication', body: json.explain }
    }
  }
  if (!pack.ideas?.length && room === 'ideas') pack.ideas = ideasFromText(raw)
  if (!pack.files?.length && room === 'code') {
    const fenced = raw.match(/```[\w.-]*\n([\s\S]*?)```/)
    if (fenced?.[1]) pack.files = [{ name: 'code.txt', language: '', content: fenced[1].trim() }]
  }
  if (!pack.document && room === 'docs') {
    const body = raw.replace(/\{[\s\S]*\}/, '').trim() || raw.trim()
    if (body) pack.document = { title: 'Document', body }
  }
  if (!pack.document && room === 'data' && !pack.insights?.length) {
    const body = raw.replace(/\{[\s\S]*\}/, '').trim()
    if (body) pack.document = { title: 'Analyse', body }
  }
  if (!pack.steps?.length && room === 'strategy') pack.steps = stepsFromText(raw)
  const csv = files?.map((file) => file.text || '').find((text) => text.includes(',') || text.includes(';'))
  if (csv) pack.table = parseCsv(csv) || pack.table
  return pack
}

function pullJson(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function ideasFromText(raw: string): IdeaCard[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[\.)]|[-•])\s*/, '').trim())
    .filter((line) => line.length > 8 && line.length < 180)
    .slice(0, 6)
    .map((line) => {
      const [title, ...rest] = line.split(/[:–—-]/)
      return { title: title.trim(), pitch: rest.join('—').trim() }
    })
}

function stepsFromText(raw: string): PlanStep[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[\.)]|[-•])\s*/, '').trim())
    .filter((line) => line.length > 4 && line.length < 160)
    .slice(0, 10)
    .map((title) => ({ title }))
}
