# Copy a trained SplattingAvatar / 3DGS point cloud into the web public folder.
param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [string]$Name = "atlas.splat"
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Out = Join-Path $Root "apps\web\public\avatars"
if (-not (Test-Path $Source)) { throw "Source not found: $Source" }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$Dest = Join-Path $Out $Name
Copy-Item $Source $Dest -Force
Write-Host "Copied $Source -> $Dest"
Write-Host "AceFace will use it automatically (HEAD /avatars/$Name)."
