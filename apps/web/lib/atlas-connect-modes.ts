/**
 * Modes de connexion réels pour chaque outil Atlas.
 * - desktop : consentement local (PC)
 * - oauth : OAuth fournisseur (clés Client ID/Secret)
 * - token : clé API / bot token
 * - mcp : URL serveur MCP (n8n, Sema4, custom…)
 */

export type ConnectMode = 'desktop' | 'oauth' | 'token' | 'mcp'

export type TokenField = {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
}

const TOKEN_FIELDS: Record<string, TokenField[]> = {
  discord: [{ key: 'DISCORD_BOT_TOKEN', label: 'Bot token Discord', placeholder: 'MTQx…', secret: true }],
  telegram: [{ key: 'TELEGRAM_BOT_TOKEN', label: 'Bot token Telegram', placeholder: '123456:ABC…', secret: true }],
  resend: [{ key: 'RESEND_API_KEY', label: 'Clé API Resend', placeholder: 're_…', secret: true }],
  stripe: [{ key: 'STRIPE_SECRET_KEY', label: 'Clé secrète Stripe', placeholder: 'sk_…', secret: true }],
  mootion: [{ key: 'MOOTION_API_TOKEN', label: 'Token Mootion', placeholder: '…', secret: true }],
  figma: [{ key: 'FIGMA_ACCESS_TOKEN', label: 'Personal access token Figma', placeholder: 'figd_…', secret: true }],
  linear: [{ key: 'LINEAR_API_KEY', label: 'Clé API Linear', placeholder: 'lin_api_…', secret: true }],
  gitlab: [{ key: 'GITLAB_TOKEN', label: 'Personal access token GitLab', placeholder: 'glpat-…', secret: true }],
  shopify: [
    { key: 'SHOPIFY_SHOP', label: 'Boutique (ex. ma-boutique.myshopify.com)', placeholder: 'ma-boutique.myshopify.com' },
    { key: 'SHOPIFY_ADMIN_TOKEN', label: 'Admin API access token', placeholder: 'shpat_…', secret: true },
  ],
  x: [{ key: 'X_BEARER_TOKEN', label: 'Bearer token X (Twitter)', placeholder: 'AAAA…', secret: true }],
  dropbox: [{ key: 'DROPBOX_ACCESS_TOKEN', label: 'Access token Dropbox', placeholder: 'sl.…', secret: true }],
  pipedrive: [{ key: 'PIPEDRIVE_API_TOKEN', label: 'Token API Pipedrive', placeholder: '…', secret: true }],
  canva: [{ key: 'CANVA_API_TOKEN', label: 'Token API Canva', placeholder: '…', secret: true }],
}

/** Providers branchés en OAuth natif Atlas (Client ID / Secret). */
export const NATIVE_OAUTH = new Set([
  'gmail', 'google_calendar', 'google_drive',
  'github', 'slack', 'notion', 'hubspot',
  'outlook', 'outlook_calendar', 'teams', 'onedrive',
  'dropbox', 'discord',
])

export function connectModeOf(provider: string): ConnectMode {
  if (provider === 'machine' || provider === 'filesystem' || provider === 'browser') return 'desktop'
  if (TOKEN_FIELDS[provider]) return 'token'
  if (NATIVE_OAUTH.has(provider)) return 'oauth'
  return 'mcp'
}

export function tokenFieldsFor(provider: string): TokenField[] {
  return TOKEN_FIELDS[provider] ?? [{ key: `${provider.toUpperCase()}_TOKEN`, label: 'Token / clé API', secret: true }]
}

export function connectHintOf(provider: string, mode: ConnectMode): string {
  if (mode === 'desktop') return 'Autorisez Atlas à utiliser cet ordinateur (sandbox Bureau / Documents).'
  if (mode === 'oauth') {
    if (/outlook|teams|onedrive/i.test(provider)) {
      return 'OAuth Microsoft 365 — configurez MICROSOFT_CLIENT_ID / SECRET (Azure App Registration), puis Relier.'
    }
    return 'OAuth officiel — configurez les clés Client ID / Secret, puis Relier pour ouvrir la fenêtre du fournisseur.'
  }
  if (mode === 'token') return 'Collez votre clé / token fournisseur. Atlas la stocke localement et l’utilise pour les appels API.'
  return 'Collez l’URL du serveur MCP (n8n MCP Server Trigger, Sema4.ai, serveur officiel…). Optionnel : token Bearer.'
}
