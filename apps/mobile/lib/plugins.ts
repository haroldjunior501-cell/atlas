import {
  CATEGORY_LABEL,
  CONNECTOR_CATALOG,
  connectorOf,
  type ConnectorCategory,
  type ConnectorDescriptor,
} from '@atlas/domain'

export { CONNECTOR_CATALOG, CATEGORY_LABEL, connectorOf }
export type { ConnectorDescriptor, ConnectorCategory }

/** Même ordre que le Studio Bureau → Intégrations. */
export const PLUGIN_GROUPS: ConnectorCategory[] = [
  'communication',
  'calendar',
  'documents',
  'development',
  'business',
  'design',
  'commerce',
  'automation',
  'search',
  'machine',
]

export const FEATURED_PLUGINS = [
  'gmail',
  'outlook',
  'google_calendar',
  'machine',
  'filesystem',
  'notion',
  'slack',
  'github',
  'google_drive',
  'teams',
  'discord',
  'resend',
] as const

export const PLUGIN_ACCENT: Record<string, string> = {
  gmail: '#EA4335',
  google_calendar: '#4285F4',
  google_drive: '#34A853',
  machine: '#A78BFA',
  filesystem: '#FBBF24',
  notion: '#E8E8E8',
  slack: '#E01E5A',
  github: '#F0F6FC',
  outlook: '#0078D4',
  outlook_calendar: '#0078D4',
  teams: '#6264A7',
  discord: '#5865F2',
  telegram: '#2AABEE',
  resend: '#111111',
  hubspot: '#FF7A59',
  crm: '#FF7A59',
  browser: '#60A5FA',
  figma: '#A259FF',
  canva: '#00C4CC',
  stripe: '#635BFF',
  shopify: '#96BF48',
  x: '#FFFFFF',
  linear: '#5E6AD2',
  jira: '#2684FF',
  dropbox: '#0061FF',
  salesforce: '#00A1E0',
  pipedrive: '#017737',
  mootion: '#FF6B4A',
  analytics: '#F9AB00',
  mixpanel: '#7856FF',
  n8n: '#EA4B71',
  mcp: '#38BDF8',
  gitlab: '#FC6D26',
  onedrive: '#0078D4',
}

export function pluginBlurb(item: ConnectorDescriptor) {
  return item.capabilities.slice(0, 2).join(', ')
}

export function featuredPlugins() {
  return FEATURED_PLUGINS.map((id) => connectorOf(id)).filter(Boolean) as ConnectorDescriptor[]
}

export function pluginsByCategory() {
  return PLUGIN_GROUPS.map((category) => ({
    category,
    title: CATEGORY_LABEL[category],
    items: CONNECTOR_CATALOG.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)
}

export function pluginPrompt(provider: string, ask: string) {
  const app = connectorOf(provider)
  const name = app?.label || provider
  const caps = app?.capabilities?.join(', ') || ''
  return [
    `Tu pilotes l’application ${name} via le Studio ATLAS (connecteur ${provider}).`,
    caps ? `Capacités : ${caps}.` : '',
    'Exécute la demande concrètement. Si la connexion manque sur le PC, dis-le clairement et explique comment la relier dans Intégrations.',
    `Demande : ${ask.trim() || `Propose une première action utile avec ${name}.`}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function matchPluginOrder(text: string): string | null {
  const heard = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const aliases: Array<[RegExp, string]> = [
    [/\bgmail\b|\bgoogle mail\b/, 'gmail'],
    [/\boutlook\b/, 'outlook'],
    [/\bslack\b/, 'slack'],
    [/\bteams\b/, 'teams'],
    [/\bdiscord\b/, 'discord'],
    [/\btelegram\b/, 'telegram'],
    [/\btwitter\b|\b\bx\b(?=\s|$)/, 'x'],
    [/google calendar|calendrier google/, 'google_calendar'],
    [/outlook calendar|calendrier outlook/, 'outlook_calendar'],
    [/\bgithub\b/, 'github'],
    [/\bgitlab\b/, 'gitlab'],
    [/\bjira\b/, 'jira'],
    [/\blinear\b/, 'linear'],
    [/google drive|\bdrive\b/, 'google_drive'],
    [/\bonedrive\b/, 'onedrive'],
    [/\bnotion\b/, 'notion'],
    [/\bdropbox\b/, 'dropbox'],
    [/\bhubspot\b/, 'hubspot'],
    [/\bsalesforce\b/, 'salesforce'],
    [/\bpipedrive\b/, 'pipedrive'],
    [/\bstripe\b/, 'stripe'],
    [/\bfigma\b/, 'figma'],
    [/\bcanva\b/, 'canva'],
    [/\bmootion\b/, 'mootion'],
    [/\bshopify\b/, 'shopify'],
    [/\bresend\b/, 'resend'],
    [/\bn8n\b/, 'n8n'],
    [/\bmcp\b/, 'mcp'],
    [/navigateur|chrome|edge|browser/, 'browser'],
    [/ordinateur|desktop|machine atlas/, 'machine'],
    [/fichiers? \(bureau|filesystem/, 'filesystem'],
    [/\banalytics\b|\bga4\b/, 'analytics'],
    [/\bmixpanel\b/, 'mixpanel'],
    [/\bcrm\b/, 'crm'],
  ]
  for (const [re, id] of aliases) {
    if (re.test(heard)) return id
  }
  return null
}
