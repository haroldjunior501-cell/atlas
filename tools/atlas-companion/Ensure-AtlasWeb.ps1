$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
try {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.Connect('127.0.0.1', 3000)
  $client.Close()
  exit 0
} catch {
  # le Studio n'écoute pas encore
}
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { $npm = 'npm.cmd' }
Start-Process -FilePath $npm -ArgumentList @('run', 'dev:web') -WorkingDirectory $root -WindowStyle Minimized
