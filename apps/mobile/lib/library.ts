import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { webOrigin } from './config'
import type { AtlasFile } from './files'
import { currentUserId } from './session'

export type LibraryKind = 'image' | 'video' | 'document' | 'generated'

export type LibraryItem = {
  id: string
  name: string
  kind: LibraryKind
  mime: string
  size: number
  uri: string
  thumbUri?: string
  text?: string
  prompt?: string
  source: 'import' | 'camera' | 'atlas'
  createdAt: number
  note?: string
}

export type LibraryFilter = 'all' | 'image' | 'video' | 'document' | 'generated'

const ROOT = `${FileSystem.documentDirectory || ''}atlas-library/`
const INDEX = `${ROOT}index.json`

async function ensureRoot() {
  const info = await FileSystem.getInfoAsync(ROOT)
  if (!info.exists) await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true })
}

async function readIndex(): Promise<LibraryItem[]> {
  await ensureRoot()
  try {
    const raw = await FileSystem.readAsStringAsync(INDEX)
    const parsed = JSON.parse(raw) as LibraryItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeIndex(items: LibraryItem[]) {
  await ensureRoot()
  await FileSystem.writeAsStringAsync(INDEX, JSON.stringify(items.slice(0, 400)))
}

function safeName(name: string) {
  return name.replace(/[^\w.\-àâäéèêëïîôùûüç ]+/gi, '_').slice(0, 80) || `fichier-${Date.now()}`
}

async function copyIntoLibrary(uri: string, name: string) {
  await ensureRoot()
  const dest = `${ROOT}${Date.now()}-${safeName(name)}`
  try {
    await FileSystem.copyAsync({ from: uri, to: dest })
    return dest
  } catch {
    return uri
  }
}

async function makeImageThumb(uri: string) {
  try {
    const done = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 480 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    })
    return done.uri
  } catch {
    return uri
  }
}

async function makeVideoThumb(uri: string) {
  try {
    const shot = await VideoThumbnails.getThumbnailAsync(uri, { time: 800 })
    return shot.uri
  } catch {
    try {
      const shot = await VideoThumbnails.getThumbnailAsync(uri, { time: 0 })
      return shot.uri
    } catch {
      return undefined
    }
  }
}

export async function listLibrary(filter: LibraryFilter = 'all') {
  const items = await readIndex()
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt)
  if (filter === 'all') return sorted
  if (filter === 'generated') return sorted.filter((item) => item.kind === 'generated' || item.source === 'atlas')
  return sorted.filter((item) => item.kind === filter)
}

export async function addLibraryItem(input: {
  name: string
  kind: LibraryKind
  mime: string
  size?: number
  uri: string
  text?: string
  prompt?: string
  source: LibraryItem['source']
  note?: string
  copy?: boolean
}) {
  const uri = input.copy === false ? input.uri : await copyIntoLibrary(input.uri, input.name)
  let thumbUri: string | undefined
  if (input.kind === 'image' || input.kind === 'generated') thumbUri = await makeImageThumb(uri)
  if (input.kind === 'video') thumbUri = await makeVideoThumb(uri)

  const item: LibraryItem = {
    id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    kind: input.kind,
    mime: input.mime,
    size: input.size || 0,
    uri,
    thumbUri,
    text: input.text?.slice(0, 60000),
    prompt: input.prompt,
    source: input.source,
    createdAt: Date.now(),
    note: input.note,
  }
  const items = await readIndex()
  items.unshift(item)
  await writeIndex(items)
  return item
}

export async function removeLibraryItem(id: string) {
  const items = await readIndex()
  const next = items.filter((item) => item.id !== id)
  await writeIndex(next)
}

export async function importAtlasFiles(files: AtlasFile[], source: LibraryItem['source'] = 'import') {
  const added: LibraryItem[] = []
  for (const file of files) {
    const kind: LibraryKind =
      file.kind === 'image'
        ? 'image'
        : /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name) || /^video\//i.test(file.mime)
          ? 'video'
          : 'document'
    added.push(
      await addLibraryItem({
        name: file.name,
        kind,
        mime: file.mime,
        size: file.size,
        uri: file.uri,
        text: file.text,
        source,
      }),
    )
  }
  return added
}

export async function visionDataUrl(uri: string) {
  try {
    const done = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    })
    return done.base64 ? `data:image/jpeg;base64,${done.base64}` : ''
  } catch {
    return ''
  }
}

