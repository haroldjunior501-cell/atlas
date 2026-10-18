/**
 * Générateur de sites web one-page « hyper stylés ».
 * Contenu via LLM (JSON) → HTML/CSS autonome, enregistré dans Documents.
 */
import { saveUserBinaryFile } from '@/lib/atlas-desktop'
import { nemotron } from '@/lib/nemotron'

export type SiteThemeId = 'signal' | 'nocturne' | 'nord' | 'kinetic' | 'atelier'

export type SiteSection = {
  title: string
  body: string
  points?: string[]
}

export type SiteBrief = {
  brand: string
  tagline: string
  headline: string
  subhead: string
  cta: string
  ctaSecondary?: string
  theme: SiteThemeId
  sections: SiteSection[]
  footer?: string
}

type ThemeTokens = {
  id: SiteThemeId
  label: string
  display: string
  body: string
  bg: string
  bg2: string
  ink: string
  muted: string
  accent: string
  accent2: string
  heroWash: string
  pattern: string
}

const THEMES: Record<SiteThemeId, ThemeTokens> = {
  signal: {
    id: 'signal',
    label: 'Signal',
    display: 'Syne',
    body: 'IBM Plex Sans',
    bg: '#07090f',
    bg2: '#101826',
    ink: '#f4f7fb',
    muted: '#9aa8bc',
    accent: '#b8f34a',
    accent2: '#5eead4',
    heroWash: 'radial-gradient(120% 80% at 12% 10%, rgba(184,243,74,.22), transparent 55%), radial-gradient(90% 70% at 88% 20%, rgba(94,234,212,.18), transparent 50%), linear-gradient(165deg, #07090f 0%, #121a2b 55%, #0a0e16 100%)',
    pattern: 'repeating-linear-gradient(-12deg, transparent, transparent 22px, rgba(255,255,255,.03) 22px, rgba(255,255,255,.03) 23px)',
  },
  nocturne: {
    id: 'nocturne',
    label: 'Nocturne',
    display: 'Cormorant Garamond',
    body: 'Karla',
    bg: '#0c0a0b',
    bg2: '#171214',
    ink: '#f7efe8',
    muted: '#b9a89a',
    accent: '#e8b4a0',
    accent2: '#f0d5a8',
    heroWash: 'radial-gradient(100% 80% at 70% 0%, rgba(232,180,160,.2), transparent 55%), radial-gradient(80% 60% at 10% 80%, rgba(240,213,168,.1), transparent 45%), linear-gradient(180deg, #0c0a0b, #1a1216 60%, #0c0a0b)',
    pattern: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.04) 1px, transparent 0)',
  },
  nord: {
    id: 'nord',
    label: 'Nord',
    display: 'Outfit',
    body: 'Newsreader',
    bg: '#0b1220',
    bg2: '#132033',
    ink: '#eef5ff',
    muted: '#9eb2cc',
    accent: '#7dd3fc',
    accent2: '#a5b4fc',
    heroWash: 'radial-gradient(90% 70% at 80% 15%, rgba(125,211,252,.25), transparent 50%), radial-gradient(70% 60% at 15% 70%, rgba(165,180,252,.16), transparent 45%), linear-gradient(160deg, #0b1220, #152743 50%, #0b1220)',
    pattern: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
  },
  kinetic: {
    id: 'kinetic',
    label: 'Kinetic',
    display: 'Bebas Neue',
    body: 'Space Grotesk',
    bg: '#050505',
    bg2: '#121212',
    ink: '#fafafa',
    muted: '#a3a3a3',
    accent: '#facc15',
    accent2: '#fb7185',
    heroWash: 'conic-gradient(from 210deg at 70% 20%, rgba(250,204,21,.2), transparent 35%, rgba(251,113,133,.16), transparent 70%), linear-gradient(180deg, #050505, #141414)',
    pattern: 'repeating-linear-gradient(90deg, transparent, transparent 48px, rgba(250,204,21,.05) 48px, rgba(250,204,21,.05) 49px)',
  },
  atelier: {
    id: 'atelier',
    label: 'Atelier',
    display: 'Fraunces',
    body: 'Manrope',
    bg: '#11140f',
    bg2: '#1b2118',
    ink: '#f3f0e6',
    muted: '#b7b29f',
    accent: '#c4d69f',
    accent2: '#8fbc8f',
    heroWash: 'radial-gradient(80% 70% at 20% 20%, rgba(196,214,159,.2), transparent 55%), radial-gradient(70% 50% at 90% 60%, rgba(143,188,143,.12), transparent 50%), linear-gradient(155deg, #11140f, #1c2418 55%, #0f120d)',
    pattern: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.05), transparent 55%)',
  },
}

