# Push Atlas GSplat scripts + portrait to an AMD Instinct VM, print next SSH commands.
param(
  [Parameter(Mandatory = $true)]
  [string]$HostName,
  [string]$User = "root",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\id_ed25519",
  [string]$Video = ""
)
# AMD Developer Cloud droplets default to user `root`.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Portrait = Join-Path $Root "apps\web\public\avatars\atlas-target.png"
$Remote = "${User}@${HostName}"
$Ssh = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new")

if (-not (Test-Path $KeyPath)) { throw "SSH key missing: $KeyPath" }
if (-not (Test-Path $Portrait)) { throw "Portrait missing: $Portrait" }

Write-Host "=== Push Atlas AMD pack -> $Remote ==="
ssh @Ssh $Remote "mkdir -p ~/atlas-avatar/input ~/atlas-avatar/out ~/atlas-avatar/scripts"

scp @Ssh `
  (Join-Path $PSScriptRoot "amd_gsplat_bootstrap.sh") `
  (Join-Path $PSScriptRoot "amd_prepare_dataset.sh") `
  "${Remote}:~/atlas-avatar/"

scp @Ssh $Portrait "${Remote}:~/atlas-avatar/input/ref.png"

if (-not $Video) {
  $defaultVid = Join-Path $Root "data\avatar\amd_input\face.mp4"
  if (Test-Path $defaultVid) { $Video = $defaultVid }
}
if ($Video -and (Test-Path $Video)) {
  Write-Host "Uploading video $Video ..."
  scp @Ssh $Video "${Remote}:~/atlas-avatar/input/face.mp4"
}

ssh @Ssh $Remote "chmod +x ~/atlas-avatar/*.sh"

Write-Host ""
Write-Host "Uploaded. On the VM run:"
Write-Host "  ssh -i $KeyPath $Remote"
Write-Host "  bash ~/atlas-avatar/amd_gsplat_bootstrap.sh"
Write-Host "  bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --install"
if ($Video) {
  Write-Host "  bash ~/atlas-avatar/amd_prepare_dataset.sh --video ~/atlas-avatar/input/face.mp4"
  Write-Host "  bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --train-colmap --data_dir ~/atlas-avatar/colmap_subject"
} else {
  Write-Host "  # scp a face video first, then:"
  Write-Host "  bash ~/atlas-avatar/amd_prepare_dataset.sh --video ~/atlas-avatar/input/face.mp4"
  Write-Host "  bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --train-colmap --data_dir ~/atlas-avatar/colmap_subject"
}
Write-Host "  bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --export"
Write-Host ""
Write-Host "Pull result back:"
Write-Host "  scp -i $KeyPath ${Remote}:~/atlas-avatar/out/atlas.splat $Root\apps\web\public\avatars\atlas.splat"
