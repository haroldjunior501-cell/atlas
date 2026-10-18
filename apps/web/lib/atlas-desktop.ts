/**
 * Atlas Desktop Agent — contrôle local Windows (sandbox).
 * Apps allowlistées + apps installées (raccourcis menu Démarrer).
 * Jamais de shell libre. Chemins hors racines → refusés.
 */
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { basename, extname, join, normalize, relative, resolve, sep } from 'node:path'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { McpTool } from '@/lib/atlas-mcp'
import { describeSupportedControls, parseAppControl, runAppControl } from '@/lib/atlas-desktop-control'

const execFileAsync = promisify(execFile)

export const DESKTOP_TOOLS: McpTool[] = [
  { name: 'open_app', description: 'Ouvrir une app installée sur le PC (menu Démarrer, Word, Chrome, Spotify…)' },
  { name: 'open_url', description: 'Ouvrir une URL https dans le navigateur par défaut du PC' },
  { name: 'control_app', description: 'Exécuter une action dans une app (jouer un son sur Spotify, chercher dans Notion, écrire dans Word…)' },
  { name: 'list_apps', description: 'Lister les applications installées détectées sur cet ordinateur' },
  { name: 'list_files', description: 'Lister les fichiers du Bureau ou Documents' },
  { name: 'open_file', description: 'Ouvrir un fichier du Bureau ou Documents' },
  { name: 'create_document', description: 'Créer un document .txt/.md/.csv/.json/.html dans Documents (title, body)' },
  { name: 'write_document', description: 'Écrire ou compléter un document existant (title, body, mode=replace|append)' },
  { name: 'read_document', description: 'Lire le contenu texte d’un document Documents/Bureau (title)' },
  { name: 'open_folder', description: 'Ouvrir le Bureau ou Documents dans l’Explorateur' },
  { name: 'status', description: 'Capacités de l’agent ordinateur' },
]

const APPS: Record<string, { label: string; commands: string[] }> = {
  word: { label: 'Microsoft Word', commands: ['winword', 'WINWORD.EXE'] },
  excel: { label: 'Microsoft Excel', commands: ['excel', 'EXCEL.EXE'] },
  powerpoint: { label: 'PowerPoint', commands: ['powerpnt', 'POWERPNT.EXE'] },
  chrome: { label: 'Google Chrome', commands: ['chrome', 'chrome.exe'] },
  edge: { label: 'Microsoft Edge', commands: ['msedge', 'msedge.exe'] },
  notepad: { label: 'Bloc-notes', commands: ['notepad'] },
  explorer: { label: 'Explorateur', commands: ['explorer'] },
  calculator: { label: 'Calculatrice', commands: ['calc'] },
  paint: { label: 'Paint', commands: ['mspaint'] },
  vscode: { label: 'VS Code', commands: ['code'] },
  cursor: { label: 'Cursor', commands: ['cursor'] },
  terminal: { label: 'Terminal', commands: ['wt', 'powershell'] },
  spotify: { label: 'Spotify', commands: ['spotify:', 'Spotify'] },
  discord: { label: 'Discord', commands: ['discord://', 'Discord'] },
  slack: { label: 'Slack', commands: ['slack://', 'Slack'] },
  notion: { label: 'Notion', commands: ['notion://', 'Notion'] },
}

const APP_ALIASES: Record<string, string> = {
  word: 'word', microsoftword: 'word', winword: 'word', document: 'word',
  excel: 'excel', tableur: 'excel',
  powerpoint: 'powerpoint', ppt: 'powerpoint', presentation: 'powerpoint',
  chrome: 'chrome', googlechrome: 'chrome',
  edge: 'edge', microsoftedge: 'edge',
  notepad: 'notepad', blocnotes: 'notepad',
  explorateur: 'explorer', explorer: 'explorer', fichiers: 'explorer',
  calculatrice: 'calculator', calc: 'calculator',
  paint: 'paint',
  vscode: 'vscode', code: 'vscode',
  cursor: 'cursor',
  terminal: 'terminal', powershell: 'terminal',
  spotify: 'spotify', spot: 'spotify',
  discord: 'discord',
  slack: 'slack',
  notion: 'notion',
}

type InstalledApp = { name: string; path: string; source: 'start-menu' | 'path' | 'builtin' }

let appsCache: { at: number; apps: InstalledApp[] } | null = null
const CACHE_MS = 60_000

