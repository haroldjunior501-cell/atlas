import { draftFromIntention, lockToZtc } from '@atlas/domain'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { intention?: string } | null
  const intention = lockToZtc(body?.intention?.trim() ?? '')
  return Response.json({ ...draftFromIntention(intention), source: 'local' })
}