const THEME_IDS = Object.keys(THEMES) as SiteThemeId[]

export function pickTheme(topic: string, forced?: string): ThemeTokens {
  const raw = String(forced || '').toLowerCase()
  if (THEME_IDS.includes(raw as SiteThemeId)) return THEMES[raw as SiteThemeId]
  const t = topic.toLowerCase()
  if (/mode|luxe|parfum|beaut[eé]|bijou|fashion|noir|soir[eé]e/.test(t)) return THEMES.nocturne
  if (/tech|saas|ia|ai|software|startup|fintech|cyber|app/.test(t)) return THEMES.signal
  if (/sport|fitness|event|festival|club|énergie|energie|gaming/.test(t)) return THEMES.kinetic
  if (/archi|design|studio|agence|café|cafe|restaurant|food|nature|jardin/.test(t)) return THEMES.atelier
  if (/sant[eé]|clinique|nord|ocean|mer|voyage|hotel|h[oô]tel|ski/.test(t)) return THEMES.nord
  return THEMES.signal
}

export const SITE_BRIEF_SYSTEM = `Tu es directeur artistique + copywriter. Tu prépares le contenu d'un site one-page ultra soigné.
Réponds UNIQUEMENT avec un JSON valide (pas de markdown) :
{
  "brand": "nom court de la marque",
  "tagline": "signature courte",
  "headline": "accroche hero (max 10 mots)",
  "subhead": "1 phrase de soutien",
  "cta": "libellé bouton principal",
  "ctaSecondary": "libellé secondaire",
  "theme": "signal|nocturne|nord|kinetic|atelier",
  "sections": [
    {"title":"...","body":"1-2 phrases","points":["...","..."]},
    {"title":"...","body":"...","points":["..."]},
    {"title":"...","body":"...","points":["..."]}
  ],
  "footer": "ligne footer"
}
Rules: 3 sections max, English unless asked otherwise, strong brand, no AI jargon, no "revolutionary" / "next-gen".`

