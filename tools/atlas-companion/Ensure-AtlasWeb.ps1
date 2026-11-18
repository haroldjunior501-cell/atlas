$ErrorActionPreference = 'Stop'

# Prefer production overlay; fall back to local Next on :3000.
try {
  $r = Invoke-WebRequest -Uri 'https://atlast.strimetv.site/overlay' -UseBasicParsing -TimeoutSec 8
  if ($r.StatusCode -ge 200) { exit 0 }
} catch {}

try {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.Connect('127.0.0.1', 3000)
  $client.Close()
  exit 0
} catch {}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { $npm = 'npm.cmd' }
Start-Process -FilePath $npm -ArgumentList @('run', 'dev:web') -WorkingDirectory $root -WindowStyle Minimized
