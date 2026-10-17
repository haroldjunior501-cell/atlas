/**
 * Pilotage in-app Windows : ouvrir / chercher / jouer / taper comme un utilisateur.
 * Ex. « joue Ninho dans Spotify », « lance le son de Ninho sur Spotify », « cherche budget dans Notion ».
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type AppControlIntent = 'play' | 'search' | 'pause' | 'next' | 'previous' | 'type' | 'open'

export interface AppControlRequest {
  app: string
  intent: AppControlIntent
  query?: string
  text?: string
}

type Driver = {
  id: string
  label: string
  aliases: string[]
  process: string[]
  window: string[]
  start?: string[]
}

const DRIVERS: Driver[] = [
  {
    id: 'spotify',
    label: 'Spotify',
    aliases: ['spotify', 'spot', 'spotifi'],
    process: ['Spotify'],
    window: ['Spotify'],
    start: ['spotify:', 'Spotify'],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    aliases: ['youtube', 'you tube', 'yt'],
    process: ['chrome', 'msedge', 'brave'],
    window: ['YouTube', 'Chrome', 'Edge'],
  },
  {
    id: 'chrome',
    label: 'Chrome',
    aliases: ['chrome', 'google chrome'],
    process: ['chrome'],
    window: ['Chrome'],
    start: ['chrome'],
  },
  {
    id: 'edge',
    label: 'Edge',
    aliases: ['edge', 'microsoft edge'],
    process: ['msedge'],
    window: ['Edge'],
    start: ['msedge'],
  },
  {
    id: 'notion',
    label: 'Notion',
    aliases: ['notion'],
    process: ['Notion'],
    window: ['Notion'],
    start: ['notion://', 'Notion'],
  },
  {
    id: 'discord',
    label: 'Discord',
    aliases: ['discord'],
    process: ['Discord'],
    window: ['Discord'],
    start: ['discord://', 'Discord'],
  },
  {
    id: 'slack',
    label: 'Slack',
    aliases: ['slack'],
    process: ['slack'],
    window: ['Slack'],
    start: ['slack://', 'Slack'],
  },
  {
    id: 'vscode',
    label: 'VS Code',
    aliases: ['vscode', 'vs code', 'code'],
    process: ['Code'],
    window: ['Visual Studio Code', 'Code'],
    start: ['code'],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    aliases: ['cursor'],
    process: ['Cursor'],
    window: ['Cursor'],
    start: ['cursor'],
  },
  {
    id: 'word',
    label: 'Word',
    aliases: ['word', 'microsoft word', 'winword'],
    process: ['WINWORD'],
    window: ['Word'],
    start: ['winword'],
  },
  {
    id: 'excel',
    label: 'Excel',
    aliases: ['excel', 'microsoft excel', 'tableur'],
    process: ['EXCEL'],
    window: ['Excel'],
    start: ['excel'],
  },
  {
    id: 'powerpoint',
    label: 'PowerPoint',
    aliases: ['powerpoint', 'power point', 'ppt'],
    process: ['POWERPNT'],
    window: ['PowerPoint'],
    start: ['powerpnt'],
  },
  {
    id: 'notepad',
    label: 'Bloc-notes',
    aliases: ['notepad', 'bloc notes', 'bloc-notes'],
    process: ['notepad'],
    window: ['Bloc-notes', 'Notepad'],
    start: ['notepad'],
  },
  {
    id: 'explorer',
    label: 'Explorateur',
    aliases: ['explorer', 'explorateur'],
    process: ['explorer'],
    window: ['Explorateur', 'File Explorer'],
    start: ['explorer'],
  },
  {
    id: 'spotify_web',
    label: 'Spotify Web',
    aliases: [],
    process: ['chrome', 'msedge'],
    window: ['Spotify', 'Chrome', 'Edge'],
  },
]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitize(raw: string) {
  return raw
    .replace(/[<>:"|?*;&`$(){}[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function escapeSendKeys(text: string) {
  return text.replace(/([+^%~(){}[\]])/g, '{$1}')
}

function normalizeApp(raw: string) {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

export function resolveDriver(appRaw: string): Driver | null {
  const key = normalizeApp(appRaw)
  if (!key) return null
  let best: Driver | null = null
  let bestScore = 0
  for (const driver of DRIVERS) {
    for (const alias of driver.aliases) {
      if (key === alias) return driver
      if (key.includes(alias) || alias.includes(key)) {
        const score = Math.min(key.length, alias.length)
        if (score > bestScore) {
          best = driver
          bestScore = score
        }
      }
    }
  }
  return best
}

function looksLikeMusic(text: string) {
  return /(?:son|morceau|musique|titre|track|album|artiste|spotify|youtube|écouter|ecouter)/i.test(text)
}

/** Parse « joue X dans Spotify », « lance le son de Ninho sur Spotify », « mets du Ninho », etc. */
export function parseAppControl(raw: string): AppControlRequest | null {
  const text = sanitize(raw)
  if (!text) return null
  const lower = text.toLowerCase()

  const play = text.match(
    /(?:joue|jouer|play|mets|met|lance|lancer|d[eé]marre|start)\s+(?:le\s+|la\s+|du\s+|de\s+la\s+|de\s+l['’])?(?:son|morceau|musique|titre|track|album|artiste|vid[eé]o)?\s*(?:de\s+|d['’]|du\s+)?(.+?)\s+(?:dans|sur|avec|via)\s+(.+)$/i,
  )
  if (play?.[1] && play[2]) {
    const app = sanitize(play[2])
    const query = sanitize(play[1].replace(/^(?:le|la|les|du|de|un|une)\s+/i, ''))
    return { app, intent: 'play', query, text }
  }

  // « joue / lance / mets Ninho » (Spotify par défaut)
  const playBare = text.match(
    /(?:joue|jouer|play|mets|met|lance|lancer)\s+(?:le\s+|la\s+|du\s+|de\s+la\s+)?(?:son|morceau|musique|titre|track)\s*(?:de\s+|d['’]|du\s+)?(.+)$/i,
  )
  if (playBare?.[1] && !/(?:dans|sur|avec|via)\s+\w+/i.test(playBare[1])) {
    return {
      app: 'spotify',
      intent: 'play',
      query: sanitize(playBare[1].replace(/^(?:le|la|les|du|de|un|une)\s+/i, '')),
      text,
    }
  }

  // « joue Ninho » / « mets du Ninho » sans mot « son »
  const playArtist = text.match(
    /(?:joue|jouer|play|mets|met)\s+(?:du\s+|de\s+|de\s+la\s+|de\s+l['’])?([A-Za-zÀ-ÿ0-9][\wÀ-ÿ0-9 .'-]{1,60})$/i,
  )
  if (playArtist?.[1] && !/(?:mail|fichier|document|t[aâ]che|mission|dans|sur)\b/i.test(playArtist[1])) {
    return { app: 'spotify', intent: 'play', query: sanitize(playArtist[1]), text }
  }

  const search = text.match(
    /(?:cherche|rechercher?|trouve|trouver|ouvre|ouvrir)\s+(.+?)\s+(?:dans|sur|avec|via)\s+(.+)$/i,
  )
  if (search?.[1] && search[2] && !/^(?:une |un )?(?:t[aâ]che|mission|mail)/i.test(search[1])) {
    const app = sanitize(search[2])
    const query = sanitize(search[1])
    if (/spotify|youtube|musique|son/i.test(app) || looksLikeMusic(lower)) {
      return { app, intent: 'play', query, text }
    }
    return { app, intent: 'search', query, text }
  }

  const typed = text.match(
    /(?:[eé]cris|ecris|tape|taper|r[eé]dige|redige|saisis)\s+(.+?)\s+(?:dans|sur)\s+(.+)$/i,
  )
  if (typed?.[1] && typed[2]) {
    return { app: sanitize(typed[2]), intent: 'type', query: sanitize(typed[1]), text }
  }

  if (/(?:pause|met(?:s)? en pause|arr[eê]te(?:\s+la\s+musique)?)/i.test(lower)) {
    const app = text.match(/(?:dans|sur)\s+(\w+)/i)?.[1] || 'spotify'
    return { app: sanitize(app), intent: 'pause', text }
  }
  if (/(?:suivant|next|passe\s+(?:au\s+)?suivant)/i.test(lower)) {
    const app = text.match(/(?:dans|sur)\s+(\w+)/i)?.[1] || 'spotify'
    return { app: sanitize(app), intent: 'next', text }
  }
  if (/(?:pr[eé]c[eé]dent|previous)/i.test(lower)) {
    const app = text.match(/(?:dans|sur)\s+(\w+)/i)?.[1] || 'spotify'
    return { app: sanitize(app), intent: 'previous', text }
  }

  return null
}

async function startUri(uri: string) {
  if (process.platform !== 'win32') {
    await execFileAsync('xdg-open', [uri], { windowsHide: true }).catch(() => undefined)
    return
  }
  const ps = `Start-Process ${JSON.stringify(uri)}`
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true, timeout: 12000 })
}

