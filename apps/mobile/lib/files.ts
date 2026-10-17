import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'

export type AtlasFile = {
  name: string
  mime: string
  size: number
  uri: string
  kind: 'image' | 'text' | 'binary' | 'video'
  text?: string
  image?: string
  duration?: number
}

const TEXT_MIME = /^(text\/|application\/(json|xml|javascript|csv|sql|pdf)|application\/x-)/i
const TEXT_EXT = /\.(txt|md|csv|json|xml|html|htm|js|ts|tsx|py|java|c|cpp|h|css|yml|yaml|log|rtf|tex|ini|env|pdf|docx?)$/i
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i

function classify(name: string, mime: string): AtlasFile['kind'] {
  if (/^video\//i.test(mime) || VIDEO_EXT.test(name)) return 'video'
  if (/^image\//i.test(mime) || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(name)) return 'image'
  if (TEXT_MIME.test(mime) || TEXT_EXT.test(name)) return 'text'
  return 'binary'
}

async function readText(uri: string, limit = 60000) {
  try {
    const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 })
    return raw.replace(/\u0000/g, ' ').slice(0, limit)
  } catch {
    return ''
  }
}

async function shrinkImage(uri: string) {
  try {
    const done = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    })
    return done.base64 ? `data:image/jpeg;base64,${done.base64}` : ''
  } catch {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      return b64 ? `data:image/jpeg;base64,${b64.slice(0, 900000)}` : ''
    } catch {
      return ''
    }
  }
}

async function fromAsset(asset: {
  name?: string | null
  mimeType?: string | null
  size?: number | null
  uri: string
  duration?: number | null
}): Promise<AtlasFile> {
  const name = asset.name || asset.uri.split('/').pop() || 'fichier'
  const mime = asset.mimeType || 'application/octet-stream'
  const size = asset.size || 0
  const kind = classify(name, mime)
  const file: AtlasFile = { name, mime, size, uri: asset.uri, kind, duration: asset.duration || undefined }
  if (kind === 'image') file.image = await shrinkImage(asset.uri)
  else if (kind === 'text') file.text = await readText(asset.uri)
  else if (kind === 'video') {
    /* frames handled in library prepare */
  } else {
    const sniff = await readText(asset.uri)
    const printable = sniff.replace(/[^\t\n\r\x20-\x7EÀ-ÿ]/g, '')
    if (printable.trim().length > 40) file.text = printable.slice(0, 50000)
  }
  return file
}

export async function pickDocuments(): Promise<AtlasFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: true,
  })
  if (result.canceled) return []
  const files: AtlasFile[] = []
  for (const asset of result.assets) files.push(await fromAsset(asset))
  return files
}

export async function captureDocument(mode: 'camera' | 'library'): Promise<AtlasFile[]> {
  const granted = mode === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!granted.granted) return []
  const result = mode === 'camera'
    ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        allowsMultipleSelection: true,
        mediaTypes: ['images'],
      })
  if (result.canceled) return []
  const files: AtlasFile[] = []
  for (const asset of result.assets) {
    files.push(await fromAsset({
      name: asset.fileName || `capture-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
      uri: asset.uri,
    }))
  }
  return files
}

export async function pickMedia(kinds: Array<'images' | 'videos'> = ['images', 'videos']): Promise<AtlasFile[]> {
  const granted = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!granted.granted) return []
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.85,
    allowsMultipleSelection: true,
    mediaTypes: kinds,
  })
  if (result.canceled) return []
  const files: AtlasFile[] = []
  for (const asset of result.assets) {
    const isVideo = asset.type === 'video' || /^video\//i.test(asset.mimeType || '')
    files.push(await fromAsset({
      name: asset.fileName || `${isVideo ? 'video' : 'image'}-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      size: asset.fileSize,
      uri: asset.uri,
      duration: asset.duration,
    }))
  }
  return files
}

export function filesBrief(files: AtlasFile[]) {
  if (!files.length) return ''
  return files.map((file) => {
    const mega = file.size > 0 ? ` · ${(file.size / (1024 * 1024)).toFixed(file.size > 5_000_000 ? 1 : 2)} Mo` : ''
    const excerpt = file.text ? `\n--- ${file.name} ---\n${file.text.slice(0, 20000)}` : ''
    return `Fichier : ${file.name} (${file.kind} · ${file.mime || 'inconnu'}${mega})${excerpt}`
  }).join('\n')
}

export function filesPrompt(files: AtlasFile[], ask: string) {
  const order = ask.trim() || 'Analyse ce contenu : lis tout ce qui est lisible, explique clairement, et extrais ce qui compte.'
  return `${order}\n\nPièces jointes :\n${filesBrief(files)}`
}
