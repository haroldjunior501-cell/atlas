param location string
param environmentId string
param containerImage string

@secure()
param storageConnection string

param registryServer string
param registryUsername string

@secure()
param registryPassword string

@secure()
param databaseUrl string = ''

var databaseSecret = databaseUrl == '' ? [] : [
  { name: 'database-url', value: databaseUrl }
]

var databaseEnv = databaseUrl == '' ? [] : [
  { name: 'DATABASE_URL', secretRef: 'database-url' }
]

resource gateway 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-atlas-gateway'
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 4000
        transport: 'auto'
      }
      registries: [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: concat([
        { name: 'storage-connection', value: storageConnection }
        { name: 'registry-password', value: registryPassword }
      ], databaseSecret)
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 20
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '30' } }
          }
        ]
      }
      containers: [
        {
          name: 'gateway'
          image: containerImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat([
            { name: 'PORT', value: '4000' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection' }
          ], databaseEnv)
        }
      ]
    }
  }
}

output fqdn string = gateway.properties.configuration.ingress.fqdn
