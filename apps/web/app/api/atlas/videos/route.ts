interface Clip {
  id: string
  title: string
  url: string
  thumb: string
}

function uniqueIds(html: string): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const match of html.matchAll(/(?:v=|v%3D|youtu\.be%2F|youtu\.be\/|\/shorts\/)([\w-]{11})/gi)) {
    const id = match[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids.slice(0, 6)
}

async function duckVideos(query: string): Promise<Clip[]> {
  const url = new URL('https://html.duckduckgo.com/html/')
  url.searchParams.set('q', `${query} site:youtube.com`)
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Atlas' },
    signal: AbortSignal.timeout(4000),
  })
  if (!response.ok) return []
  const html = await response.text()
  return uniqueIds(html).map((id) => ({
    id,
    title: query,
    url: `https://www.youtube.com/watch?v=${id}`,
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  }))
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { query?: string } | null
  const query = body?.query?.trim() ?? ''
  if (query.length < 2) return Response.json({ videos: [] })
  const videos = await duckVideos(query).catch(() => [] as Clip[])
  return Response.json({ videos })
}
