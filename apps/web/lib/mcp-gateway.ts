/**
 * Atlas MCP Gateway — contrat des 3 couches
 *
 * 1. Interface Relier → OAuth / hub URL (tokens stockés serveur uniquement)
 * 2. Logique ATLAS → vocal / LLM choisit un tool name + args (jamais le token)
 * 3. Execution → gatewayInvoke (API native OAuth OU MCP / n8n tools.call)
 *
 * Endpoints:
 *   GET  /api/atlas/connect?organizationId=…
 *   POST intent authorize | link | tools | invoke
 *
 * Env: GOOGLE_CLIENT_*, SLACK_*, ATLAS_MCP_HUB_URL, ATLAS_MCP_PROVIDER_URL
 */
export { gatewayInvoke, gatewayToolsForOrg, previewSensitiveAction, parseNaturalArgs } from './atlas-mcp-gateway'