/** Prépare le contexte Atlas pour lire un élément (doc complet, image, vidéo). */
export async function prepareLibraryAsk(item: LibraryItem, ask?: string) {
  const order =
    ask?.trim() ||
    (item.kind === 'video'
      ? 'Regarde cette vidéo (images clés jointes). Explique clairement : sujet, scènes, actions, message, détails importants. Complet, comme un professeur.'
      : item.kind === 'image' || item.kind === 'generated'
        ? 'Lis complètement cette image : texte, objets, contexte. Explique clairement tout ce qui compte.'
        : 'Lis entièrement ce document. Explique-le clairement, structure le contenu, et extrais l’essentiel sans rien inventer.')

  let image: string | undefined
  let body = ''

  if (item.kind === 'document') {
    const text =
      item.text ||
      (await FileSystem.readAsStringAsync(item.uri, { encoding: FileSystem.EncodingType.UTF8 }).catch(() => ''))
    const clean = text.replace(/\u0000/g, ' ').slice(0, 60000)
    body = `${order}\n\n--- Document : ${item.name} ---\n${clean || '(Peu de texte extractible. Décris ce que tu peux et dis si un OCR / Studio PC est nécessaire.)'}`
  } else if (item.kind === 'image' || item.kind === 'generated') {
    image = await visionDataUrl(item.uri)
    body = `${order}\n\nFichier : ${item.name}${item.prompt ? `\nPrompt de génération : ${item.prompt}` : ''}`
  } else if (item.kind === 'video') {
    const frames: string[] = []
    for (const time of [400, 2500, 5000, 9000]) {
      try {
        const shot = await VideoThumbnails.getThumbnailAsync(item.uri, { time })
        const data = await visionDataUrl(shot.uri)
        if (data) frames.push(data)
      } catch {
        /* frame skip */
      }
    }
    image = frames[0]
    body = [
      order,
      `Vidéo : ${item.name}`,
      `Durée / taille : ${item.size ? `${(item.size / (1024 * 1024)).toFixed(1)} Mo` : 'inconnue'}`,
      frames.length > 1
        ? `${frames.length} images clés extraites (la principale est jointe). Décris la vidéo à partir de ces scènes.`
        : 'Une image clé est jointe si disponible.',
      item.note ? `Note : ${item.note}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    // stash extra frames in text for models that only take one image — describe that more frames exist
    if (frames.length > 1) {
      body += `\n(Images clés supplémentaires disponibles côté appareil : ${frames.length}.)`
    }
  } else {
    body = order
  }

  return { text: body, image, skill: item.kind === 'video' || item.kind === 'image' || item.kind === 'generated' ? 'scan' as const : 'document' as const }
}

export async function generateLibraryImage(prompt: string, title?: string) {
  const userId = (await currentUserId()) || 'harold'
  const response = await fetch(`${webOrigin}/api/atlas/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-atlas-user': userId,
    },
    body: JSON.stringify({ kind: 'image', prompt, title: title || prompt.slice(0, 48), open: false }),
    signal: AbortSignal.timeout(90000),
  })
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    preview?: string
    title?: string
    summary?: string
    path?: string
  }
  if (!response.ok || !body.ok) throw new Error(body.error || 'Génération image impossible.')
  if (!body.preview?.startsWith('data:image')) throw new Error('Le Studio n’a pas renvoyé d’image.')

  const match = body.preview.match(/^data:(image\/[\w+.-]+);base64,(.+)$/i)
  if (!match) throw new Error('Format image invalide.')
  await ensureRoot()
  const name = `${safeName(body.title || 'atlas-image')}.jpg`
  const dest = `${ROOT}${Date.now()}-${name}`
  await FileSystem.writeAsStringAsync(dest, match[2], { encoding: FileSystem.EncodingType.Base64 })

  const item = await addLibraryItem({
    name,
    kind: 'generated',
    mime: match[1],
    uri: dest,
    prompt,
    source: 'atlas',
    note: body.summary || body.path,
    copy: false,
  })
  return { item, summary: body.summary || 'Image générée et rangée dans la Bibliothèque.' }
}

export type ArtifactHint = 'auto' | 'report' | 'document' | 'invoice' | 'image' | 'brief' | 'code'

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** Détecte une demande de génération d’image / visuel. */
export function wantsLibraryImage(text: string) {
  return /\b(g[eé]n[eè]re|cr[eé]e|fais|dessine|produis)\b.{0,40}\b(image|visuel|illustration|affiche|poster|banni[eè]re|logo|photo|picto)\b|\b(image|visuel|illustration|affiche)\b.{0,20}\b(pour|de|sur)\b/i.test(text)
}