function roots() {
  const home = homedir()
  return {
    desktop: join(home, 'Desktop'),
    documents: join(home, 'Documents'),
    downloads: join(home, 'Downloads'),
  }
}

function resolveRoot(name?: string) {
  const map = roots()
  const key = String(name || 'documents').toLowerCase()
  if (/bureau|desktop/.test(key)) return map.desktop
  if (/download|t[eé]l[eé]charg/.test(key)) return map.downloads
  return map.documents
}

function assertInsideRoot(root: string, target: string) {
  const base = resolve(root)
  const full = resolve(target)
  const rel = relative(base, full)
  if (rel.startsWith('..') || rel.includes(`..${sep}`) || resolve(base, rel) !== full) {
    throw new Error('Accès refusé : hors du Bureau / Documents / Téléchargements.')
  }
  return full
}

function normalizeKey(raw: string) {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '')
}

function sanitizeAppQuery(raw: string) {
  return raw
    .replace(/[<>:"|?*;&`$(){}[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function isUnsafeLaunchTarget(target: string) {
  const lower = target.toLowerCase()
  return /powershell|cmd\.exe|wscript|cscript|mshta|regsvr32|rundll32|certutil|bitsadmin|curl\s|wget\s|\|\s*(ba)?sh|rm\s+-rf|format\s+|shutdown|reboot/i.test(lower)
    && !/windows\\system32\\(notepad|calc|mspaint|write)\.exe$/i.test(lower)
}

function launchAllowed(target: string) {
  const full = resolve(normalize(target))
  const ext = extname(full).toLowerCase()
  const home = homedir()
  const userRoots = [join(home, 'Desktop'), join(home, 'Documents'), join(home, 'Downloads')]
  const inUserFiles = userRoots.some((root) => {
    const base = resolve(root)
    const rel = relative(base, full)
    return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`))
  })
  // Bureau / Documents / Téléchargements : ouvrir n’importe quel fichier
  if (inUserFiles) return !isUnsafeLaunchTarget(full)

  if (!['.lnk', '.exe', '.bat', '.cmd', '.url', ''].includes(ext) && process.platform === 'win32') {
    return false
  }
  if (isUnsafeLaunchTarget(full)) return false
  const allowed = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.ProgramW6432,
    join(home, 'AppData', 'Local', 'Programs'),
    join(home, 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
    join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu'),
    join(home, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu'),
    'C:\\Windows\\System32',
    'C:\\Windows\\SysWOW64',
    'C:\\Windows',
  ].filter(Boolean) as string[]
  return allowed.some((root) => {
    const base = resolve(root)
    const rel = relative(base, full)
    return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`))
  })
}

async function startProcess(command: string, args: string[] = []) {
  if (process.platform !== 'win32') {
    await execFileAsync(command, args, { windowsHide: true }).catch(async () => {
      await execFileAsync('xdg-open', args.length ? args : [command], { windowsHide: true })
    })
    return
  }
  // URI schemes (spotify:, notion://…) — pas un chemin fichier
  if (/^[a-z][a-z0-9+.-]*:/i.test(command)) {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', `Start-Process ${JSON.stringify(command)}`],
      { windowsHide: true, timeout: 12000 },
    )
    return
  }
  if (command.includes('\\') || command.includes('/') || /\.(lnk|exe|bat|cmd|url)$/i.test(command)) {
    if (!launchAllowed(command)) {
      throw new Error('Lancement refusé : emplacement non autorisé.')
    }
  }
  const ps = `Start-Process -FilePath ${JSON.stringify(command)}${args.length ? ` -ArgumentList ${args.map((a) => JSON.stringify(a)).join(',')}` : ''}`
  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true, timeout: 12000 })
  } catch {
    await execFileAsync(command, args, { windowsHide: true, shell: true, timeout: 12000 })
  }
}

