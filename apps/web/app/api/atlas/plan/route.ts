import { ORGANIZATION_PLAN_PROMPT, draftFromIntention, parseOrganizationPlan } from '@atlas/domain'
import { nemotron } from '@/lib/nemotron'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { intention?: string } | null
  const intention = body?.intention?.trim() ?? ''
  if (intention.length < 3) return Response.json({ error: 'vide' }, { status: 400 })

  let correction = ''
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await nemotron(
      ORGANIZATION_PLAN_PROMPT,
      correction ? `Demande : ${intention}\n${correction}` : `Demande : ${intention}`,
      1000,
      14000,
    )
    if (!raw) break
    const parsed = parseOrganizationPlan(raw, intention)
    if ('draft' in parsed) return Response.json({ ...parsed.draft, source: 'nemotron' })
    correction = `Le JSON précédent est invalide : ${parsed.error}. Renvoie uniquement un JSON corrigé.`
  }
  return Response.json({ ...draftFromIntention(intention), source: 'local' })
}
