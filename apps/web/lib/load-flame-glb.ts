/** Fetch FLAME GLB in Range chunks — Cloudflare drops multi‑MB single responses. */
const CHUNK = 256 * 1024
const RETRIES = 4

async function fetchChunk(url: string, start: number, end: number): Promise<ArrayBuffer> {
  let lastError: unknown
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
        cache: 'force-cache',
      })
      if (!(res.status === 206 || res.status === 200)) {
        throw new Error(`flame chunk ${start}-${end} HTTP ${res.status}`)
      }
      const buf = await res.arrayBuffer()
      if (res.status === 200) return buf
      const expected = end - start + 1
      if (buf.byteLength < expected) {
        throw new Error(`short chunk ${buf.byteLength}/${expected}`)
      }
      return buf
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function loadFlameGlbBuffer(url: string): Promise<ArrayBuffer> {
  const head = await fetch(url, { method: 'HEAD', cache: 'force-cache' })
  const total = Number(head.headers.get('content-length') || 0)
  if (!head.ok || !total) {
    const full = await fetch(url, { cache: 'force-cache' })
    if (!full.ok) throw new Error(`flame mesh HTTP ${full.status}`)
    return full.arrayBuffer()
  }

  const parts: ArrayBuffer[] = new Array(Math.ceil(total / CHUNK))
  // Sequential is more reliable through the tunnel than parallel floods.
  for (let index = 0, start = 0; start < total; index += 1, start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, total - 1)
    const buf = await fetchChunk(url, start, end)
    if (buf.byteLength >= total) return buf
    parts[index] = buf
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    if (!part) throw new Error('missing flame chunk')
    out.set(new Uint8Array(part), offset)
    offset += part.byteLength
  }
  return out.buffer
}