async function startProcessName(command: string) {
  if (process.platform !== 'win32') return
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-Command', `Start-Process ${JSON.stringify(command)}`],
    { windowsHide: true, timeout: 12000 },
  ).catch(() => undefined)
}

/** Lance une app installée via Get-StartApps (comme le menu Démarrer). */
async function launchInstalledApp(name: string): Promise<boolean> {
  if (process.platform !== 'win32') return false
  const needle = name.replace(/'/g, "''")
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$want = '${needle}'.ToLower()
$apps = Get-StartApps
$hit = $apps | Where-Object { $_.Name.ToLower() -eq $want } | Select-Object -First 1
if (-not $hit) { $hit = $apps | Where-Object { $_.Name.ToLower() -like "*$want*" } | Select-Object -First 1 }
if ($hit) {
  Start-Process ("shell:AppsFolder\\" + $hit.AppID)
  'OK:' + $hit.Name
} else {
  Start-Process ${JSON.stringify(name)} -ErrorAction SilentlyContinue
  if ($?) { 'OK' } else { 'FAIL' }
}
`.trim()
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 20000 },
    )
    return /OK/i.test(stdout)
  } catch {
    return false
  }
}

async function processRunning(names: string[]): Promise<boolean> {
  if (process.platform !== 'win32' || !names.length) return false
  const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',')
  const script = `
$names = @(${list})
foreach ($n in $names) {
  if (Get-Process -Name $n -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }) { 'YES'; break }
}
`.trim()
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      { windowsHide: true, timeout: 8000 },
    )
    return /YES/i.test(stdout)
  } catch {
    return false
  }
}

async function focusAndKeys(processNames: string[], windowHints: string[], keys: string, waitMs = 1800): Promise<boolean> {
  if (process.platform !== 'win32') return false
  await sleep(waitMs)
  const processes = processNames.map((name) => name.replace(/'/g, "''"))
  const windows = windowHints.map((name) => name.replace(/'/g, "''"))
  const keysEscaped = keys.replace(/'/g, "''")
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
$wshell = New-Object -ComObject WScript.Shell
$names = @(${processes.map((p) => `'${p}'`).join(',')})
$titles = @(${windows.map((w) => `'${w}'`).join(',')})
$activated = $false
foreach ($n in $names) {
  $proc = Get-Process -Name $n -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($proc) {
    [void]$wshell.AppActivate($proc.Id)
    Start-Sleep -Milliseconds 500
    $activated = $true
    break
  }
}
if (-not $activated) {
  foreach ($t in $titles) {
    if ($wshell.AppActivate($t)) { Start-Sleep -Milliseconds 500; $activated = $true; break }
  }
}
if ($activated) {
  [System.Windows.Forms.SendKeys]::SendWait('${keysEscaped}')
  'OK'
} else {
  'FAIL'
}
`.trim()
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 20000 },
    )
    return /OK/i.test(stdout)
  } catch {
    return false
  }
}

