import * as SecureStore from 'expo-secure-store'
import { speechLang } from '@atlas/domain'

const KEY = 'atlas-pc-queue'

export function needsComputer(text: string) {
  const heard = text.replace(/\s+/g, ' ').trim()
  if (heard.length > 280) return false
  return /sur (le |l')?(pc|ordinateur)|ouvre (le |la |l'|les )?(fichier|dossier|document|chrome|edge|notepad|excel|word|spotify|appli)|lance .{0,24}(chrome|spotify|excel|word|notepad|l['’]appli)|ferme (chrome|l['’]appli|le fichier)|installe |g[eé]n[eè]re.{0,40}(?:vid[eé]o|film)|cr[eé]e.{0,30}(?:vid[eé]o|film)/i.test(heard)
}

export function offlinePcReply(order: string) {
  const brief = order.replace(/\s+/g, ' ').trim().slice(0, 140)
  if (speechLang(order).startsWith('en')) {
    return `The computer is off. I kept this for when it is on: ${brief}`
  }
  return `Le PC est éteint. J’ai gardé ça pour dès qu’il se rallume : ${brief}`
}

async function readQueue() {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    const parsed = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()).slice(-6) : []
  } catch {
    return []
  }
}

async function writeQueue(orders: string[]) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(orders.slice(-6)))
}

export async function rememberPcOrder(order: string) {
  const line = order.trim()
  if (!line) return
  const orders = await readQueue()
  if (orders.at(-1) === line) return
  orders.push(line)
  await writeQueue(orders)
}

export async function takePcOrders() {
  const orders = await readQueue()
  if (orders.length) await writeQueue([])
  return orders
}

export async function restorePcOrders(orders: string[]) {
  if (!orders.length) return
  const current = await readQueue()
  await writeQueue([...orders, ...current])
}
