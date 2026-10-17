# Train SplattingAvatar on a CUDA machine, then export web-ready atlas.splat / .ply
# Requires: NVIDIA GPU, CUDA, conda env from SplattingAvatar README.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Repo = Join-Path $Root "data\avatar\vendor\SplattingAvatar"
$DatDir = Join-Path $Root "data\avatar\splatting\atlas_subject"
$OutWeb = Join-Path $Root "apps\web\public\avatars"

if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
  throw "NVIDIA GPU / nvidia-smi required. This host cannot train SplattingAvatar."
}

if (-not (Test-Path (Join-Path $Repo "train_splatting_avatar.py"))) {
  Write-Host "Re-cloning SplattingAvatar recursively..."
  if (Test-Path $Repo) { Remove-Item -Recurse -Force $Repo }
  git clone --recursive https://github.com/initialneil/SplattingAvatar.git $Repo
}

if (-not (Test-Path $DatDir)) {
  throw "Dataset missing: $DatDir`nPrepare IMavatar-style subject frames (see SplattingAvatar README)."
}

Push-Location $Repo
try {
  $env:CUDA_VISIBLE_DEVICES = "0"
  python train_splatting_avatar.py `
    --config configs/splatting_avatar.yaml `
    --dat_dir $DatDir `
    --ip none
} finally {
  Pop-Location
}

# Export: copy latest point cloud PLY for the web viewer (GaussianSplats3D accepts .ply / .splat)
$Pc = Get-ChildItem -Path $DatDir -Recurse -Filter "point_cloud.ply" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Pc) {
  Write-Warning "No point_cloud.ply found under $DatDir — export manually after training."
  exit 0
}

New-Item -ItemType Directory -Force -Path $OutWeb | Out-Null
$DestPly = Join-Path $OutWeb "atlas.ply"
Copy-Item $Pc.FullName $DestPly -Force
# Prefer .splat name expected by AceFace; viewer also loads .ply if you rename/config.
$DestSplat = Join-Path $OutWeb "atlas.splat"
if (-not (Test-Path $DestSplat)) {
  Copy-Item $DestPly $DestSplat -Force
}
Write-Host "Exported -> $DestSplat"
Write-Host "Reload /bureau — AceFace priority: splat > flame > hero"