export function parseSiteBrief(raw: string, fallbackTopic: string): SiteBrief {
  const text = raw.trim()
  const jsonHit = text.match(/\{[\s\S]*\}/)
  if (jsonHit) {
    try {
      const body = JSON.parse(jsonHit[0]) as Partial<SiteBrief>
      const brand = String(body.brand || fallbackTopic).trim().slice(0, 48) || 'ATLAS'
      const sections = (Array.isArray(body.sections) ? body.sections : [])
        .map((section) => ({
          title: String(section?.title || 'Section').trim().slice(0, 80),
          body: String(section?.body || '').trim().slice(0, 420),
          points: Array.isArray(section?.points)
            ? section.points.map(String).map((p) => p.trim()).filter(Boolean).slice(0, 5)
            : [],
        }))
        .filter((section) => section.title)
        .slice(0, 4)
      const theme = THEME_IDS.includes(body.theme as SiteThemeId) ? body.theme as SiteThemeId : pickTheme(fallbackTopic).id
      if (brand && sections.length) {
        return {
          brand,
          tagline: String(body.tagline || '').trim().slice(0, 80),
          headline: String(body.headline || brand).trim().slice(0, 90),
          subhead: String(body.subhead || body.tagline || '').trim().slice(0, 180),
          cta: String(body.cta || 'Découvrir').trim().slice(0, 40),
          ctaSecondary: String(body.ctaSecondary || 'Nous contacter').trim().slice(0, 40),
          theme,
          sections,
          footer: String(body.footer || `© ${new Date().getFullYear()} ${brand}`).trim().slice(0, 120),
        }
      }
    } catch { /* fallback */ }
  }

  const brand = fallbackTopic
    .replace(/^(?:cr[eé]e|fais|g[eé]n[eè]re|pr[eé]pare)\s+(?:un |une |le |la )?/i, '')
    .replace(/\b(?:site|web|landing|page|internet|vitrine|hyper\s*styl[eé]e?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40) || 'Studio'

  return {
    brand,
    tagline: 'Fait pour marquer.',
    headline: brand,
    subhead: 'Une présence nette, moderne, prête à convertir.',
    cta: 'Commencer',
    ctaSecondary: 'Voir plus',
    theme: pickTheme(fallbackTopic).id,
    sections: [
      { title: 'Approche', body: 'Une direction claire, un rythme assumé, zéro surplus.', points: ['Identité forte', 'Parcours fluide', 'Détails soignés'] },
      { title: 'Offre', body: 'Ce qui compte, dit simplement — et bien.', points: ['Essentiels', 'Sur-mesure', 'Résultat visible'] },
      { title: 'Contact', body: 'Parlons de votre prochaine étape.', points: ['Brief rapide', 'Proposition nette', 'Lancement'] },
    ],
    footer: `© ${new Date().getFullYear()} ${brand}`,
  }
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fontImport(theme: ThemeTokens) {
  const families = [theme.display, theme.body]
    .map((name) => name.replace(/\s+/g, '+'))
    .map((name) => `family=${name}:wght@400;500;600;700`)
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

/** Assemble un HTML one-file autonome, brand-first, hero full-bleed. */
export function buildWebsiteHtml(brief: SiteBrief): string {
  const theme = pickTheme(`${brief.brand} ${brief.headline}`, brief.theme)
  const sectionHtml = brief.sections.map((section, index) => `
  <section class="block reveal" id="s${index}" style="--i:${index}">
    <div class="block-inner">
      <p class="eyebrow">${String(index + 1).padStart(2, '0')}</p>
      <h2>${esc(section.title)}</h2>
      <p class="lead">${esc(section.body)}</p>
      ${section.points?.length ? `<ul>${section.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    </div>
  </section>`).join('\n')

  const mailHost = brief.brand.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'studio'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(brief.brand)} — ${esc(brief.tagline || brief.headline)}</title>
<meta name="description" content="${esc(brief.subhead)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${fontImport(theme)}" rel="stylesheet" />
<style>
:root {
  --bg: ${theme.bg}; --bg2: ${theme.bg2}; --ink: ${theme.ink}; --muted: ${theme.muted};
  --accent: ${theme.accent}; --accent2: ${theme.accent2};
  --display: "${theme.display}", Georgia, serif;
  --body: "${theme.body}", system-ui, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { min-height: 100vh; color: var(--ink); background: var(--bg); font-family: var(--body); line-height: 1.55; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }
.hero {
  min-height: 100svh; display: grid; grid-template-rows: auto 1fr auto;
  padding: clamp(1.1rem, 3vw, 2rem); background: ${theme.heroWash}; position: relative; overflow: clip;
}
.hero::before {
  content: ""; position: absolute; inset: 0; background: ${theme.pattern};
  background-size: ${theme.id === 'nord' ? '42px 42px' : theme.id === 'nocturne' ? '18px 18px' : 'auto'};
  opacity: .9; pointer-events: none; animation: drift 22s linear infinite;
}
@keyframes drift { to { transform: translate3d(-28px, 16px, 0); } }
.nav, .hero-main, .hero-foot { position: relative; z-index: 1; }
.nav { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.brand {
  font-family: var(--display); font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 700;
  letter-spacing: ${theme.id === 'kinetic' ? '.04em' : '-.02em'}; line-height: 1;
}
.nav-links { display: flex; gap: 1.25rem; color: var(--muted); font-size: .92rem; }
.nav-links a:hover { color: var(--ink); }
.hero-main { display: grid; align-content: center; gap: 1.25rem; padding: clamp(2rem, 8vh, 5rem) 0; }
.tagline { color: var(--accent); font-size: .85rem; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; }
.hero h1 {
  font-family: var(--display); font-size: clamp(2.8rem, 9vw, 6.2rem); line-height: .95;
  letter-spacing: ${theme.id === 'kinetic' ? '.02em' : '-.03em'}; max-width: 12ch; animation: rise .9s ease both;
}
.hero .sub { color: var(--muted); font-size: clamp(1.05rem, 2.2vw, 1.25rem); max-width: 34ch; animation: rise .9s .12s ease both; }
.cta-row { display: flex; flex-wrap: wrap; gap: .8rem; margin-top: .4rem; animation: rise .9s .22s ease both; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; padding: 0 1.35rem;
  border-radius: .35rem; font-weight: 600; font-size: .95rem;
  transition: transform .2s ease, filter .2s ease, border-color .2s ease, color .2s ease;
}
.btn-primary { background: var(--accent); color: #0a0a0a; }
.btn-primary:hover { transform: translateY(-2px); filter: brightness(1.05); }
.btn-ghost {
  border: 1px solid color-mix(in oklab, var(--ink) 28%, transparent); color: var(--ink);
  background: color-mix(in oklab, var(--bg2) 55%, transparent); backdrop-filter: blur(8px);
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.hero-foot {
  display: flex; justify-content: space-between; align-items: end; gap: 1rem; color: var(--muted); font-size: .85rem;
  border-top: 1px solid color-mix(in oklab, var(--ink) 12%, transparent); padding-top: 1rem;
}
.scroll-hint { letter-spacing: .12em; text-transform: uppercase; font-size: .72rem; }
.block {
  padding: clamp(3.5rem, 10vw, 7rem) clamp(1.1rem, 3vw, 2rem);
  background: linear-gradient(180deg, transparent, color-mix(in oklab, var(--bg2) 70%, transparent));
  border-top: 1px solid color-mix(in oklab, var(--ink) 8%, transparent);
}
.block-inner { max-width: 72rem; margin: 0 auto; display: grid; gap: 1rem; }
.eyebrow { color: var(--accent2); font-size: .78rem; letter-spacing: .16em; text-transform: uppercase; }
.block h2 {
  font-family: var(--display); font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.05;
  letter-spacing: -.02em; max-width: 14ch;
}
.block .lead { color: var(--muted); max-width: 48ch; font-size: 1.08rem; }
.block ul { list-style: none; display: grid; gap: .65rem; margin-top: .75rem; max-width: 40rem; }
.block li {
  padding: .9rem 1rem; border-left: 2px solid var(--accent);
  background: color-mix(in oklab, var(--bg2) 80%, transparent);
}
.finale {
  padding: clamp(4rem, 12vw, 8rem) clamp(1.1rem, 3vw, 2rem); text-align: center;
  background: radial-gradient(60% 80% at 50% 100%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 60%), var(--bg);
}
.finale h2 { font-family: var(--display); font-size: clamp(2.2rem, 6vw, 4rem); margin-bottom: 1rem; }
.finale p { color: var(--muted); margin-bottom: 1.5rem; }
footer {
  padding: 1.5rem clamp(1.1rem, 3vw, 2rem) 2rem; color: var(--muted); font-size: .85rem;
  display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  border-top: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
}
.reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s ease, transform .7s ease; transition-delay: calc(var(--i, 0) * 60ms); }
.reveal.on { opacity: 1; transform: none; }
@keyframes rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@media (max-width: 720px) {
  .nav-links { display: none; }
  .hero-foot { flex-direction: column; align-items: start; }
}
</style>
</head>
<body>
  <header class="hero">
    <nav class="nav" aria-label="Principal">
      <a class="brand" href="#top">${esc(brief.brand)}</a>
      <div class="nav-links">
        ${brief.sections.map((section, i) => `<a href="#s${i}">${esc(section.title)}</a>`).join('')}
      </div>
    </nav>
    <div class="hero-main" id="top">
      ${brief.tagline ? `<p class="tagline">${esc(brief.tagline)}</p>` : ''}
      <h1>${esc(brief.headline)}</h1>
      <p class="sub">${esc(brief.subhead)}</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="#contact">${esc(brief.cta)}</a>
        <a class="btn btn-ghost" href="#s0">${esc(brief.ctaSecondary || 'Explorer')}</a>
      </div>
    </div>
    <div class="hero-foot">
      <span>${esc(theme.label)} · one-page</span>
      <span class="scroll-hint">Scroll</span>
    </div>
  </header>
  ${sectionHtml}
  <section class="finale reveal" id="contact">
    <h2>${esc(brief.cta)}</h2>
    <p>${esc(brief.subhead)}</p>
    <a class="btn btn-primary" href="mailto:hello@${mailHost}.com">${esc(brief.cta)}</a>
  </section>
  <footer>
    <span>${esc(brief.footer || `© ${new Date().getFullYear()} ${brief.brand}`)}</span>
    <span>Généré avec ATLAS</span>
  </footer>
<script>
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('on');
}, { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
</script>
</body>
</html>
`
}

export async function createWebsiteFile(opts: {
  topic: string
  outline?: string
  title?: string
  open?: boolean
}): Promise<{ path: string; title: string; theme: string; summary: string; brand: string }> {
  let outline = (opts.outline || '').trim()
  if (!outline || outline.length < 40) {
    const planned = await nemotron(SITE_BRIEF_SYSTEM, `Sujet / brief : ${opts.topic}`, 1100, 22000)
    outline = planned || ''
  }
  const brief = parseSiteBrief(outline || opts.topic, opts.title || opts.topic)
  const html = buildWebsiteHtml(brief)
  const fileTitle = (opts.title || brief.brand || 'Site-ATLAS')
    .replace(/[<>:"/\\|?*]/g, '-')
    .slice(0, 60)
  const saved = await saveUserBinaryFile({
    title: fileTitle,
    ext: 'html',
    data: Buffer.from(html, 'utf8'),
    folder: 'documents',
    open: opts.open !== false,
  })
  const theme = pickTheme(brief.brand, brief.theme)
  const summary = `Site « ${brief.brand} » (${theme.label}) enregistré dans Documents (${saved.title}). Ouvert dans le navigateur.`
  return { path: saved.path, title: saved.title, theme: theme.id, summary, brand: brief.brand }
}