async function ensureDriverRunning(driver: Driver) {
  const running = await processRunning(driver.process)
  if (running) return
  for (const cmd of driver.start || [driver.label]) {
    if (/^[a-z]+:/i.test(cmd)) {
      await startUri(cmd)
    } else {
      const ok = await launchInstalledApp(cmd)
      if (!ok) await startProcessName(cmd)
    }
    await sleep(2200)
    if (await processRunning(driver.process)) return
  }
}

async function controlSpotify(intent: AppControlIntent, query: string) {
  if (intent === 'pause') {
    await ensureDriverRunning(DRIVERS[0]!)
    await focusAndKeys(['Spotify'], ['Spotify'], ' ', 400)
    return 'Lecture Spotify en pause / reprise.'
  }
  if (intent === 'next') {
    await ensureDriverRunning(DRIVERS[0]!)
    await focusAndKeys(['Spotify'], ['Spotify'], '^{RIGHT}', 400)
    return 'Morceau suivant sur Spotify.'
  }
  if (intent === 'previous') {
    await ensureDriverRunning(DRIVERS[0]!)
    await focusAndKeys(['Spotify'], ['Spotify'], '^{LEFT}', 400)
    return 'Morceau précédent sur Spotify.'
  }
  const q = sanitize(query)
  if (!q) return 'Indique ce qu’il faut jouer sur Spotify. Exemple : « Joue Ninho sur Spotify ».'

  // 1) Deep link recherche (ouvre / focus Spotify)
  await startUri(`spotify:search:${encodeURIComponent(q)}`)
  await sleep(3200)

  // 2) Comme un utilisateur : focus, Entrée sur le 1er résultat, lecture
  let ok = await focusAndKeys(['Spotify'], ['Spotify'], '{ENTER}', 600)
  if (!ok) {
    // Fallback : démarrer Spotify puis Ctrl+K (barre de recherche)
    await ensureDriverRunning(DRIVERS[0]!)
    await focusAndKeys(['Spotify'], ['Spotify'], '^k', 900)
    await sleep(400)
    await focusAndKeys(['Spotify'], ['Spotify'], `${escapeSendKeys(q)}{ENTER}`, 200)
    await sleep(900)
    ok = await focusAndKeys(['Spotify'], ['Spotify'], '{ENTER}', 300)
  }
  await sleep(700)
  await focusAndKeys(['Spotify'], ['Spotify'], '{ENTER}', 250)
  await sleep(500)
  await focusAndKeys(['Spotify'], ['Spotify'], ' ', 200)

  if (!ok) {
    // Dernier recours : Spotify Web
    await startUri(`https://open.spotify.com/search/${encodeURIComponent(q)}`)
    return `Spotify desktop n’a pas pris le focus — j’ouvre la recherche web pour « ${q} ». Clique le morceau si besoin.`
  }
  return `Je lance « ${q} » sur Spotify.`
}

