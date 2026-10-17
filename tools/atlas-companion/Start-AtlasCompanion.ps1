<#
.SYNOPSIS
  ATLAS Companion — appelle Atlas depuis n'importe quelle app Windows.

.DESCRIPTION
  - Raccourci global : Ctrl+Shift+A
  - Ouvre / focus une fenêtre Edge "app" sur http://localhost:3000/overlay
  - Icône dans la barre des tâches (NotifyIcon)

.NOTES
  Prérequis : `npm run dev:web` (Atlas sur localhost:3000).
  Lancer :  powershell -ExecutionPolicy Bypass -File tools/atlas-companion/Start-AtlasCompanion.ps1
#>

param(
  [string]$AtlasUrl = 'http://localhost:3000/overlay',
  [string]$HotkeyLabel = 'Ctrl+Shift+A'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Win32 : raccourci global + focus fenêtre
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class AtlasNative {
  public const int WM_HOTKEY = 0x0312;
  public const uint MOD_ALT = 0x0001;
  public const uint MOD_CONTROL = 0x0002;
  public const uint MOD_SHIFT = 0x0004;
  public const uint MOD_WIN = 0x0008;
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  public const int SW_RESTORE = 9;
  public const int SW_SHOW = 5;
}
"@

function Test-AtlasUp {
  try {
    $r = Invoke-WebRequest -Uri 'http://localhost:3000/overlay' -UseBasicParsing -TimeoutSec 2
    return $r.StatusCode -ge 200
  } catch {
    return $false
  }
}

function Start-AtlasOverlay {
  $edge = @(
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  $chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  $browser = if ($edge) { $edge } elseif ($chrome) { $chrome } else { $null }
  if (-not $browser) {
    Start-Process $AtlasUrl
    return
  }

  # Cherche une fenêtre déjà ouverte sur /overlay
  $existing = Get-Process -Name msedge, chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -match 'ATLAS|overlay|localhost:3000' -and $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1

  if ($existing) {
    $hwnd = $existing.MainWindowHandle
    if ([AtlasNative]::IsIconic($hwnd)) { [void][AtlasNative]::ShowWindow($hwnd, 9) }
    [void][AtlasNative]::ShowWindow($hwnd, 5)
    [void][AtlasNative]::SetForegroundWindow($hwnd)
    return
  }

  $args = @(
    "--app=$AtlasUrl",
    '--window-size=440,780',
    '--window-position=80,60',
    '--new-window'
  )
  Start-Process -FilePath $browser -ArgumentList $args
}

if (-not (Test-AtlasUp)) {
  [System.Windows.Forms.MessageBox]::Show(
    "ATLAS n'est pas joignable sur localhost:3000.`nLance d'abord : npm run dev:web`npuis relance le Companion.",
    'ATLAS Companion',
    'OK',
    'Warning'
  ) | Out-Null
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'ATLAS Companion'
$form.ShowInTaskbar = $false
$form.WindowState = 'Minimized'
$form.Opacity = 0
$form.Size = New-Object System.Drawing.Size(1, 1)

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Text = "ATLAS Companion ($HotkeyLabel)"
$tray.Icon = [System.Drawing.SystemIcons]::Application
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add('Ouvrir Atlas')
$openItem.add_Click({ Start-AtlasOverlay })
$quitItem = $menu.Items.Add('Quitter')
$quitItem.add_Click({
  [void][AtlasNative]::UnregisterHotKey($form.Handle, 1)
  $tray.Visible = $false
  [System.Windows.Forms.Application]::Exit()
})
$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ Start-AtlasOverlay })

# Ctrl+Shift+A
$ok = [AtlasNative]::RegisterHotKey($form.Handle, 1, [AtlasNative]::MOD_CONTROL -bor [AtlasNative]::MOD_SHIFT, 0x41)
if (-not $ok) {
  $tray.ShowBalloonTip(4000, 'ATLAS Companion', "Impossible d'enregistrer $HotkeyLabel (déjà pris ?).", 'Warning')
} else {
  $tray.ShowBalloonTip(3500, 'ATLAS Companion', "Pret. Appuie sur $HotkeyLabel partout pour parler a Atlas.", 'Info')
}

$form.Add_Load({
  $form.Hide()
})

$form.add_FormClosing({
  param($sender, $e)
  [void][AtlasNative]::UnregisterHotKey($form.Handle, 1)
  $tray.Visible = $false
})

# Boucle messages pour WM_HOTKEY
$wndProc = {
  # Handled via Application.AddMessageFilter below
}

Add-Type @"
using System;
using System.Windows.Forms;
public class AtlasHotkeyFilter : IMessageFilter {
  public Action OnHotkey;
  public bool PreFilterMessage(ref Message m) {
    if (m.Msg == 0x0312) { // WM_HOTKEY
      if (OnHotkey != null) OnHotkey();
      return true;
    }
    return false;
  }
}
"@

$filter = New-Object AtlasHotkeyFilter
$filter.OnHotkey = [Action]{ Start-AtlasOverlay }
[System.Windows.Forms.Application]::AddMessageFilter($filter)

# Ouverture initiale
Start-AtlasOverlay

[System.Windows.Forms.Application]::Run($form)