function classifyArtifact(text: string, hint: ArtifactHint = 'auto'): Exclude<ArtifactHint, 'auto' | 'image'> {
  if (hint !== 'auto' && hint !== 'image') return hint
  if (/facture|invoice|re[cç]u|avoir\b|devis/i.test(text)) return 'invoice'
  if (/rapport|bilan|compte[- ]rendu|brief(?:ing)?|status|statut/i.test(text)) return 'report'
  if (/```|function |const |class |import /i.test(text)) return 'code'
  if (/brief/i.test(text)) return 'brief'
  return 'document'
}

const LABEL: Record<Exclude<ArtifactHint, 'auto' | 'image'>, string> = {
  report: 'Rapport',
  document: 'Document',
  invoice: 'Facture',
  brief: 'Briefing',
  code: 'Code',
}

/** Enregistre un texte produit (rapport, doc, facture…) dans la Bibliothèque. */
export async function addLibraryText(input: {
  title?: string
  body: string
  hint?: ArtifactHint
  author?: string
  note?: string
}): Promise<LibraryItem | null> {
  const body = String(input.body || '').replace(/\s+$/g, '').trim()
  if (body.length < 48) return null
  const kind = classifyArtifact(`${input.title || ''} ${body} ${input.note || ''}`, input.hint || 'auto')
  const who = input.author?.trim() || 'ATLAS'
  const label = LABEL[kind]
  const base = safeName(input.title?.trim() || `${label}-${who}`)
  const name = `${base}-${stamp()}.md`
  await ensureRoot()
  const dest = `${ROOT}${Date.now()}-${name}`
  const header = [
    `# ${input.title?.trim() || label}`,
    ``,
    `- Auteur : ${who}`,
    `- Type : ${label}`,
    `- Date: ${new Date().toLocaleString('en-US')}`,
    input.note ? `- Note : ${input.note}` : '',
    ``,
    `---`,
    ``,
    body,
  ].filter((line) => line !== undefined).join('\n')
  await FileSystem.writeAsStringAsync(dest, header, { encoding: FileSystem.EncodingType.UTF8 })
  return addLibraryItem({
    name,
    kind: 'document',
    mime: 'text/markdown',
    size: header.length,
    uri: dest,
    text: header.slice(0, 60000),
    source: 'atlas',
    note: [label, who, input.note].filter(Boolean).join(' · '),
    copy: false,
  })
}

/** Enregistre une image data-URL (ex. Flare) dans la Bibliothèque. */
export async function addLibraryDataImage(input: {
  dataUrl: string
  title?: string
  prompt?: string
  note?: string
}): Promise<LibraryItem | null> {
  const match = input.dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/i)
  if (!match) return null
  await ensureRoot()
  const ext = /png/i.test(match[1]) ? 'png' : /webp/i.test(match[1]) ? 'webp' : 'jpg'
  const name = `${safeName(input.title || 'atlas-image')}-${stamp()}.${ext}`
  const dest = `${ROOT}${Date.now()}-${name}`
  await FileSystem.writeAsStringAsync(dest, match[2], { encoding: FileSystem.EncodingType.Base64 })
  return addLibraryItem({
    name,
    kind: 'generated',
    mime: match[1],
    uri: dest,
    prompt: input.prompt,
    source: 'atlas',
    note: input.note,
    copy: false,
  })
}

/**
 * Range automatiquement ce qu’ATLAS / un agent vient de produire.
 * Images (génération Studio), documents, rapports, factures, briefs.
 */
export async function saveAtlasArtifact(input: {
  ask?: string
  title?: string
  body?: string
  reply?: string
  hint?: ArtifactHint
  author?: string
  note?: string
  dataUrl?: string
}): Promise<{ item: LibraryItem; summary: string } | null> {
  const ask = String(input.ask || '')
  const written = String(input.body || input.reply || '').trim()

  if (input.dataUrl?.startsWith('data:image')) {
    const item = await addLibraryDataImage({
      dataUrl: input.dataUrl,
      title: input.title,
      prompt: ask || input.note,
      note: input.note || input.author,
    })
    if (item) return { item, summary: `Image rangée dans la Bibliothèque : ${item.name}` }
  }

  if (wantsLibraryImage(ask) && !input.dataUrl) {
    try {
      const made = await generateLibraryImage(ask, input.title)
      return made
    } catch {
      /* tombe sur sauvegarde texte si dispo */
    }
  }

  const hint = input.hint || (wantsLibraryImage(ask) ? 'document' : 'auto')
  const force =
    hint === 'report'
    || hint === 'invoice'
    || hint === 'brief'
    || /rapport|facture|document|brief|bilan|compte[- ]rendu/i.test(`${ask} ${input.title || ''}`)
  if (!force && written.length < 120) return null

  const item = await addLibraryText({
    title: input.title,
    body: written,
    hint,
    author: input.author,
    note: input.note,
  })
  if (!item) return null
  return { item, summary: `Enregistré dans la Bibliothèque : ${item.name}` }
}