async function controlYoutube(intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  if (!q && intent === 'play') return 'Indique la vidéo ou le son à jouer sur YouTube.'
  if (intent === 'play' || intent === 'search') {
    const url = intent === 'play'
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    await startUri(url)
    await sleep(2800)
    await focusAndKeys(['chrome', 'msedge', 'brave'], ['YouTube', 'Chrome', 'Edge'], '{TAB}{TAB}{ENTER}', 800)
    return intent === 'play'
      ? `Je lance la recherche YouTube pour « ${q} ».`
      : `Recherche YouTube ouverte pour « ${q} ».`
  }
  return 'Action YouTube non supportée.'
}

async function controlBrowser(driver: Driver, intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  if (intent === 'play' && q) return controlYoutube('play', q)
  if (intent === 'search' || intent === 'open') {
    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`
    await startUri(url)
    return `Recherche ouverte dans ${driver.label} : « ${q} ».`
  }
  if (intent === 'type' && q) {
    await ensureDriverRunning(driver)
    await focusAndKeys(driver.process, driver.window, escapeSendKeys(q), 2000)
    return `Texte saisi dans ${driver.label}.`
  }
  return `${driver.label} : précise cherche / joue + le sujet.`
}

async function controlNotion(intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  await ensureDriverRunning(DRIVERS.find((d) => d.id === 'notion')!)
  await focusAndKeys(['Notion'], ['Notion'], q ? `^p${escapeSendKeys(q)}{ENTER}` : '', 800)
  return q ? `Je cherche « ${q} » dans Notion.` : 'Notion est ouvert.'
}

async function controlDiscord(intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  await ensureDriverRunning(DRIVERS.find((d) => d.id === 'discord')!)
  if (intent === 'search' || intent === 'play' || intent === 'type') {
    await focusAndKeys(['Discord'], ['Discord'], q ? `^k${escapeSendKeys(q)}{ENTER}` : '', 600)
    return q ? `Recherche Discord : « ${q} ».` : 'Discord est ouvert.'
  }
  return 'Discord est ouvert.'
}

async function controlSlack(intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  await ensureDriverRunning(DRIVERS.find((d) => d.id === 'slack')!)
  if (q) {
    await focusAndKeys(['slack'], ['Slack'], `^k${escapeSendKeys(q)}{ENTER}`, 600)
    return `Recherche Slack : « ${q} ».`
  }
  return 'Slack est ouvert.'
}

async function controlVscode(driver: Driver, intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  await ensureDriverRunning(driver)
  if (q) {
    await focusAndKeys(driver.process, driver.window, `^p${escapeSendKeys(q)}{ENTER}`, 500)
    return `Ouverture rapide ${driver.label} : « ${q} ».`
  }
  return `${driver.label} est ouvert.`
}

async function controlWordOrNotepad(driver: Driver, intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  await ensureDriverRunning(driver)
  if ((intent === 'type' || intent === 'search' || intent === 'play') && q) {
    await focusAndKeys(driver.process, driver.window, escapeSendKeys(q), 500)
    return `J’écris dans ${driver.label} : « ${q.slice(0, 80)}${q.length > 80 ? '…' : ''} ».`
  }
  return `${driver.label} est ouvert.`
}

async function controlOffice(driver: Driver, intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  await ensureDriverRunning(driver)
  if (intent === 'search' && q) {
    await focusAndKeys(driver.process, driver.window, `^f${escapeSendKeys(q)}{ENTER}`, 600)
    return `Recherche dans ${driver.label} : « ${q} ».`
  }
  if ((intent === 'type' || intent === 'play') && q) {
    await focusAndKeys(driver.process, driver.window, escapeSendKeys(q), 500)
    return `Saisie dans ${driver.label}.`
  }
  return `${driver.label} est ouvert.`
}

/** App inconnue : lance comme le menu Démarrer, puis agit (recherche / saisie / Entrée). */
async function controlGeneric(appName: string, intent: AppControlIntent, query: string) {
  const q = sanitize(query)
  const app = sanitize(appName)
  const launched = await launchInstalledApp(app)
  if (!launched) await startProcessName(app)
  await sleep(2400)

  const procGuess = [app.replace(/\s+/g, ''), app.split(/\s+/)[0] || app]
  const windows = [app]

  if (!q) {
    return launched
      ? `${app} est ouvert.`
      : `Je n’ai pas trouvé « ${app} » dans le menu Démarrer. Dis « liste mes applications ».`
  }

  if (intent === 'type') {
    await focusAndKeys(procGuess, windows, escapeSendKeys(q), 600)
    return `J’écris dans ${app} : « ${q.slice(0, 80)} ».`
  }

  // Comme un utilisateur : Ctrl+K (palette) puis Ctrl+F (recherche) puis saisie + Entrée
  let ok = await focusAndKeys(procGuess, windows, `^k${escapeSendKeys(q)}{ENTER}`, 700)
  if (!ok) {
    ok = await focusAndKeys(procGuess, windows, `^f${escapeSendKeys(q)}{ENTER}`, 700)
  }
  if (!ok) {
    await focusAndKeys(procGuess, windows, escapeSendKeys(q) + '{ENTER}', 700)
  }
  if (intent === 'play') {
    await sleep(500)
    await focusAndKeys(procGuess, windows, '{ENTER}', 300)
    await sleep(300)
    await focusAndKeys(procGuess, windows, ' ', 200)
  }
  return intent === 'play'
    ? `J’essaie de jouer / ouvrir « ${q} » dans ${app}, comme un utilisateur.`
    : `J’exécute « ${q} » dans ${app}.`
}

export async function runAppControl(request: AppControlRequest): Promise<string> {
  let appName = request.app
  const intent = request.intent
  const query = sanitize(request.query || '')

  if (/shopify/i.test(appName) && (intent === 'play' || looksLikeMusic(`${query} ${request.text || ''}`))) {
    appName = 'spotify'
  }

  if ((!appName || /musique|son|morceau/i.test(appName)) && (intent === 'play' || looksLikeMusic(request.text || ''))) {
    appName = 'spotify'
  }

  const driver = resolveDriver(appName)
  if (!driver) {
    return controlGeneric(appName, intent, query)
  }

  switch (driver.id) {
    case 'spotify':
      return controlSpotify(intent, query)
    case 'youtube':
      return controlYoutube(intent, query)
    case 'chrome':
    case 'edge':
      return controlBrowser(driver, intent, query)
    case 'notion':
      return controlNotion(intent, query)
    case 'discord':
      return controlDiscord(intent, query)
    case 'slack':
      return controlSlack(intent, query)
    case 'vscode':
    case 'cursor':
      return controlVscode(driver, intent, query)
    case 'word':
    case 'notepad':
      return controlWordOrNotepad(driver, intent, query)
    case 'excel':
    case 'powerpoint':
      return controlOffice(driver, intent, query)
    default:
      return controlGeneric(driver.label, intent, query)
  }
}

export function describeSupportedControls() {
  return DRIVERS.filter((d) => d.aliases.length).map((d) => d.label).join(', ')
}
