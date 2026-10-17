# Export FLAME generic blend → apps/web/public/avatars/atlas-flame.glb
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$blend = Join-Path $root 'data\avatar\vendor\FLAME_Blender_AddOn\flame_tools\flame_tools\data\flame2020_generic.blend'
$out = Join-Path $root 'apps\web\public\avatars\atlas-flame.glb'
$script = Join-Path $PSScriptRoot 'export_flame_glb.py'

$blender = @(
  (Join-Path $root 'tools\avatar\blender-portable\blender-4.2.16-windows-x64\blender.exe'),
  "${env:ProgramFiles}\Blender Foundation\Blender 4.2\blender.exe",
  "${env:ProgramFiles}\Blender Foundation\Blender 4.5\blender.exe",
  "${env:ProgramFiles}\Blender Foundation\Blender 5.0\blender.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $blender) {
  $cmd = Get-Command blender -ErrorAction SilentlyContinue
  if ($cmd) { $blender = $cmd.Source }
}
if (-not $blender) { throw "Blender introuvable. Installe Blender 4.2 LTS (~500 Mo libres requis)." }
if (-not (Test-Path $blend)) { throw "Blend FLAME manquant : $blend" }

Write-Host "Blender : $blender"
& $blender --background --python $script -- --blend $blend --out $out
if ($LASTEXITCODE -ne 0) { throw "Export FLAME échoué ($LASTEXITCODE)" }
Write-Host "OK → $out"
