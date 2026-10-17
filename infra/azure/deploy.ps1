# Crée le stockage Azure, puis la passerelle toujours allumée si Docker est là.
$ErrorActionPreference = 'Stop'
$group = 'rg-atlas'
$location = 'francecentral'
$registry = 'acratlas' + (Get-Random -Maximum 99999)

az account show | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Connecte-toi d’abord : az login'
}

az provider register --namespace Microsoft.DBforPostgreSQL --wait | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Impossible d’activer Microsoft.DBforPostgreSQL" }

foreach ($namespace in @('Microsoft.Storage', 'Microsoft.OperationalInsights', 'Microsoft.App', 'Microsoft.ContainerRegistry')) {
  az provider register --namespace $namespace --wait | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Error "Impossible d’activer $namespace" }
}

az group create --name $group --location $location | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error 'Création du groupe impossible' }

$image = ''
$registryServer = ''
$registryUsername = ''
$registryPassword = ''
if (Get-Command docker -ErrorAction SilentlyContinue) {
  az acr create --name $registry --resource-group $group --location $location --sku Basic --admin-enabled true | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Error 'Création du registre impossible' }
  az acr login --name $registry | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Error 'Connexion au registre impossible' }
  $registryServer = "$registry.azurecr.io"
  $image = "$registryServer/atlas-gateway:latest"
  docker build -t $image .
  docker push $image
  $credentials = az acr credential show --name $registry | ConvertFrom-Json
  $registryUsername = $credentials.username
  $registryPassword = $credentials.passwords[0].value
}

az deployment group create `
  --resource-group $group `
  --template-file "$PSScriptRoot/main.bicep" `
  --parameters containerImage=$image registryServer=$registryServer registryUsername=$registryUsername registryPassword=$registryPassword postgresPassword=$env:ATLAS_POSTGRES_PASSWORD | Out-Null

Write-Host "Groupe $group prêt en $location."
if ($image) {
  Write-Host "Passerelle : $image (au moins une instance reste allumée)."
} else {
  Write-Host "Stockage créé. Relance ce script avec Docker pour publier la passerelle."
}