async function discoverStartMenuApps(): Promise<InstalledApp[]> {
  if (process.platform !== 'win32') return []
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$roots = @(
  "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
  "$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs",
  [Environment]::GetFolderPath('Desktop')
)
$seen = @{}
$items = foreach ($root in $roots) {
  if (-not (Test-Path $root)) { continue }
  Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
    $_.Extension -in '.lnk','.url'
  } | ForEach-Object {
    $name = [IO.Path]::GetFileNameWithoutExtension($_.Name)
    if (-not $name) { return }
    $key = $name.ToLowerInvariant()
    if ($seen.ContainsKey($key)) { return }
    if ($name -match '^(Uninstall|Desinstaller|Help|Aide|Release Notes|Readme|Documentation)$') { return }
    $seen[$key] = $true
    [PSCustomObject]@{ name = $name; path = $_.FullName }
  }
}
$items | ConvertTo-Json -Compress
`.trim()
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
    )
    const raw = stdout.trim()
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{ name: string; path: string }> | { name: string; path: string }
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list
      .filter((item) => item?.name && item?.path && launchAllowed(item.path))
      .map((item) => ({ name: item.name, path: item.path, source: 'start-menu' as const }))
  } catch {
    return []
  }
}

async function resolveOnPath(name: string): Promise<InstalledApp | null> {
  if (process.platform !== 'win32') return null
  const clean = sanitizeAppQuery(name)
  if (!clean || /\s/.test(clean)) return null
  try {
    const { stdout } = await execFileAsync('where.exe', [clean], { windowsHide: true, timeout: 6000 })
    const first = stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => /\.exe$/i.test(line))
    if (!first || !launchAllowed(first)) return null
    return { name: clean, path: first, source: 'path' }
  } catch {
    return null
  }
}

export async function listInstalledApps(force = false): Promise<InstalledApp[]> {
  if (!force && appsCache && Date.now() - appsCache.at < CACHE_MS) return appsCache.apps
  const builtins: InstalledApp[] = Object.entries(APPS).map(([id, app]) => ({
    name: app.label,
    path: app.commands[0],
    source: 'builtin',
  }))
  const discovered = await discoverStartMenuApps()
  const merged = new Map<string, InstalledApp>()
  for (const item of [...builtins, ...discovered]) {
    const key = normalizeKey(item.name)
    if (!key) continue
    if (!merged.has(key)) merged.set(key, item)
  }
  const apps = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  appsCache = { at: Date.now(), apps }
  return apps
}

function scoreAppMatch(query: string, appName: string) {
  const q = normalizeKey(query)
  const n = normalizeKey(appName)
  if (!q || !n) return 0
  if (n === q) return 100
  if (n.startsWith(q)) return 80
  if (n.includes(q)) return 60
  if (q.includes(n) && n.length >= 3) return 40
  // token overlap
  const qt = q.match(/[a-z0-9]{3,}/g) ?? []
  const hits = qt.filter((token) => n.includes(token)).length
  return hits ? 20 + hits * 10 : 0
}

export async function findInstalledApp(query: string): Promise<InstalledApp | null> {
  const clean = sanitizeAppQuery(query)
  if (!clean) return null
  const apps = await listInstalledApps()
  let best: InstalledApp | null = null
  let bestScore = 0
  for (const app of apps) {
    const score = scoreAppMatch(clean, app.name)
    if (score > bestScore) {
      best = app
      bestScore = score
    }
  }
  if (best && bestScore >= 40) return best
  const onPath = await resolveOnPath(clean)
  return onPath
}

export function matchDesktopApp(raw: string): string | null {
  const compact = normalizeKey(raw)
  for (const [alias, id] of Object.entries(APP_ALIASES)) {
    if (compact.includes(alias)) return id
  }
  if (/word|document word/.test(raw.toLowerCase())) return 'word'
  if (/excel|tableur/.test(raw.toLowerCase())) return 'excel'
  if (/chrome|navigateur google/.test(raw.toLowerCase())) return 'chrome'
  if (/bloc[- ]?notes|notepad/.test(raw.toLowerCase())) return 'notepad'
  if (/explorateur|mes fichiers/.test(raw.toLowerCase())) return 'explorer'
  if (/spotify/.test(raw.toLowerCase())) return 'spotify'
  if (/discord/.test(raw.toLowerCase())) return 'discord'
  if (/notion/.test(raw.toLowerCase())) return 'notion'
  if (/slack/.test(raw.toLowerCase())) return 'slack'
  return null
}

/** Extrait un nom d’app depuis une phrase « ouvre Spotify », « lance Discord », etc. */
export function extractAppRequest(raw: string): string {
  const text = sanitizeAppQuery(raw)
  const match = text.match(
    /(?:ouvre|ouvrir|lance|lancer|d[eé]marre|demarre|start|run|exécute|execute)\s+(?:l['’]|le |la |les |l application |l['’]app |application |app )?(.+)$/i,
  )
  let name = (match?.[1] || text)
    .replace(/\b(?:s['’]il te pla[iî]t|stp|please)\b/gi, '')
    .replace(/\b(?:sur (?:mon |l['’])?(?:pc|ordinateur|machine|bureau))\b/gi, '')
    .replace(/\b(?:application|logiciel|programme)\b/gi, '')
    .trim()
  // Si la phrase entière est juste le nom
  if (!match) {
    name = text
      .replace(/^(?:atlas[, ]*)?/i, '')
      .trim()
  }
  return sanitizeAppQuery(name).slice(0, 60)
}

async function openBuiltinOrInstalled(asked: string): Promise<string> {
  const id = matchDesktopApp(asked) || normalizeKey(asked)
  const builtin = APPS[id]
  if (builtin) {
    let lastError: unknown
    for (const command of builtin.commands) {
      try {
        await startProcess(command)
        return `${builtin.label} est ouvert.`
      } catch (error) {
        lastError = error
      }
    }
    throw new Error(`Impossible d’ouvrir ${builtin.label}. ${lastError instanceof Error ? lastError.message : ''}`.trim())
  }

  const query = extractAppRequest(asked) || sanitizeAppQuery(asked)
  const found = await findInstalledApp(query)
  if (!found) {
    const sample = (await listInstalledApps()).slice(0, 12).map((app) => app.name).join(', ')
    return `Je ne trouve pas « ${query} » parmi les applications installées. Exemples détectés : ${sample || 'aucune'}. Dis « liste mes applications » pour tout voir.`
  }
  await startProcess(found.path)
  return `${found.name} est ouvert.`
}

export async function desktopInvoke(tool: string, args: Record<string, unknown> = {}): Promise<string> {
  const name = tool.toLowerCase()
  if (name === 'status' || name === 'commandes' || name === 'surveillance') {
    const installed = await listInstalledApps()
    const preview = installed.slice(0, 15).map((app) => app.name).join(', ')
    return `Agent ordinateur prêt. ${installed.length} apps détectées. Pilotage in-app : ${describeSupportedControls()}. Aperçu installées : ${preview}${installed.length > 15 ? '…' : ''}.`
  }
  if (name === 'list_apps' || name === 'apps' || name === 'applications') {
    const installed = await listInstalledApps(true)
    if (!installed.length) return 'Aucune application détectée sur cet ordinateur.'
    const lines = installed.slice(0, 60).map((app) => `• ${app.name}`)
    return `${installed.length} application${installed.length > 1 ? 's' : ''} détectée${installed.length > 1 ? 's' : ''} :\n${lines.join('\n')}${installed.length > 60 ? '\n…' : ''}`
  }
  if (name === 'control_app' || name === 'run_in_app' || name === 'drive_app' || name === 'play') {
    const fromArgs = {
      app: String(args.app || args.target || ''),
      intent: String(args.intent || args.action || 'play'),
      query: String(args.query || args.q || args.track || args.song || args.body || ''),
      text: String(args.text || ''),
    }
    const parsed = parseAppControl(String(args.text || args.command || args.query || ''))
      || parseAppControl(`${fromArgs.intent} ${fromArgs.query} dans ${fromArgs.app}`.trim())
    const request = parsed || (fromArgs.app
      ? {
          app: fromArgs.app,
          intent: (/play|joue|search|cherche|pause|next|previous|type|open/i.test(fromArgs.intent)
            ? fromArgs.intent.replace(/joue/i, 'play').replace(/cherche/i, 'search').toLowerCase()
            : 'play') as 'play' | 'search' | 'pause' | 'next' | 'previous' | 'type' | 'open',
          query: fromArgs.query || fromArgs.text,
          text: fromArgs.text,
        }
      : null)
    if (!request?.app) {
      return 'Exemple : « Joue Tiakola dans Spotify », « Cherche budget dans Notion », « Écris bonjour dans Word ».'
    }
    return runAppControl(request)
  }
  if (name === 'open_url' || name === 'browse' || name === 'open_site' || name === 'ouvrir_url') {
    const raw = String(args.url || args.href || args.link || args.text || args.query || '').trim()
    const match = raw.match(/https?:\/\/[^\s"'<>]+/i)
    const url = (match?.[0] || raw).replace(/[),.;]+$/g, '')
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('URL https requise. Exemple : https://ztchosting.com/')
    }
    // Sites externes : https seulement (pas de file:// ni javascript:)
    if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) {
      throw new Error('Seules les URL https (ou localhost) sont autorisées.')
    }
    await startProcess(url)
    return `Navigateur ouvert sur ${url}`
  }
  if (name === 'open_app' || name === 'exec' || name === 'services' || name === 'launch') {
    const asked = String(args.app || args.name || args.query || args.text || '')
    // URL collée → navigateur
    if (/^https?:\/\//i.test(asked.trim())) {
      await startProcess(asked.trim())
      return `Navigateur ouvert sur ${asked.trim()}`
    }
    // Si la phrase contient une action in-app, basculer
    const control = parseAppControl(asked)
    if (control?.app && control.query) return runAppControl(control)
    if (!asked.trim()) {
      return 'Indique l’application à ouvrir. Exemple : « Ouvre Spotify » ou « Lance Discord ».'
    }
    return openBuiltinOrInstalled(asked)
  }
  if (name === 'open_folder') {
    const root = resolveRoot(String(args.folder || args.text || 'documents'))
    await startProcess('explorer', [root])
    return `Dossier ouvert : ${root}`
  }
  if (name === 'list_files' || name === 'lister' || name === 'lire') {
    const root = resolveRoot(String(args.folder || args.root || args.text || 'documents'))
    await access(root).catch(() => mkdir(root, { recursive: true }))
    const entries = await readdir(root, { withFileTypes: true })
    const lines = entries.slice(0, 30).map((entry) => `${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`)
    if (!lines.length) return `Aucun fichier dans ${root}.`
    return `Contenu de ${basename(root)} :\n${lines.join('\n')}`
  }
  if (name === 'open_file') {
    const root = resolveRoot(String(args.folder || 'documents'))
    const fileName = String(args.path || args.file || args.name || args.text || '').trim()
    if (!fileName) throw new Error('Indiquez le nom du fichier.')
    const full = assertInsideRoot(root, join(root, fileName.replace(/^.*[\\/]/, '')))
    await access(full)
    await startProcess(full)
    return `Fichier ouvert : ${basename(full)}`
  }
  if (name === 'create_document') {
    const root = resolveRoot('documents')
    await mkdir(root, { recursive: true })
    const rawTitle = String(args.title || args.name || args.filename || 'Note ATLAS')
    const extMatch = rawTitle.match(/\.(txt|md|csv|json|html)$/i)
    const extHint = String(args.ext || args.format || '').replace(/^\./, '').toLowerCase()
    const ext = extMatch
      ? `.${extMatch[1].toLowerCase()}`
      : /^(md|markdown)$/.test(extHint) ? '.md'
        : /^(csv|json|html|txt)$/.test(extHint) ? `.${extHint}`
          : '.txt'
    const title = rawTitle
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\.(txt|md|csv|json|html)$/i, '')
      .trim() || 'Note ATLAS'
    const hasBody = Object.prototype.hasOwnProperty.call(args, 'body')
      || Object.prototype.hasOwnProperty.call(args, 'content')
    const body = hasBody ? String(args.body ?? args.content ?? '') : ''
    const full = assertInsideRoot(root, join(root, `${title}${ext}`))
    await writeFile(full, body, 'utf8')
    const open = args.open !== false
    if (open) await startProcess(full).catch(() => undefined)
    return body
      ? `Document « ${title}${ext} » créé (${body.length} caractères) : ${full}`
      : `Fichier vide « ${title}${ext} » créé : ${full}`
  }
  if (name === 'write_document' || name === 'écrire' || name === 'ecrire') {
    const root = resolveRoot(String(args.folder || 'documents'))
    await mkdir(root, { recursive: true })
    const rawTitle = String(args.title || args.name || args.filename || '')
    const extMatch = rawTitle.match(/\.(txt|md|csv|json|html)$/i)
    const extHint = String(args.ext || args.format || '').replace(/^\./, '').toLowerCase()
    const ext = extMatch
      ? `.${extMatch[1].toLowerCase()}`
      : /^(md|markdown)$/.test(extHint) ? '.md'
        : /^(csv|json|html|txt)$/.test(extHint) ? `.${extHint}`
          : '.txt'
    const title = rawTitle
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\.(txt|md|csv|json|html)$/i, '')
      .trim()
    if (!title) throw new Error('Indiquez le nom du fichier à modifier.')
    const content = String(args.body ?? args.content ?? args.message ?? '')
    if (!content.trim()) throw new Error('Indiquez le texte à écrire dans le fichier.')
    const full = assertInsideRoot(root, join(root, `${title}${ext}`))
    const mode = String(args.mode || 'replace').toLowerCase() === 'append' ? 'append' : 'replace'
    let next = content
    if (mode === 'append') {
      const prev = await readFile(full, 'utf8').catch(() => '')
      next = prev ? `${prev.replace(/\s*$/, '')}\n${content}` : content
    }
    await writeFile(full, next, 'utf8')
    const open = args.open !== false
    if (open) await startProcess(full).catch(() => undefined)
    return mode === 'append'
      ? `Texte ajouté dans « ${title}${ext} » (${content.length} caractères) : ${full}`
      : `Texte écrit dans « ${title}${ext} » (${content.length} caractères) : ${full}`
  }
  if (name === 'read_document' || name === 'lire_document') {
    const folderHint = String(args.folder || args.text || 'documents')
    const roots = [/bureau|desktop/i.test(folderHint) ? 'desktop' : null, 'documents', 'downloads'].filter(Boolean) as Array<'desktop' | 'documents' | 'downloads'>
    const title = String(args.title || args.name || args.filename || args.path || '')
      .replace(/[<>:"/\\|?*]/g, '-')
      .trim()
    if (!title) throw new Error('Indiquez le nom du fichier à lire.')
    const base = title.replace(/\.(txt|md|csv|json|html|log|pdf)$/i, '')
    const candidates = [
      title,
      `${base}.txt`,
      `${base}.md`,
      `${base}.csv`,
      `${base}.json`,
      `${base}.html`,
      `${base}.log`,
    ]
    for (const rootName of [...new Set(roots)]) {
      const root = resolveRoot(rootName)
      for (const candidate of candidates) {
        const full = assertInsideRoot(root, join(root, candidate.replace(/^.*[\\/]/, '')))
        try {
          await access(full)
          const ext = extname(full).toLowerCase()
          if (ext === '.pdf') {
            throw new Error(`Le PDF « ${basename(full)} » n’est pas lisible en brut. Exportez-le en .txt/.md, ou collez le texte, puis redemandez l’extraction.`)
          }
          const raw = await readFile(full, 'utf8')
          const text = raw.replace(/^\uFEFF/, '')
          if (!text.trim()) throw new Error(`Le fichier « ${basename(full)} » est vide.`)
          return JSON.stringify({
            path: full,
            title: basename(full),
            bytes: text.length,
            text: text.slice(0, 120000),
          })
        } catch (error) {
          if (error instanceof Error && /PDF|vide|n’est pas lisible/.test(error.message)) throw error
          /* try next candidate */
        }
      }
    }
    throw new Error(`Fichier introuvable : ${title}. Vérifiez Documents ou Bureau (.txt, .md, .csv, .json, .html).`)
  }
  throw new Error(`Outil ordinateur inconnu : ${tool}`)
}

/** Écrit un fichier binaire (pptx, png…) dans Documents/Bureau/Téléchargements et l’ouvre. */
export async function saveUserBinaryFile(opts: {
  title: string
  ext: string
  data: Buffer | Uint8Array
  folder?: 'documents' | 'desktop' | 'downloads'
  open?: boolean
}): Promise<{ path: string; title: string }> {
  const root = resolveRoot(opts.folder || 'documents')
  await mkdir(root, { recursive: true })
  const ext = opts.ext.replace(/^\./, '').toLowerCase() || 'bin'
  const base = String(opts.title || 'ATLAS')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(new RegExp(`\\.${ext}$`, 'i'), '')
    .trim() || 'ATLAS'
  const full = assertInsideRoot(root, join(root, `${base}.${ext}`))
  await writeFile(full, Buffer.from(opts.data))
  if (opts.open !== false) await startProcess(full).catch(() => undefined)
  return { path: full, title: `${base}.${ext}` }
}

export function isDesktopProvider(provider: string) {
  return provider === 'machine' || provider === 'filesystem' || provider === 'browser'
}

export function desktopLinkFields(provider: string) {
  const tools = provider === 'browser'
    ? [
        { name: 'open_app', description: 'Ouvrir Chrome ou Edge' },
        { name: 'open_url', description: 'Ouvrir une URL dans le navigateur' },
        { name: 'status', description: 'Statut navigateur local' },
      ]
    : DESKTOP_TOOLS
  return {
    kind: 'mcp' as const,
    url: 'local://desktop',
    token: JSON.stringify({ grant: 'desktop', host: 'localhost' }),
    tools,
    status: 'connected' as const,
  }
}
