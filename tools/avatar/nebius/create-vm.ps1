# Create Atlas GPU VM on Nebius (L40S + Ubuntu CUDA).
# Prereq: Nebius CLI in WSL Ubuntu-24.04, profile authenticated + billing set.
#
#   .\tools\avatar\nebius\create-vm.ps1 -DryRun
#   .\tools\avatar\nebius\create-vm.ps1
#
param(
  [switch]$DryRun,
  [string]$Name = "atlas-l40s-gsplat-1",
  [string]$ParentId = "project-e00q1epdpr006s3hrffnk6",
  [string]$ServiceAccountId = "serviceaccount-e00kg7q9gy2hrhp2t3",
  [string]$SubnetId = "vpcsubnet-e00adgebtn6rj6szkq",
  [string]$SecurityGroupId = "vpcsecuritygroup-e00hnc7g3f4xp87jnw",
  [long]$DiskBytes = 107374182400,
  [string]$WslDistro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"
$Here = $PSScriptRoot
$CloudInit = Join-Path $Here "cloud-init.yaml"
if (-not (Test-Path $CloudInit)) { throw "Missing $CloudInit" }

$UserData = (Get-Content -Raw $CloudInit) -replace "`r`n", "`n"
if ($UserData -notmatch '^#cloud-config') {
  throw "cloud-init.yaml must start with #cloud-config"
}

Write-Host "=== Nebius create GPU VM ==="
Write-Host "name=$Name platform=gpu-l40s-a preset=1gpu-8vcpu-32gb"
Write-Host "disk=$([math]::Round($DiskBytes/1GB,1)) GiB image=ubuntu24.04-cuda13.0"
Write-Host "user=atlas (see cloud-init.yaml)"

$wslNebius = "/root/.nebius/bin/nebius"
$useWsl = $false
$check = & wsl -d $WslDistro -e bash -lc "test -x $wslNebius && echo OK" 2>$null
if ($check -match "OK") { $useWsl = $true }

if (-not $useWsl -and -not (Get-Command nebius -ErrorAction SilentlyContinue)) {
  Write-Host "Nebius CLI not found in WSL. See tools/avatar/nebius/README.md"
  exit 2
}

if ($DryRun) {
  Write-Host "DRY RUN — would run create-vm.sh in WSL ($WslDistro)"
  Write-Host "  name=$Name parent=$ParentId diskBytes=$DiskBytes"
  exit 0
}

# Prefer bash script (correct snake_case JSON + cloud-init quoting)
$bashScript = "/mnt/c/Users/PC/Desktop/final-hakathon/atlas/tools/avatar/nebius/create-vm.sh"
wsl -d $WslDistro -e bash -lc "sed -i 's/\r`$//' '$bashScript'; chmod +x '$bashScript'; '$bashScript' '$Name' '$ParentId' '$ServiceAccountId' '$SubnetId' '$SecurityGroupId' '$DiskBytes'"
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Create failed. If PermissionDenied: set Billing in https://console.nebius.com/ then retry."
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Created (or creating). Get IP:"
Write-Host "  wsl -d $WslDistro -e bash -lc ""export PATH=/root/.nebius/bin:`$PATH; nebius compute v1 instance get-by-name --name $Name --parent-id $ParentId"""
Write-Host "SSH: ssh -i `$env:USERPROFILE\.ssh\id_ed25519 atlas@<PUBLIC_IP>"
