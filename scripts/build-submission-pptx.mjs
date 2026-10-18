/**
 * Build ATLAS submission PowerPoint (English).
 * Run: node scripts/build-submission-pptx.mjs
 */
import PptxGenJS from 'pptxgenjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'docs')
const outFile = join(outDir, 'ATLAS-Submission-Pitch.pptx')

const COLORS = {
  ink: '0B1220',
  panel: '111827',
  card: '1F2937',
  text: 'F8FAFC',
  muted: '94A3B8',
  accent: '38BDF8',
  accent2: 'F59E0B',
  line: '334155',
}

mkdirSync(outDir, { recursive: true })

const pptx = new PptxGenJS()
pptx.author = 'ATLAS'
pptx.title = 'ATLAS — AI Operating System for Organizations'
pptx.subject = 'Hackathon submission presentation'
pptx.company = 'ATLAS × ZTC Hosting'
pptx.layout = 'LAYOUT_WIDE'

function bg(slide, color = COLORS.ink) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color },
  })
}

function accentBar(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: COLORS.accent },
  })
}

function footer(slide, page, total = 10) {
  slide.addText('ATLAS  ·  Hackathon submission', {
    x: 0.6, y: 7.05, w: 8, h: 0.3,
    fontSize: 11, color: COLORS.muted, fontFace: 'Calibri',
  })
  slide.addText(`${page} / ${total}`, {
    x: 11.2, y: 7.05, w: 1.5, h: 0.3,
    fontSize: 11, color: COLORS.muted, fontFace: 'Calibri', align: 'right',
  })
}

function bullets(slide, lines, opts = {}) {
  slide.addText(
    lines.map((line) => ({ text: line, options: { breakLine: true, bullet: true } })),
    {
      x: opts.x ?? 0.7,
      y: opts.y ?? 1.9,
      w: opts.w ?? 12,
      h: opts.h ?? 4.6,
      fontSize: opts.fontSize ?? 20,
      color: COLORS.text,
      fontFace: 'Calibri',
      paraSpacingAfter: 12,
    },
  )
}

// 1 — Cover
{
  const s = pptx.addSlide()
  bg(s)
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.22, h: '100%',
    fill: { color: COLORS.accent },
  })
  s.addText('ATLAS', {
    x: 0.9, y: 1.7, w: 11, h: 0.6,
    fontSize: 18, color: COLORS.accent, bold: true, fontFace: 'Calibri',
    charSpacing: 6,
  })
  s.addText('The AI Operating System\nfor Organizations', {
    x: 0.9, y: 2.4, w: 11.5, h: 1.8,
    fontSize: 40, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  s.addText('Hackathon submission  ·  Powered by ZTC Hosting (ztchosting.com)', {
    x: 0.9, y: 4.5, w: 11, h: 0.4,
    fontSize: 16, color: COLORS.muted, fontFace: 'Calibri',
  })
  s.addText('Design  ·  Staff  ·  Orchestrate  ·  Deliver', {
    x: 0.9, y: 5.3, w: 11, h: 0.35,
    fontSize: 14, color: COLORS.accent2, fontFace: 'Calibri',
  })
  footer(s, 1)
}

// 2 — Problem
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('The problem', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 32, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  bullets(s, [
    'Organizations need more than a chatbot — they need roles, workflows, and accountability.',
    'Tools are siloed: support, hosting, billing, security, and growth rarely share one brain.',
    'Founders waste time redrawing org charts instead of shipping product.',
    'Customers expect 24/7 answers with real actions — not canned scripts.',
  ])
  footer(s, 2)
}

// 3 — Solution
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('The solution — ATLAS', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 32, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  bullets(s, [
    'ATLAS designs a full AI organization from an intention.',
    'It staffs departments with specialized AI employees (roles, skills, tools, KPIs).',
    'It orchestrates live work: missions, handoffs, approvals, and a 3D digital twin desk.',
    'Voice-first Studio: speak an order — Atlas opens views, assigns work, and reports back.',
    'Primary language: fluent English (mirrors the user when they clearly use another language).',
  ])
  footer(s, 3)
}

// 4 — Demo org ZTC
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('Demo organization — ZTC Hosting', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 30, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  s.addText('ztchosting.com', {
    x: 0.7, y: 1.15, w: 12, h: 0.35,
    fontSize: 16, color: COLORS.accent, fontFace: 'Calibri',
  })
  bullets(s, [
    'Real hosting business: domains, cPanel hosting, email, billing, AI-hosted products.',
    'Catalog and prices come from live FOSSBilling — never invented SLAs or prices.',
    'DEVOID chat on the public site escalates into ATLAS Support agents.',
    'ATLAS supervises the whole company; agents act through scoped DEVOID tools.',
  ], { y: 1.7 })
  footer(s, 4)
}

// 5 — Team
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('Key AI employees', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 32, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  const cards = [
    ['Nova', 'Support intake & ticket routing'],
    ['Devoid', 'Customer chat on ztchosting.com'],
    ['Vega', 'Hosting & cPanel / WHM'],
    ['Lyra', 'Domains & DNS'],
    ['Ledger', 'Billing & FOSSBilling'],
    ['Radar / Swift', 'Security scan & performance'],
    ['Funnel', 'Visitor flow & prospects'],
    ['Muse / Flare / Clip', 'Copy, ads, promo video'],
  ]
  cards.forEach((item, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 0.7 + col * 6.2
    const y = 1.35 + row * 1.15
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 5.8, h: 0.95,
      fill: { color: COLORS.card },
      rectRadius: 0.1,
    })
    s.addText(item[0], {
      x: x + 0.25, y: y + 0.15, w: 5.3, h: 0.35,
      fontSize: 16, color: COLORS.accent, bold: true, fontFace: 'Calibri',
    })
    s.addText(item[1], {
      x: x + 0.25, y: y + 0.48, w: 5.3, h: 0.35,
      fontSize: 14, color: COLORS.text, fontFace: 'Calibri',
    })
  })
  footer(s, 5)
}

