# Peaufinage portrait → FLAME (PIL fiable + bake GLB Blender)
# La projection Cycles selected-to-active est encore expérimentale; on utilise
# le refine PIL (color transfer + overlay UV) puis apply_flame_albedo.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Refine = Join-Path $Root "tools\avatar\scripts\refine_flame_from_portrait.py"
$Apply = Join-Path $Root "tools\avatar\scripts\apply_flame_albedo.ps1"
$Base = Join-Path $Root "apps\web\public\avatars\atlas-flame-albedo.base.png"
$Albedo = Join-Path $Root "apps\web\public\avatars\atlas-flame-albedo.png"

if (-not (Test-Path $Base)) {
  if (Test-Path $Albedo) { Copy-Item $Albedo $Base -Force }
  else { throw "Pas d'albedo de base." }
}

# Always refine from clean AlbedoMM base
Copy-Item $Base $Albedo -Force
Write-Host "=== 1/2 Refine albedo from portrait (PIL) ==="
python $Refine --opacity 0.62 --transfer 0.55 @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== 2/2 Export FLAME GLB (Blender) ==="
& $Apply
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "OK -> atlas-flame.glb + atlas-flame-albedo.png"
Write-Host "Hard-refresh le bureau (Ctrl+Shift+R)."
