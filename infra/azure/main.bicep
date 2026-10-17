targetScope = 'resourceGroup'

@description('Région. France Central garde les organisations proches des utilisateurs.')
param location string = resourceGroup().location

@description('Image de la passerelle. Vide : seul le stockage est créé.')
param containerImage string = ''

@secure()
param registryPassword string = ''

@secure()
param postgresPassword string = ''

param registryServer string = ''
param registryUsername string = ''

var storageName = 'st${uniqueString(resourceGroup().id)}'
var logsName = 'log-atlas'
var environmentName = 'cae-atlas'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource organizations 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'atlas-organizations'
  properties: { publicAccess: 'None' }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

module postgres 'postgres.bicep' = if (postgresPassword != '') {
  name: 'atlas-postgres'
  params: {
    location: location
    administratorPassword: postgresPassword
  }
}

var postgresHost = postgres.?outputs.?host ?? ''
var databaseUrl = postgresHost == '' ? '' : 'postgresql://atlas:${postgresPassword}@${postgresHost}:5432/atlas?sslmode=require'

module gateway 'gateway.bicep' = if (containerImage != '') {
  name: 'atlas-gateway'
  params: {
    location: location
    environmentId: environment.id
    containerImage: containerImage
    storageConnection: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
    registryServer: registryServer
    registryUsername: registryUsername
    registryPassword: registryPassword
    databaseUrl: databaseUrl
  }
}

output storageAccountName string = storage.name
output organizationsContainer string = organizations.name
output gatewayFqdn string = gateway.?outputs.?fqdn ?? ''
