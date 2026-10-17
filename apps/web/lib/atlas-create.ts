/**
 * Création de livrables — présentations .pptx réelles (PptxGenJS).
 * https://github.com/gitbrent/PptxGenJS
 */
import PptxGenJS from 'pptxgenjs'
import { saveUserBinaryFile } from '@/lib/atlas-desktop'

export type DeckSlide = {
  title: string
  bullets: string[]
  notes?: string
}

export type PresentationDeck = {
  title: string
  slides: DeckSlide[]
}

/** Extrait un deck depuis JSON LLM ou plan markdown. */
export function parsePresentationDeck(raw: string, fallbackTitle: string): PresentationDeck {
  const text = raw.trim()
  const jsonHit = text.match(/\{[\s\S]*"slides"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
  if (jsonHit) {
    try {
      const body = JSON.parse(jsonHit[0]) as { title?: string; slides?: Array<{ title?: string; bullets?: string[]; body?: string | string[] }> }
      const slides = (body.slides || [])
        .map((slide) => {
          const bullets = Array.isArray(slide.bullets)
            ? slide.bullets.map(String)
            : Array.isArray(slide.body)
              ? slide.body.map(String)
              : typeof slide.body === 'string'
                ? slide.body.split(/\n+/).map((line) => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
                : []
          return { title: String(slide.title || 'Slide').trim(), bullets: bullets.slice(0, 8) }
        })
        .filter((slide) => slide.title)
      if (slides.length) {
        return { title: String(body.title || fallbackTitle).trim() || fallbackTitle, slides }
      }
    } catch { /* fallback markdown */ }
  }

  const sections = text
    .split(/\n(?=#{1,3}\s|Slide\s*\d+\s*[:.—-]|\d+\.\s+)/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 8)

  const slides: DeckSlide[] = []
  for (const block of sections.slice(0, 14)) {
    const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) continue
    const title = lines[0]
      .replace(/^#{1,3}\s*/, '')
      .replace(/^Slide\s*\d+\s*[:.—-]?\s*/i, '')
      .replace(/^\d+\.\s*/, '')
      .slice(0, 80)
    const bullets = lines.slice(1)
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter((line) => line.length > 1)
      .slice(0, 8)
    if (title) slides.push({ title, bullets: bullets.length ? bullets : ['Point clé à développer'] })
  }

  if (!slides.length) {
    const chunks = text.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean).slice(0, 8)
    for (const chunk of chunks) {
      const lines = chunk.split(/\n/).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
      slides.push({
        title: (lines[0] || fallbackTitle).slice(0, 80),
        bullets: (lines.slice(1).length ? lines.slice(1) : lines).slice(0, 6),
      })
    }
  }

  if (!slides.length) {
    slides.push(
      { title: fallbackTitle, bullets: ['Contexte', 'Objectifs', 'Prochaines étapes'] },
      { title: 'Contenu', bullets: text.slice(0, 280).split(/[.!?]\s+/).filter(Boolean).slice(0, 5) },
    )
  }

  return { title: fallbackTitle.slice(0, 80) || 'Présentation ATLAS', slides }
}

export async function buildPptxBuffer(deck: PresentationDeck): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.author = 'ATLAS'
  pptx.title = deck.title
  pptx.subject = 'Généré par ATLAS'
  pptx.layout = 'LAYOUT_WIDE'

  const cover = pptx.addSlide()
  cover.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: '0F172A' },
  })
  cover.addText('ATLAS', {
    x: 0.8, y: 1.4, w: 11, h: 0.5,
    fontSize: 14, color: '94A3B8', bold: true, fontFace: 'Arial',
  })
  cover.addText(deck.title, {
    x: 0.8, y: 2.1, w: 11, h: 1.6,
    fontSize: 36, color: 'F8FAFC', bold: true, fontFace: 'Arial',
  })
  cover.addText(`${deck.slides.length} diapositives · généré automatiquement`, {
    x: 0.8, y: 4.2, w: 11, h: 0.4,
    fontSize: 14, color: '64748B', fontFace: 'Arial',
  })

  for (const item of deck.slides) {
    const slide = pptx.addSlide()
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.15,
      fill: { color: 'E11D48' },
    })
    slide.addText(item.title, {
      x: 0.6, y: 0.45, w: 12, h: 0.9,
      fontSize: 28, color: '0F172A', bold: true, fontFace: 'Arial',
    })
    const bullets = item.bullets.length ? item.bullets : ['À compléter']
    slide.addText(
      bullets.map((line) => ({ text: line, options: { breakLine: true, bullet: true } })),
      {
        x: 0.8, y: 1.6, w: 11.5, h: 4.8,
        fontSize: 18, color: '334155', fontFace: 'Arial', paraSpacingAfter: 10,
      },
    )
  }

  const data = await pptx.write({ outputType: 'nodebuffer' })
  return Buffer.from(data as ArrayBuffer)
}

export async function createPresentationFile(opts: {
  topic: string
  outline: string
  title?: string
  open?: boolean
}): Promise<{ path: string; title: string; slides: number; summary: string }> {
  const deck = parsePresentationDeck(opts.outline, opts.title || opts.topic)
  const buffer = await buildPptxBuffer(deck)
  const fileTitle = deck.title.replace(/[<>:"/\\|?*]/g, '-').slice(0, 60) || 'Presentation-ATLAS'
  const saved = await saveUserBinaryFile({
    title: fileTitle,
    ext: 'pptx',
    data: buffer,
    folder: 'documents',
    open: opts.open !== false,
  })
  const summary = `Présentation « ${deck.title} » : ${deck.slides.length} diapositives enregistrées dans Documents (${saved.title}).`
  return { path: saved.path, title: saved.title, slides: deck.slides.length, summary }
}
