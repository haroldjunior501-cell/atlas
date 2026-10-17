import { CONNECTOR_CATALOG, type ConnectorProvider } from '@atlas/domain'

export interface ToolRequest {
  provider: ConnectorProvider
  action: string
  input: Record<string, string>
}

export interface ToolConnector {
  provider: ConnectorProvider
  execute(request: ToolRequest): Promise<Record<string, string>>
}

export class UnconfiguredConnector implements ToolConnector {
  constructor(readonly provider: ConnectorProvider) {}

  async execute(request: ToolRequest): Promise<Record<string, string>> {
    throw new Error(`${request.provider} n'est pas connecté.`)
  }
}

export function connectorCatalog() {
  return CONNECTOR_CATALOG.map((descriptor) => ({
    ...descriptor,
    status: 'disconnected' as const,
  }))
}
