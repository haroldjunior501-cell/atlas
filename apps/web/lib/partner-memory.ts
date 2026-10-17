import type { MemoryCategory, PersonalMemoryFact } from '@atlas/domain'
import { memoryCategoryOf } from '@atlas/domain'

const KEY = 'atlas-personal-memory'

function readAll(): PersonalMemoryFact[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersonalMemoryFact[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(facts: PersonalMemoryFact[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, JSON.stringify(facts.slice(0, 200)))
}

function idOf(): string {
  return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function listPersonalMemory(): PersonalMemoryFact[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function rememberFact(input: {
  value: string
  key?: string
  category?: MemoryCategory
}): PersonalMemoryFact {
  const value = input.value.trim()
  const key = (input.key || value.slice(0, 48)).trim()
  const category = input.category ?? memoryCategoryOf(value)
  const facts = readAll()
  const existing = facts.find((item) => item.key.toLowerCase() === key.toLowerCase())
  const next: PersonalMemoryFact = {
    id: existing?.id ?? idOf(),
    category,
    key,
    value,
    updatedAt: new Date().toISOString(),
  }
  const rest = facts.filter((item) => item.id !== next.id)
  writeAll([next, ...rest])
  return next
}

export function correctFact(keyOrId: string, value: string): PersonalMemoryFact | null {
  const facts = readAll()
  const target = facts.find(
    (item) => item.id === keyOrId || item.key.toLowerCase() === keyOrId.toLowerCase(),
  )
  if (!target) return rememberFact({ key: keyOrId, value })
  const next = { ...target, value: value.trim(), updatedAt: new Date().toISOString() }
  writeAll([next, ...facts.filter((item) => item.id !== target.id)])
  return next
}

export function forgetFact(query: string): PersonalMemoryFact[] {
  const needle = query.trim().toLowerCase()
  const facts = readAll()
  if (!needle || needle === '*' || needle === 'tout' || needle === 'everything') {
    writeAll([])
    return facts
  }
  const removed = facts.filter(
    (item) =>
      item.id === query
      || item.key.toLowerCase().includes(needle)
      || item.value.toLowerCase().includes(needle),
  )
  if (removed.length === 0) return []
  const keep = facts.filter((item) => !removed.some((row) => row.id === item.id))
  writeAll(keep)
  return removed
}

export function memoryBrief(limit = 12): string {
  const facts = listPersonalMemory().slice(0, limit)
  if (facts.length === 0) return ''
  return facts.map((item) => `- [${item.category}] ${item.key} : ${item.value}`).join('\n')
}

export function memorySpokenSummary(): string {
  const facts = listPersonalMemory()
  if (facts.length === 0) return 'Je n’ai encore rien retenu sur vous. Dites « retiens que… » pour me confier une info.'
  const top = facts.slice(0, 5).map((item) => item.value).join(' ; ')
  return `J’ai ${facts.length} souvenir${facts.length > 1 ? 's' : ''} : ${top}. Vous pouvez corriger ou demander l’oubli.`
}
