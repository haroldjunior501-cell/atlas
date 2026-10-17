$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Blender = Join-Path $Root "tools\avatar\blender-portable\blender-4.2.16-windows-x64\blender.exe"
$Script = Join-Path $Root "tools\avatar\scripts\apply_flame_albedo.py"

if (-not (Test-Path $Blender)) {
  throw "Blender portable introuvable: $Blender"
}

& $Blender --background --python $Script -- @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
