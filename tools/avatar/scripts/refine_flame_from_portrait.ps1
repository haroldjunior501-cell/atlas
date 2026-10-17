# Peaufine l'albedo FLAME depuis atlas-target.png, puis ré-exporte atlas-flame.glb
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Py = Join-Path $Root "tools\avatar\scripts\refine_flame_from_portrait.py"
$Apply = Join-Path $Root "tools\avatar\scripts\apply_flame_albedo.ps1"

Write-Host "=== 1/2 Refine albedo from portrait ==="
python $Py @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== 2/2 Bake albedo into FLAME GLB (Blender) ==="
& $Apply
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "OK -> apps/web/public/avatars/atlas-flame.glb"
Write-Host "Hard-refresh le bureau (Ctrl+Shift+R)."
