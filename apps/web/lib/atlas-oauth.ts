import { CONNECTOR_CATALOG, connectorOf } from '@atlas/domain'
import { serverEnv } from './server-env'
import { readOauthApps } from './oauth-apps-store'
import { desktopLinkFields } from './atlas-desktop'

export type OauthProvider =
  | 'gmail' | 'google_calendar' | 'google_drive'
  | 'github' | 'slack' | 'notion' | 'hubspot'
  | 'outlook' | 'outlook_calendar' | 'teams' | 'onedrive'
  | 'dropbox' | 'discord'

interface OauthApp {
  authorize: string
  token: string
  idEnv: string
  secretEnv: string
  scopes: string[]
}

const GOOGLE: Pick<OauthApp, 'authorize' | 'token' | 'idEnv' | 'secretEnv'> = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  idEnv: 'GOOGLE_CLIENT_ID',
  secretEnv: 'GOOGLE_CLIENT_SECRET',
}

const MICROSOFT: Pick<OauthApp, 'authorize' | 'token' | 'idEnv' | 'secretEnv'> = {
  authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  idEnv: 'MICROSOFT_CLIENT_ID',
  secretEnv: 'MICROSOFT_CLIENT_SECRET',
}

export const OAUTH_APPS: Record<OauthProvider, OauthApp> = {
  gmail: { ...GOOGLE, scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send'] },
  google_calendar: { ...GOOGLE, scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar'] },
  google_drive: { ...GOOGLE, scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'] },
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    idEnv: 'GITHUB_CLIENT_ID',
    secretEnv: 'GITHUB_CLIENT_SECRET',
    scopes: ['repo', 'read:user'],
  },
  slack: {
    authorize: 'https://slack.com/oauth/v2/authorize',
    token: 'https://slack.com/api/oauth.v2.access',
    idEnv: 'SLACK_CLIENT_ID',
    secretEnv: 'SLACK_CLIENT_SECRET',
    scopes: ['chat:write', 'channels:read'],
  },
  notion: {
    authorize: 'https://api.notion.com/v1/oauth/authorize',
    token: 'https://api.notion.com/v1/oauth/token',
    idEnv: 'NOTION_CLIENT_ID',
    secretEnv: 'NOTION_CLIENT_SECRET',
    scopes: [],
  },
  hubspot: {
    authorize: 'https://app.hubspot.com/oauth/authorize',
    token: 'https://api.hubapi.com/oauth/v1/token',
    idEnv: 'HUBSPOT_CLIENT_ID',
    secretEnv: 'HUBSPOT_CLIENT_SECRET',
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
  },
  outlook: {
    ...MICROSOFT,
    scopes: ['offline_access', 'openid', 'profile', 'User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send'],
  },
  outlook_calendar: {
    ...MICROSOFT,
    scopes: ['offline_access', 'openid', 'profile', 'User.Read', 'Calendars.ReadWrite'],
  },
  teams: {
    ...MICROSOFT,
    scopes: ['offline_access', 'openid', 'profile', 'User.Read', 'Chat.ReadWrite', 'ChannelMessage.Send'],
  },
  onedrive: {
    ...MICROSOFT,
    scopes: ['offline_access', 'openid', 'profile', 'User.Read', 'Files.ReadWrite'],
  },
  dropbox: {
    authorize: 'https://www.dropbox.com/oauth2/authorize',
    token: 'https://api.dropboxapi.com/oauth2/token',
    idEnv: 'DROPBOX_CLIENT_ID',
    secretEnv: 'DROPBOX_CLIENT_SECRET',
    scopes: [],
  },
  discord: {
    authorize: 'https://discord.com/api/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    idEnv: 'DISCORD_CLIENT_ID',
    secretEnv: 'DISCORD_CLIENT_SECRET',
    scopes: ['identify', 'guilds', 'bot'],
  },
}

export function isOauthProvider(provider: string): provider is OauthProvider {
  return provider in OAUTH_APPS
}

export function oauthCredentials(provider: OauthProvider) {
  const app = OAUTH_APPS[provider]
  const stored = readOauthApps() as Record<string, string | undefined>
  // Prefer data/oauth-apps.json over stale process.env (Next keeps old keys in memory)
  const id = (stored[app.idEnv] || serverEnv(app.idEnv) || '').trim()
  const secret = (stored[app.secretEnv] || serverEnv(app.secretEnv) || '').trim()
  if (id) process.env[app.idEnv] = id
  if (secret) process.env[app.secretEnv] = secret
  return { id, secret, app }
}

export function hubUrlFor(provider: string) {
  const specific = serverEnv(`ATLAS_MCP_${provider.toUpperCase()}_URL`)
  return specific || serverEnv('ATLAS_MCP_HUB_URL')
}

export function oauthAuthorizeUrl(provider: OauthProvider, clientId: string, redirectUri: string, state: string) {
  const app = OAUTH_APPS[provider]
  const url = new URL(app.authorize)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  if (app.scopes.length) url.searchParams.set('scope', app.scopes.join(' '))
  if (app.authorize.includes('google')) {
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
  }
  if (app.authorize.includes('microsoftonline')) {
    url.searchParams.set('response_mode', 'query')
    url.searchParams.set('prompt', 'select_account')
  }
  if (provider === 'dropbox') url.searchParams.set('token_access_type', 'offline')
  if (provider === 'notion') url.searchParams.set('owner', 'user')
  if (provider === 'discord') url.searchParams.set('permissions', '2048')
  return url.toString()
}

export function oauthToolsFor(provider: string) {
  const catalog: Record<string, Array<{ name: string; description: string }>> = {
    gmail: [
      { name: 'list_messages', description: 'Lire les derniers e-mails de la boîte Gmail' },
      { name: 'prepare_reply', description: 'Lire un mail et préparer une réponse adaptée au contenu' },
      { name: 'reply_email', description: 'Envoyer une réponse à un e-mail (to, subject, body, threadId)' },
      { name: 'send_email', description: 'Envoyer un e-mail (to, subject, body)' },
      { name: 'get_profile', description: 'Profil Gmail connecté' },
    ],
    google_calendar: [
      { name: 'list_events', description: 'Lister les événements à venir' },
      { name: 'create_event', description: 'Créer un événement (summary, start, end)' },
    ],
    google_drive: [
      { name: 'list_files', description: 'Lister les fichiers Drive récents' },
    ],
    slack: [
      { name: 'post_message', description: 'Poster un message Slack (channel, text)' },
      { name: 'list_channels', description: 'Lister les canaux Slack' },
    ],
    github: [
      { name: 'list_repos', description: 'Lister les dépôts GitHub' },
    ],
    notion: [
      { name: 'search', description: 'Rechercher dans Notion' },
    ],
    hubspot: [
      { name: 'list_contacts', description: 'Lister les contacts HubSpot' },
    ],
    outlook: [
      { name: 'list_messages', description: 'Lire les derniers e-mails Outlook' },
      { name: 'send_email', description: 'Envoyer un e-mail Outlook (to, subject, body)' },
      { name: 'get_profile', description: 'Profil Microsoft connecté' },
    ],
    outlook_calendar: [
      { name: 'list_events', description: 'Lister les événements Outlook Calendar' },
      { name: 'create_event', description: 'Créer un événement (summary, start, end)' },
    ],
    teams: [
      { name: 'list_chats', description: 'Lister les chats Teams récents' },
      { name: 'send_chat', description: 'Envoyer un message Teams (chatId, text)' },
    ],
    onedrive: [
      { name: 'list_files', description: 'Lister les fichiers OneDrive récents' },
    ],
    dropbox: [
      { name: 'list_files', description: 'Lister les fichiers Dropbox' },
    ],
    discord: [
      { name: 'list_guilds', description: 'Lister les serveurs Discord' },
      { name: 'send_message', description: 'Envoyer un message (channelId, text)' },
    ],
    telegram: [
      { name: 'get_me', description: 'Profil du bot Telegram' },
      { name: 'send_message', description: 'Envoyer un message (chatId, text)' },
    ],
    resend: [
      { name: 'send_email', description: 'Envoyer un e-mail transactionnel (to, subject, body)' },
    ],
    stripe: [
      { name: 'list_customers', description: 'Lister les clients Stripe' },
      { name: 'status', description: 'Statut compte Stripe' },
    ],
    figma: [
      { name: 'list_files', description: 'Lister les fichiers Figma récents' },
    ],
    linear: [
      { name: 'list_issues', description: 'Lister les issues Linear' },
    ],
    gitlab: [
      { name: 'list_projects', description: 'Lister les projets GitLab' },
    ],
    shopify: [
      { name: 'list_products', description: 'Lister les produits Shopify' },
    ],
    x: [
      { name: 'me', description: 'Profil X connecté' },
      { name: 'post', description: 'Publier un post (text)' },
    ],
    mootion: [
      { name: 'status', description: 'Statut Mootion' },
    ],
    evolus: [
      { name: 'summarize', description: 'AI Tool Evolus — résumer un texte (text)' },
      { name: 'compare', description: 'AI Tool Evolus — comparer deux textes (text, other)' },
      { name: 'chat', description: 'Agent Evolus (text) — modèle AMD de l’équipe' },
    ],
  }
  return catalog[provider] ?? []
}

export function capabilityTools(provider: string) {
  const mapped = oauthToolsFor(provider)
  if (mapped.length) return mapped
  const item = CONNECTOR_CATALOG.find((entry) => entry.provider === provider)
  return (item?.capabilities ?? ['Lire']).map((name) => ({ name, description: name }))
}

/** Consentement local uniquement (pas de faux « connecté » sans vrai OAuth/token). */
export function organizationGrant(provider: string) {
  const item = connectorOf(provider)
  if (!item) return null
  if (provider === 'machine' || provider === 'filesystem' || provider === 'browser') {
    return {
      provider: item.provider,
      ...desktopLinkFields(provider),
    }
  }
  return null
}
