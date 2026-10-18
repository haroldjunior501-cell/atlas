'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_LABEL, CONNECTOR_CATALOG, type ConnectorCategory } from '@atlas/domain'
import { BrandIcon } from '@/components/brand-icon'
import styles from './bureau.module.css'

export interface PublicLink {
  id: string
  organizationId: string
  provider: string
  kind: 'mcp' | 'n8n' | 'oauth'
  url: string
  tools: Array<{ name: string; description: string }>
  status: 'connected' | 'error'
  error?: string
  updatedAt: string
}

export type ToolAccess = 'none' | 'read' | 'send'

export interface ConnectAgent {
  id: string
  firstName: string
  lastName: string
  role: string
}

const FEATURED = [
  'ztc_core', 'fossbilling', 'whm', 'cloudflare', 'resellerclub', 'devoid',
  'gmail', 'github', 'stripe', 'notion',
]
const ADVANCED = new Set(['n8n', 'mcp', 'browser'])
const GROUPS: ConnectorCategory[] = [
  'hosting', 'communication', 'calendar', 'documents', 'development', 'business', 'automation', 'search', 'machine',
]

const ACCENT: Record<string, string> = {
  gmail: '#EA4335',
  google_calendar: '#4285F4',
  machine: '#A78BFA',
  filesystem: '#FBBF24',
  notion: '#E8E8E8',
  slack: '#E01E5A',
  github: '#F0F6FC',
  google_drive: '#34A853',
  outlook: '#0078D4',
  outlook_calendar: '#0078D4',
  teams: '#6264A7',
  discord: '#5865F2',
  telegram: '#2AABEE',
  resend: '#000000',
  hubspot: '#FF7A59',
  browser: '#60A5FA',
}

type FilterId = 'all' | ConnectorCategory

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'hosting', label: 'Hébergement' },
  { id: 'communication', label: 'Communication' },
  { id: 'calendar', label: 'Calendrier' },
  { id: 'documents', label: 'Documents' },
  { id: 'machine', label: 'Bureau' },
  { id: 'development', label: 'Développement' },
]

function capLabel(raw: string, category?: string) {
  const mail = category === 'communication' || category === 'calendar'
  if (/^lire$/i.test(raw)) return mail ? 'Lire' : 'Lire'
  if (/^envoyer$/i.test(raw)) return mail ? 'Envoyer' : 'Envoyer'
  if (/^répondre|repondre$/i.test(raw)) return 'Répondre'
  if (/^résumer|resumer$/i.test(raw)) return 'Résumer'
  if (/^créer|creer$/i.test(raw)) return category === 'calendar' ? 'Créer des événements' : 'Créer'
  if (/^modifier$/i.test(raw)) return 'Modifier'
  if (/^inviter$/i.test(raw)) return 'Inviter'
  if (/^ouvrir apps$/i.test(raw)) return 'Ouvrir des applications'
  if (/^fichiers$/i.test(raw)) return 'Gérer les fichiers'
  if (/^documents$/i.test(raw)) return 'Documents'
  if (/^lister$/i.test(raw)) return 'Lister'
  if (/^ouvrir$/i.test(raw)) return 'Ouvrir'
  if (/^créer un document|creer un document$/i.test(raw)) return 'Créer un document'
  return raw
}

