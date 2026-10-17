import type { ConnectorCategory, ConnectorProvider } from './model'

export interface ConnectorDescriptor {
  provider: ConnectorProvider
  category: ConnectorCategory
  label: string
  capabilities: string[]
  writes: boolean
  mcp: string
  hint: string
}

export const CONNECTOR_CATALOG: ConnectorDescriptor[] = [
  { provider: 'gmail', category: 'communication', label: 'Gmail', capabilities: ['Lire', 'Envoyer', 'Répondre', 'Résumer'], writes: true, mcp: 'https://github.com/GongRzhe/Gmail-MCP-Server', hint: 'Serveur MCP Gmail (OAuth chez le serveur, pas dans Atlas).' },
  { provider: 'outlook', category: 'communication', label: 'Outlook', capabilities: ['Lire', 'Envoyer', 'Répondre', 'Résumer'], writes: true, mcp: 'https://learn.microsoft.com/graph/api/overview', hint: 'OAuth Microsoft 365 (MICROSOFT_CLIENT_ID / SECRET) ou URL MCP n8n.' },
  { provider: 'slack', category: 'communication', label: 'Slack', capabilities: ['Envoyer', 'Lire les canaux', 'Messages privés'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'OAuth Slack (Client ID / Secret) ou MCP via n8n.' },
  { provider: 'teams', category: 'communication', label: 'Teams', capabilities: ['Envoyer', 'Lire les canaux'], writes: true, mcp: 'https://learn.microsoft.com/graph/api/overview', hint: 'OAuth Microsoft 365 ou MCP n8n.' },
  { provider: 'discord', category: 'communication', label: 'Discord', capabilities: ['Lire', 'Envoyer'], writes: true, mcp: 'https://github.com/SaseQ/discord-mcp', hint: 'Collez le bot token Discord, ou une URL MCP Discord.' },
  { provider: 'telegram', category: 'communication', label: 'Telegram', capabilities: ['Envoyer', 'Recevoir'], writes: true, mcp: 'https://github.com/guangxiangdebizi/telegram-mcp', hint: 'Bot token Telegram (pas de userbot).' },
  { provider: 'x', category: 'communication', label: 'X', capabilities: ['Publier', 'Lire', 'Rechercher'], writes: true, mcp: 'https://github.com/xdevplatform/xmcp', hint: 'Bearer token X. Rien n’est publié sans connexion.' },
  { provider: 'google_calendar', category: 'calendar', label: 'Google Calendar', capabilities: ['Créer', 'Modifier', 'Inviter', 'Créneaux libres'], writes: true, mcp: 'https://github.com/nspady/google-calendar-mcp', hint: 'OAuth Google (mêmes clés que Gmail).' },
  { provider: 'outlook_calendar', category: 'calendar', label: 'Outlook Calendar', capabilities: ['Créer', 'Modifier', 'Inviter', 'Créneaux libres'], writes: true, mcp: 'https://learn.microsoft.com/graph/api/overview', hint: 'OAuth Microsoft 365, même contrat que Google Calendar.' },
  { provider: 'github', category: 'development', label: 'GitHub', capabilities: ['Issues', 'PR', 'Code', 'CI/CD'], writes: true, mcp: 'https://github.com/github/github-mcp-server', hint: 'OAuth GitHub. Les écritures passent par une approbation.' },
  { provider: 'gitlab', category: 'development', label: 'GitLab', capabilities: ['Issues', 'MR', 'CI/CD'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'Personal access token GitLab, ou URL MCP / n8n.' },
  { provider: 'jira', category: 'development', label: 'Jira', capabilities: ['Tickets', 'Sprints'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'Collez l’URL MCP Atlassian / n8n.' },
  { provider: 'linear', category: 'development', label: 'Linear', capabilities: ['Tickets', 'Cycles'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'Clé API Linear, ou MCP Sema4 / n8n.' },
  { provider: 'google_drive', category: 'documents', label: 'Google Drive', capabilities: ['Lire', 'Créer', 'Partager'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'OAuth Google Drive.' },
  { provider: 'onedrive', category: 'documents', label: 'OneDrive', capabilities: ['Lire', 'Créer', 'Partager'], writes: true, mcp: 'https://learn.microsoft.com/graph/api/overview', hint: 'OAuth Microsoft 365 (Graph Files).' },
  { provider: 'notion', category: 'documents', label: 'Notion', capabilities: ['Pages', 'Bases', 'Recherche'], writes: true, mcp: 'https://github.com/makenotion/notion-mcp-server', hint: 'OAuth Notion officiel.' },
  { provider: 'dropbox', category: 'documents', label: 'Dropbox', capabilities: ['Lire', 'Partager'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'Access token Dropbox, ou URL MCP n8n.' },
  { provider: 'crm', category: 'business', label: 'CRM', capabilities: ['Contacts', 'Deals', 'Notes'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'URL MCP HubSpot / Salesforce / Pipedrive via n8n.' },
  { provider: 'hubspot', category: 'business', label: 'HubSpot', capabilities: ['Contacts', 'Deals', 'Devis'], writes: true, mcp: 'https://developers.hubspot.com/', hint: 'OAuth HubSpot (Client ID / Secret).' },
  { provider: 'salesforce', category: 'business', label: 'Salesforce', capabilities: ['Leads', 'Opportunités', 'Comptes'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'URL MCP n8n. Pas de faux OAuth Atlas.' },
  { provider: 'pipedrive', category: 'business', label: 'Pipedrive', capabilities: ['Deals', 'Contacts', 'Activités'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'Token API Pipedrive, ou MCP n8n.' },
  { provider: 'stripe', category: 'business', label: 'Stripe', capabilities: ['Paiements', 'Factures', 'Abonnements'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'Clé secrète Stripe. Écritures toujours en approbation.' },
  { provider: 'analytics', category: 'business', label: 'Analytics (GA4)', capabilities: ['Métriques', 'Rapports'], writes: false, mcp: 'https://github.com/n8n-io/n8n', hint: 'Lecture seule via URL MCP (n8n).' },
  { provider: 'mixpanel', category: 'business', label: 'Mixpanel', capabilities: ['Événements', 'Rapports'], writes: false, mcp: 'https://github.com/n8n-io/n8n', hint: 'URL MCP n8n ou API custom.' },
  { provider: 'figma', category: 'design', label: 'Figma', capabilities: ['Fichiers', 'Composants', 'Export'], writes: true, mcp: 'https://github.com/figma/mcp-server-guide', hint: 'Personal access token Figma, ou MCP officiel.' },
  { provider: 'canva', category: 'design', label: 'Canva', capabilities: ['Visuels'], writes: true, mcp: 'https://www.canva.com/', hint: 'Token API Canva. Rien n’est publié sans connexion.' },
  { provider: 'mootion', category: 'design', label: 'Mootion', capabilities: ['Animation 3D', 'Avatar'], writes: true, mcp: 'https://www.mootion.com/', hint: 'Clé Mootion dans l’environnement, jamais inventée.' },
  { provider: 'shopify', category: 'commerce', label: 'Shopify', capabilities: ['Catalogue', 'Panier', 'Commandes'], writes: true, mcp: 'https://shopify.dev/docs/apps/build/storefront-mcp', hint: 'Boutique + Admin API token, ou MCP Storefront.' },
  { provider: 'resend', category: 'communication', label: 'Resend', capabilities: ['E-mails transactionnels'], writes: true, mcp: 'https://github.com/resend/resend-mcp', hint: 'Clé API Resend. Aucun mail sans connexion.' },
  { provider: 'n8n', category: 'automation', label: 'n8n', capabilities: ['Hub MCP', '400+ nœuds', 'File d’attente'], writes: true, mcp: 'https://github.com/n8n-io/n8n', hint: 'Collez l’URL du nœud MCP Server Trigger. n8n garde les OAuth.' },
  { provider: 'mcp', category: 'automation', label: 'MCP custom', capabilities: ['APIs spécifiques', 'Découverte d’outils'], writes: true, mcp: 'https://modelcontextprotocol.io/', hint: 'Toute URL MCP JSON-RPC : Atlas devient le client.' },
  { provider: 'browser', category: 'search', label: 'Navigateur (Computer Use)', capabilities: ['Ouvrir Chrome/Edge', 'Sites'], writes: true, mcp: 'local://desktop', hint: 'Ouvre Chrome ou Edge sur cet ordinateur. Sites avancés via MCP Puppeteer optionnel.' },
  { provider: 'machine', category: 'machine', label: 'Ordinateur (ATLAS Desktop)', capabilities: ['Ouvrir apps', 'Contrôler dans l’app', 'Lister apps', 'Fichiers'], writes: true, mcp: 'local://desktop', hint: 'Pilote les apps comme un utilisateur : « lance le son de Ninho sur Spotify », « cherche budget dans Notion », « écris bonjour dans Word ».' },
  { provider: 'filesystem', category: 'machine', label: 'Fichiers (Bureau / Documents)', capabilities: ['Lister', 'Ouvrir', 'Créer un document'], writes: true, mcp: 'local://desktop', hint: 'Racines : Bureau, Documents, Téléchargements. Pas d’accès hors de ces dossiers.' },
  { provider: 'ztc_core', category: 'hosting', label: 'ZTC Hosting', capabilities: ['Services', 'Commandes', 'Ressources autorisées'], writes: false, mcp: 'https://ztchosting.com/', hint: 'API métier ZTC. Lecture seule jusqu’à connexion. Aucun secret dans le chat.' },
  { provider: 'fossbilling', category: 'hosting', label: 'FOSSBilling', capabilities: ['Commandes', 'Factures', 'Statut service'], writes: false, mcp: 'https://fossbilling.org/', hint: 'Moteur de facturation ZTC. Atlas n’écrit pas sans approbation.' },
  { provider: 'whm', category: 'hosting', label: 'WHM / cPanel', capabilities: ['Comptes', 'Quotas', 'SSL', 'Sites'], writes: false, mcp: 'https://api.docs.cpanel.net/', hint: 'WHM API 1. Actions sensibles (suspendre, supprimer) toujours en approbation.' },
  { provider: 'cloudflare', category: 'hosting', label: 'Cloudflare', capabilities: ['Zones DNS', 'Cache', 'Enregistrements'], writes: false, mcp: 'https://developers.cloudflare.com/api/', hint: 'Jeton limité aux zones exactes. Prévisualisation avant écriture.' },
  { provider: 'resellerclub', category: 'hosting', label: 'ResellerClub', capabilities: ['Disponibilité', 'Enregistrement', 'Renouvellement'], writes: false, mcp: 'https://manage.resellerclub.com/', hint: 'Transactions payantes bloquées sans accord. Pas de prix inventé.' },
  { provider: 'devoid', category: 'hosting', label: 'DEVOID', capabilities: ['Santé', 'Opérateur lecture'], writes: false, mcp: 'local://devoid', hint: 'Prototype FastAPI ZTC (/health, /operator). À revalider, jamais un second orchestrateur.' },
]

export const ACTION = {
  readAnalytics: 'read_analytics',
  readCrm: 'read_crm',
  sendEmail: 'send_email',
  createCampaign: 'create_campaign',
  spend: 'spend',
  editBilling: 'edit_billing',
  editCode: 'edit_code',
  finance: 'finance',
  manageBudget: 'manage_budget',
  reviewContract: 'review_contract',
} as const

export const CATEGORY_LABEL: Record<ConnectorCategory, string> = {
  communication: 'Communication',
  calendar: 'Calendrier',
  development: 'Développement',
  documents: 'Documents',
  business: 'Business',
  design: 'Design',
  automation: 'Automatisation',
  machine: 'Machine',
  search: 'Web & navigateur',
  commerce: 'Commerce',
  hosting: 'Hébergement',
}

export function connectorOf(provider: string) {
  return CONNECTOR_CATALOG.find((item) => item.provider === provider) ?? null
}
