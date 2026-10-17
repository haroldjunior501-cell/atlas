# Clone SplattingAvatar training stack recursively (CUDA GPU required to train).
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Dest = Join-Path $Root "data\avatar\vendor\SplattingAvatar"
$Dataset = Join-Path $Root "data\avatar\splatting\atlas_target"

Write-Host "=== Atlas SplattingAvatar setup ==="
Write-Host "Train needs NVIDIA GPU + CUDA + PyTorch."

if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  nvidia-smi | Select-Object -First 12
} else {
  Write-Warning "nvidia-smi missing - clone ok, training not possible on this PC."
}

New-Item -ItemType Directory -Force -Path $Dataset | Out-Null

$HasTrain = Test-Path (Join-Path $Dest "train_splatting_avatar.py")
if (-not $HasTrain) {
  if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
  # Code lives on neil-dev (master is README-only).
  git clone --recursive -b neil-dev https://github.com/initialneil/SplattingAvatar.git $Dest
  Write-Host "Cloned neil-dev recursively -> $Dest"
} else {
  Write-Host "Already present -> $Dest"
  Push-Location $Dest
  try {
    git fetch origin neil-dev 2>$null
    git checkout neil-dev 2>$null
    git submodule update --init --recursive 2>$null
  } finally { Pop-Location }
}

$Portrait = Join-Path $Root "apps\web\public\avatars\atlas-target.png"
if (Test-Path $Portrait) {
  Copy-Item $Portrait (Join-Path $Dataset "ref.png") -Force
  Write-Host "Portrait copied -> $Dataset\ref.png"
}

Write-Host "Next on CUDA: prepare data/avatar/splatting/atlas_subject then train_splatting_avatar.ps1"
Write-Host "Web: drop atlas.splat in apps/web/public/avatars (AceFace auto-picks it)."