export function ConnectPanel({
  organizationId,
  focus,
  pending,
  links,
  agents,
  grants,
  advanced,
  personal,
  onLink,
  onUnlink,
  onGrant,
  onLinks,
}: {
  organizationId?: string
  focus?: string
  pending: boolean
  links: PublicLink[]
  agents: ConnectAgent[]
  grants: Record<string, Record<string, ToolAccess>>
  advanced?: boolean
  personal?: boolean
  onLink: (provider: string) => void
  onUnlink: (provider: string) => void
  onGrant: (provider: string, agentId: string, access: ToolAccess) => void
  onLinks?: (links: PublicLink[]) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [sort, setSort] = useState<'popular' | 'az' | 'status'>('popular')

  const catalog = CONNECTOR_CATALOG.filter((item) => {
    if (!advanced && ADVANCED.has(item.provider)) return false
    if (!advanced && (item.category === 'design' || item.category === 'commerce')) return false
    return true
  })
  const featured = FEATURED.map((provider) => catalog.find((item) => item.provider === provider)).filter(Boolean) as typeof CONNECTOR_CATALOG
  const extra = catalog.filter((item) => !FEATURED.includes(item.provider))

  const filteredFeatured = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = featured.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false
      if (!q) return true
      return item.label.toLowerCase().includes(q)
        || item.provider.includes(q)
        || item.capabilities.some((cap) => cap.toLowerCase().includes(q))
    })
    if (sort === 'az') list = [...list].sort((a, b) => a.label.localeCompare(b.label, 'fr'))
    if (sort === 'status') {
      list = [...list].sort((a, b) => {
        const ac = links.some((l) => l.provider === a.provider && l.status === 'connected') ? 0 : 1
        const bc = links.some((l) => l.provider === b.provider && l.status === 'connected') ? 0 : 1
        return ac - bc || a.label.localeCompare(b.label, 'fr')
      })
    }
    return list
  }, [featured, filter, query, sort, links])

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: featured.length }
    for (const item of featured) {
      counts[item.category] = (counts[item.category] ?? 0) + 1
    }
    return counts
  }, [featured])

  return (
    <section className={`${styles.panel} ${styles.connectPanel}`}>
      <header className={styles.connectHead}>
        <div>
          <h1>Intégrations</h1>
          <p className={styles.lead}>
            Cliquez sur Relier et autorisez ATLAS. Pas besoin d’avoir dessiné l’organisation pour connecter vos outils.
            {personal ? ' Espace personnel — les droits agents s’activent une fois l’équipe créée.' : ' Ensuite, choisissez quels agents peuvent utiliser chaque outil.'}
          </p>
        </div>
      </header>

      <OauthKeysSetup />
      {personal ? (
        <p className={styles.connectHint}>
          Vous pouvez relier Gmail, Outlook, fichiers, Slack… tout de suite. Dessinez l’organisation plus tard pour attribuer les outils aux employés IA.
        </p>
      ) : null}

      <div className={styles.connectToolbar}>
        <label className={styles.connectSearch}>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une intégration…"
          />
        </label>
        <div className={styles.connectFilters} role="tablist" aria-label="Catégories">
          {FILTERS.map((item) => {
            const count = filterCounts[item.id] ?? 0
            if (item.id !== 'all' && count === 0) return null
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={filter === item.id ? styles.connectFilterOn : styles.connectFilter}
                onClick={() => setFilter(item.id)}
              >
                {item.id === 'all' ? `${item.label} (${featured.length})` : item.label}
              </button>
            )
          })}
        </div>
        <label className={styles.connectSort}>
          <span>Trier par</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="popular">Popularité</option>
            <option value="az">A → Z</option>
            <option value="status">Connectés d’abord</option>
          </select>
        </label>
      </div>

      <div className={styles.connectGrid}>
        {filteredFeatured.map((item) => (
          <ToolCard
            key={item.provider}
            item={item}
            link={links.find((entry) => entry.provider === item.provider)}
            focus={focus === item.provider}
            pending={pending}
            organizationId={organizationId}
            agents={agents}
            grants={grants[item.provider] ?? {}}
            onLink={onLink}
            onUnlink={onUnlink}
            onGrant={onGrant}
            onLinks={onLinks}
          />
        ))}
      </div>

      {extra.length ? (
        <details className={styles.toolGroup}>
          <summary>Autres outils</summary>
          {GROUPS.map((group) => {
            const items = extra.filter((item) => {
              if (item.category !== group) return false
              if (filter !== 'all' && item.category !== filter) return false
              const q = query.trim().toLowerCase()
              if (!q) return true
              return item.label.toLowerCase().includes(q) || item.provider.includes(q)
            })
            if (!items.length) return null
            return (
              <div key={group} className={styles.connectExtraGroup}>
                <h2>{CATEGORY_LABEL[group]}</h2>
                <div className={styles.connectGrid}>
                  {items.map((item) => (
                    <ToolCard
                      key={item.provider}
                      item={item}
                      link={links.find((entry) => entry.provider === item.provider)}
                      focus={focus === item.provider}
                      pending={pending}
                      organizationId={organizationId}
                      agents={agents}
                      grants={grants[item.provider] ?? {}}
                      onLink={onLink}
                      onUnlink={onUnlink}
                      onGrant={onGrant}
                      onLinks={onLinks}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </details>
      ) : null}
    </section>
  )
}

type SetupField = { key: string; label: string; placeholder?: string; secret?: boolean }
type SetupState = {
  setup: 'oauth' | 'token' | 'mcp'
  hint?: string
  fields?: SetupField[]
  envKeys?: string[]
  error?: string
}

function ToolCard({
  item, link, focus, pending, organizationId, agents, grants, onLink, onUnlink, onGrant, onLinks,
}: {
  item: (typeof CONNECTOR_CATALOG)[number]
  link?: PublicLink
  focus: boolean
  pending: boolean
  organizationId?: string
  agents: ConnectAgent[]
  grants: Record<string, ToolAccess>
  onLink: (provider: string) => void
  onUnlink: (provider: string) => void
  onGrant: (provider: string, agentId: string, access: ToolAccess) => void
  onLinks?: (links: PublicLink[]) => void
}) {
  const connected = link?.status === 'connected'
  const [draft, setDraft] = useState<Record<string, ToolAccess>>(grants)
  const [openConfig, setOpenConfig] = useState(false)
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState<SetupState | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const autoFocus = useRef(false)
  useEffect(() => { setDraft(grants) }, [grants])
  useEffect(() => {
    if (focus && connected) setOpenConfig(true)
    if (focus && !connected && !autoFocus.current) {
      autoFocus.current = true
      void startLink()
    }
    if (!focus) autoFocus.current = false
  }, [focus, connected])
  const dirty = agents.some((agent) => (draft[agent.id] ?? 'none') !== (grants[agent.id] ?? 'none'))
  const accent = ACCENT[item.provider] || '#8B5CF6'
  const statusLabel = connected ? 'Connecté' : link?.status === 'error' ? 'Erreur' : 'Non relié'

  function openOauthPopup(startUrl: string) {
    return new Promise<boolean>((resolve) => {
      const popup = window.open(startUrl, 'atlas-oauth', 'popup=yes,width=480,height=720')
      if (!popup || popup === window) {
        window.open(startUrl, '_blank', 'noopener')
        resolve(false)
        return
      }
      const win = popup
      const timer = window.setInterval(() => {
        if (win.closed) {
          window.clearInterval(timer)
          window.removeEventListener('message', onMessage)
          resolve(false)
        }
      }, 600)
      function onMessage(event: MessageEvent) {
        const data = event.data as { type?: string; ok?: boolean; provider?: string }
        if (data?.type !== 'atlas-oauth' || data.provider !== item.provider) return
        window.clearInterval(timer)
        window.removeEventListener('message', onMessage)
        win.close()
        resolve(Boolean(data.ok))
      }
      window.addEventListener('message', onMessage)
    })
  }

  async function startLink() {
    if (!organizationId) return
    setBusy(true)
    setMessage('')
    setSetup(null)
    try {
      const response = await fetch('/api/atlas/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent: 'authorize', organizationId, provider: item.provider }),
      })
      const body = await response.json() as {
        ok?: boolean
        method?: string
        startUrl?: string
        setup?: SetupState['setup']
        hint?: string
        fields?: SetupField[]
        envKeys?: string[]
        error?: string
        links?: PublicLink[]
      }
      if (body.links) onLinks?.(body.links)
      if (body.method === 'connected' && body.ok) {
        setMessage('Connecté.')
        onLink(item.provider)
        return
      }
      if (body.startUrl) {
        const ok = await openOauthPopup(body.startUrl)
        const refresh = await fetch(`/api/atlas/connect?organizationId=${encodeURIComponent(organizationId)}`)
        const next = await refresh.json() as { links?: PublicLink[] }
        if (next.links) onLinks?.(next.links)
        const linked = next.links?.some((entry) => entry.provider === item.provider && entry.status === 'connected')
        if (linked || ok) {
          setMessage('Connecté.')
          onLink(item.provider)
        } else {
          setMessage('Autorisez l’accès dans la fenêtre, puis revenez.')
        }
        return
      }
      if (body.method === 'setup' && body.setup) {
        setSetup({
          setup: body.setup,
          hint: body.hint,
          fields: body.fields,
          envKeys: body.envKeys,
          error: body.error,
        })
        setValues({})
        return
      }
      setMessage(body.error || 'Connexion impossible.')
    } catch {
      setMessage('Connexion impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function submitSetup() {
    if (!organizationId || !setup) return
    setBusy(true)
    setMessage('')
    try {
      if (setup.setup === 'mcp') {
        const url = (values.url || '').trim()
        if (!url) {
          setMessage('URL MCP requise.')
          return
        }
        const response = await fetch('/api/atlas/connect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            intent: 'link',
            organizationId,
            provider: item.provider,
            url,
            token: (values.token || '').trim() || undefined,
          }),
        })
        const body = await response.json() as { ok?: boolean; error?: string; links?: PublicLink[] }
        if (body.links) onLinks?.(body.links)
        if (!body.ok) {
          setMessage(body.error || 'URL MCP refusée.')
          return
        }
        setSetup(null)
        onLink(item.provider)
        setMessage('Connecté via MCP.')
        return
      }
      if (setup.setup === 'token') {
        const secrets: Record<string, string> = {}
        for (const field of setup.fields || []) {
          secrets[field.key] = (values[field.key] || '').trim()
        }
        const response = await fetch('/api/atlas/connect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ intent: 'token', organizationId, provider: item.provider, secrets }),
        })
        const body = await response.json() as { ok?: boolean; error?: string; links?: PublicLink[] }
        if (body.links) onLinks?.(body.links)
        if (!body.ok) {
          setMessage(body.error || 'Clé refusée.')
          return
        }
        setSetup(null)
        onLink(item.provider)
        setMessage('Connecté.')
        return
      }
      if (setup.setup === 'oauth') {
        setMessage(setup.hint || 'Configurez d’abord les Client ID / Secret (bandeau en haut), puis Relier.')
      }
    } catch {
      setMessage('Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className={[
        styles.connectCard,
        connected ? styles.connectCardLive : '',
        focus ? styles.cardOn : '',
      ].filter(Boolean).join(' ')}
      style={{ ['--connect-accent' as string]: accent }}
    >
      <header className={styles.connectCardTop}>
        <div className={styles.connectLogo} aria-hidden="true">
          <BrandIcon name={item.provider} />
        </div>
        <div className={styles.connectCardTitle}>
          <strong>{item.label}</strong>
          <span className={connected ? styles.connectBadgeOn : styles.connectBadgeOff}>
            {connected ? '✓ ' : ''}{statusLabel}
          </span>
        </div>
      </header>

      <p className={styles.connectDesc}>{item.hint}</p>

      <div className={styles.connectActions}>
        {connected ? (
          <>
            <button className={styles.connectDetach} type="button" disabled={pending || busy} onClick={() => onUnlink(item.provider)}>
              Détacher
            </button>
            <button
              className={styles.connectConfig}
              type="button"
              disabled={pending || busy || !agents.length}
              onClick={() => setOpenConfig((value) => !value)}
            >
              Configurer
            </button>
          </>
        ) : (
          <button
            className={styles.connectRelier}
            type="button"
            disabled={!organizationId || pending || busy}
            onClick={() => void startLink()}
          >
            {busy ? 'Connexion…' : 'Relier'}
          </button>
        )}
      </div>

      {setup ? (
        <div className={styles.connectAssign}>
          <p>{setup.hint || 'Complétez la connexion réelle.'}</p>
          {setup.setup === 'oauth' && setup.envKeys?.length ? (
            <p className={styles.connectDesc}>Clés attendues : {setup.envKeys.join(', ')} — utilisez le bandeau OAuth en haut de page.</p>
          ) : null}
          {(setup.fields || []).map((field) => (
            <label key={field.key} className={styles.connectSearch} style={{ display: 'flex', marginTop: 8 }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                {field.label}
                <input
                  type={field.secret ? 'password' : 'text'}
                  value={values[field.key] || ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  autoComplete="off"
                />
              </span>
            </label>
          ))}
          {setup.setup !== 'oauth' ? (
            <button className={styles.primary} type="button" disabled={busy} onClick={() => void submitSetup()} style={{ marginTop: 10 }}>
              Enregistrer et connecter
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className={styles.connectDesc}>{message}</p> : null}

      <ul className={styles.connectCaps}>
        {item.capabilities.slice(0, 4).map((cap) => (
          <li key={cap}>
            <span className={styles.connectCheck} aria-hidden="true">✓</span>
            {capLabel(cap, item.category)}
          </li>
        ))}
      </ul>

      {connected && agents.length && openConfig ? (
        <div className={styles.connectAssign}>
          <p>Quels agents peuvent utiliser {item.label} ?</p>
          <ul>
            {agents.map((agent) => {
              const access = draft[agent.id] ?? 'none'
              const allowed = access !== 'none'
              return (
                <li key={agent.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={allowed}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        [agent.id]: event.target.checked ? (access === 'none' ? 'send' : access) : 'none',
                      }))}
                    />
                    {agent.firstName} ({agent.role})
                  </label>
                  {allowed ? (
                    <select
                      aria-label={`Accès ${item.label} pour ${agent.firstName}`}
                      value={access}
                      onChange={(event) => setDraft((current) => ({ ...current, [agent.id]: event.target.value as ToolAccess }))}
                    >
                      <option value="read">Lire</option>
                      <option value="send">Lire + Envoyer</option>
                    </select>
                  ) : (
                    <span>Aucun accès</span>
                  )}
                </li>
              )
            })}
          </ul>
          <button
            className={styles.primary}
            type="button"
            disabled={!dirty || pending}
            onClick={() => {
              for (const agent of agents) {
                const access = draft[agent.id] ?? 'none'
                if (access !== (grants[agent.id] ?? 'none')) onGrant(item.provider, agent.id, access)
              }
            }}
          >
            Enregistrer
          </button>
        </div>
      ) : null}
    </article>
  )
}

function OauthKeysSetup() {
  const [status, setStatus] = useState<{
    googleReady?: boolean
    microsoftReady?: boolean
    redirectUri?: string
    consoleUrl?: string
    microsoftConsoleUrl?: string
  } | null>(null)
  const [tab, setTab] = useState<'google' | 'microsoft'>('google')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void fetch('/api/atlas/oauth/setup')
      .then((response) => response.json())
      .then((body) => setStatus(body))
      .catch(() => setStatus({ googleReady: false, microsoftReady: false }))
  }, [])

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const payload = tab === 'google'
        ? { GOOGLE_CLIENT_ID: clientId.trim(), GOOGLE_CLIENT_SECRET: clientSecret.trim() }
        : { MICROSOFT_CLIENT_ID: clientId.trim(), MICROSOFT_CLIENT_SECRET: clientSecret.trim() }
      const response = await fetch('/api/atlas/oauth/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json() as {
        ok?: boolean
        error?: string
        googleReady?: boolean
        microsoftReady?: boolean
        redirectUri?: string
      }
      if (!response.ok) {
        setMessage(body.error || 'Enregistrement impossible.')
        return
      }
      setStatus((current) => ({
        ...current,
        googleReady: body.googleReady,
        microsoftReady: body.microsoftReady,
        redirectUri: body.redirectUri,
      }))
      setMessage(
        tab === 'google'
          ? (body.googleReady ? 'Google OAuth prêt — Relier Gmail / Calendar / Drive.' : 'Vérifiez Client ID et Secret Google.')
          : (body.microsoftReady ? 'Microsoft OAuth prêt — Relier Outlook / Teams / OneDrive / Calendar.' : 'Vérifiez Client ID et Secret Microsoft.'),
      )
      setClientSecret('')
      setClientId('')
    } catch {
      setMessage('Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  const ready = tab === 'google' ? status?.googleReady : status?.microsoftReady
  const consoleHref = tab === 'google'
    ? (status?.consoleUrl || 'https://console.cloud.google.com/apis/credentials')
    : (status?.microsoftConsoleUrl || 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade')

  return (
    <div className={styles.connectSetup}>
      <div className={styles.connectSetupIcon} aria-hidden="true">
        <BrandIcon name={tab === 'google' ? 'google' : 'outlook'} />
      </div>
      <div>
        <strong>Clés OAuth (connexion réelle)</strong>
        <div className={styles.connectActions} style={{ marginTop: 8 }}>
          <button
            className={tab === 'google' ? styles.connectRelier : styles.connectDetach}
            type="button"
            onClick={() => { setTab('google'); setClientId(''); setClientSecret(''); setMessage('') }}
          >
            Google {status?.googleReady ? '✓' : ''}
          </button>
          <button
            className={tab === 'microsoft' ? styles.connectRelier : styles.connectDetach}
            type="button"
            onClick={() => { setTab('microsoft'); setClientId(''); setClientSecret(''); setMessage('') }}
          >
            Microsoft 365 {status?.microsoftReady ? '✓' : ''}
          </button>
        </div>
        {ready ? (
          <>
            <p className={styles.linked}>
              {tab === 'google'
                ? 'Prêt — Relier ouvre la fenêtre Google.'
                : 'Prêt — Relier ouvre la fenêtre Microsoft (Outlook, Teams, Calendar, OneDrive).'}
            </p>
            <p className={styles.connectDesc}>URI de callback : <code>{status?.redirectUri}</code></p>
          </>
        ) : (
          <ol className={styles.connectDesc} style={{ margin: '8px 0', paddingLeft: 18 }}>
            {tab === 'google' ? (
              <>
                <li>Console Google → projet → activez Gmail, Calendar et Drive API.</li>
                <li>Identifiants → ID client OAuth → Application Web.</li>
              </>
            ) : (
              <>
                <li>Azure Portal → Inscriptions d’applications → Nouvelle inscription.</li>
                <li>Type comptes : comptes personnels + pro. Activez Microsoft Graph (Mail, Calendars, Files, Chat).</li>
              </>
            )}
            <li>
              URI de redirection :
              <br />
              <code>{status?.redirectUri || 'http://localhost:3000/api/atlas/oauth/callback'}</code>
            </li>
            <li>Collez Client ID + Secret, puis Enregistrer. Ensuite Relier sur l’outil.</li>
          </ol>
        )}
        <div className={styles.connectActions}>
          <a className={styles.connectDetach} href={consoleHref} target="_blank" rel="noreferrer">
            {tab === 'google' ? 'Ouvrir Google Cloud' : 'Ouvrir Azure'}
          </a>
          <button
            className={styles.connectDetach}
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(status?.redirectUri || 'http://localhost:3000/api/atlas/oauth/callback')
              setMessage('URI de callback copiée.')
            }}
          >
            Copier l’URI
          </button>
        </div>
        {!ready ? (
          <>
            <label className={styles.connectField}>
              Client ID
              <input
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder={tab === 'google' ? 'xxxxx.apps.googleusercontent.com' : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                autoComplete="off"
              />
            </label>
            <label className={styles.connectField}>
              Client Secret
              <input
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                type="password"
                placeholder={tab === 'google' ? 'GOCSPX-…' : 'Secret Azure'}
                autoComplete="off"
              />
            </label>
            <div className={styles.connectActions}>
              <button
                className={styles.connectRelier}
                type="button"
                disabled={busy || !clientId.trim() || !clientSecret.trim()}
                onClick={() => void save()}
              >
                Enregistrer
              </button>
            </div>
          </>
        ) : null}
        {message ? <p className={styles.connectDesc}>{message}</p> : null}
      </div>
    </div>
  )
}