// 6 — Architecture
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('How it works', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 32, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  const steps = [
    ['1', 'Intention', 'Describe the company'],
    ['2', 'Plan', 'Departments & roles'],
    ['3', 'Birth', 'AI employees online'],
    ['4', 'Orchestrate', 'Missions & tools'],
    ['5', 'Deliver', 'Proof, not fiction'],
  ]
  steps.forEach((step, i) => {
    const x = 0.6 + i * 2.5
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: 2.2, w: 2.25, h: 2.6,
      fill: { color: COLORS.card },
      rectRadius: 0.12,
    })
    s.addText(step[0], {
      x, y: 2.45, w: 2.25, h: 0.5,
      fontSize: 28, color: COLORS.accent, bold: true, fontFace: 'Calibri', align: 'center',
    })
    s.addText(step[1], {
      x: x + 0.1, y: 3.15, w: 2.05, h: 0.45,
      fontSize: 16, color: COLORS.text, bold: true, fontFace: 'Calibri', align: 'center',
    })
    s.addText(step[2], {
      x: x + 0.1, y: 3.7, w: 2.05, h: 0.7,
      fontSize: 13, color: COLORS.muted, fontFace: 'Calibri', align: 'center',
    })
  })
  footer(s, 6)
}

// 7 — Studio surfaces
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('Studio surfaces', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 32, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  bullets(s, [
    'Org chart — hierarchy, departments, hiring and moves.',
    'Employees — talk to any agent in their role and tone.',
    'Missions & workflows — assign, track, approve.',
    '3D Desk — live twin: rooms, presence, follow an agent.',
    'Integrations — Gmail, calendar, filesystem, browser, DEVOID tools.',
    'Voice assistant — one spoken command drives the whole tour.',
  ])
  footer(s, 7)
}

// 8 — Submission pitch demo
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('Live demo flow', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 32, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  bullets(s, [
    'Prompt: “Start the submission pitch now.”',
    'Atlas introduces itself, then opens Org chart → Employees → Missions.',
    'Opens the 3D desk, walks Support, Hosting, Domains, Security, Performance, Funnel.',
    'Spotlights Nova, Vega, Lyra, Ledger, Funnel.',
    'Ends by opening https://ztchosting.com/ — the live product.',
  ])
  footer(s, 8)
}

// 9 — Why it wins
{
  const s = pptx.addSlide()
  bg(s); accentBar(s)
  s.addText('Why ATLAS wins', {
    x: 0.7, y: 0.45, w: 12, h: 0.6,
    fontSize: 32, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  bullets(s, [
    'Not a single agent — a full company OS.',
    'Grounded in a real product (ZTC Hosting) with live catalog constraints.',
    'Voice + 3D + tools = memorable, demoable experience.',
    'Safety: rings R0–R4, no invented prices/SLAs, no offensive security.',
    'Mobile + Studio + Companion PC — one brain across devices.',
  ])
  footer(s, 9)
}

// 10 — Close
{
  const s = pptx.addSlide()
  bg(s)
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.22, h: '100%',
    fill: { color: COLORS.accent },
  })
  s.addText('ATLAS', {
    x: 0.9, y: 2.0, w: 11, h: 0.5,
    fontSize: 18, color: COLORS.accent, bold: true, fontFace: 'Calibri', charSpacing: 6,
  })
  s.addText('Build the company.\nLet the company work.', {
    x: 0.9, y: 2.7, w: 12, h: 1.5,
    fontSize: 36, color: COLORS.text, bold: true, fontFace: 'Calibri',
  })
  s.addText('ztchosting.com   ·   Studio voice pitch   ·   Thank you', {
    x: 0.9, y: 4.6, w: 11, h: 0.4,
    fontSize: 16, color: COLORS.muted, fontFace: 'Calibri',
  })
  footer(s, 10)
}

const buffer = await pptx.write({ outputType: 'nodebuffer' })
writeFileSync(outFile, buffer)
console.log(`Wrote ${outFile} (${buffer.byteLength} bytes)`)
