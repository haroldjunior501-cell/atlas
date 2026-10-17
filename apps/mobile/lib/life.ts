import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'

const KEY = 'atlas-life-tasks'

export type LifeTask = {
  id: string
  title: string
  due?: string
  done: boolean
  createdAt: string
}

const memory = new Map<string, string>()

async function readRaw() {
  if (Platform.OS === 'web') return memory.get(KEY) ?? '[]'
  return (await SecureStore.getItemAsync(KEY)) || '[]'
}

async function writeRaw(value: string) {
  if (Platform.OS === 'web') {
    memory.set(KEY, value)
    return
  }
  await SecureStore.setItemAsync(KEY, value)
}

export async function listTasks(): Promise<LifeTask[]> {
  try {
    const parsed = JSON.parse(await readRaw()) as LifeTask[]
    return Array.isArray(parsed) ? parsed.slice(-40) : []
  } catch {
    return []
  }
}

export async function saveTasks(tasks: LifeTask[]) {
  await writeRaw(JSON.stringify(tasks.slice(-40)))
}

export async function upsertTask(task: LifeTask) {
  const current = await listTasks()
  const index = current.findIndex((item) => item.id === task.id)
  if (index >= 0) current[index] = task
  else current.push(task)
  await saveTasks(current)
  return current
}

export async function toggleTask(id: string) {
  const current = await listTasks()
  const next = current.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
  await saveTasks(next)
  return next
}

export function todayPriorities(tasks: LifeTask[]) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const open = tasks.filter((item) => !item.done)
  const dueToday = open.filter((item) => {
    if (!item.due) return false
    const due = new Date(item.due).getTime()
    return due >= start.getTime() && due < end.getTime()
  })
  return { open, dueToday, overdue: open.filter((item) => item.due && new Date(item.due).getTime() < start.getTime()) }
}

export function newTask(title: string, due?: string): LifeTask {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.replace(/\s+/g, ' ').trim().slice(0, 180),
    due,
    done: false,
    createdAt: new Date().toISOString(),
  }
}

export async function ensureNoticePermission() {
  if (Platform.OS === 'web') return false
  const current = await Notifications.getPermissionsAsync()
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted
  if (granted) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
  }
  return granted
}

export async function remindAt(title: string, when: Date) {
  if (when.getTime() <= Date.now() + 4000) return
  const ok = await ensureNoticePermission()
  if (!ok) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Atlas',
      body: title,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  })
}

function parseWhen(text: string): Date | undefined {
  const now = new Date()
  const lower = text.toLowerCase()
  const hour = lower.match(/(?:à|a|at)\s*(\d{1,2})(?:[h:](\d{2}))?/)
  const stamp = new Date(now)
  if (/demain|tomorrow/.test(lower)) stamp.setDate(stamp.getDate() + 1)
  if (/après[- ]demain|after tomorrow/.test(lower)) stamp.setDate(stamp.getDate() + 2)
  if (hour) {
    stamp.setHours(Number(hour[1]), Number(hour[2] || '0'), 0, 0)
    if (stamp.getTime() < now.getTime() && !/demain|tomorrow|après/.test(lower)) stamp.setDate(stamp.getDate() + 1)
    return stamp
  }
  if (/demain|tomorrow|après[- ]demain/.test(lower)) {
    stamp.setHours(9, 0, 0, 0)
    return stamp
  }
  return undefined
}

function taskTitleFrom(text: string) {
  return text
    .replace(/^(?:atlas[, ]*)?(?:rappelle[- ]moi|crée|ajoute|note|remember|remind me)\s+(?:de |d['’]|à |a |to )? /i, '')
    .replace(/\b(?:demain|aujourd['’]hui|après[- ]demain|à \d{1,2}(?:[h:]\d{2})?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function absorbLifeOrder(text: string): Promise<{ tasks: LifeTask[]; spoken?: string } | null> {
  const heard = text.toLowerCase()
  const creating = /rappelle[- ]moi|crée (?:une |la )?t[aâ]che|ajoute (?:à |a )?(?:ma |la )?liste|remind me|add a task|nouvelle t[aâ]che/.test(heard)
  if (creating) {
    const when = parseWhen(text)
    const title = taskTitleFrom(text) || text
    const task = newTask(title, when?.toISOString())
    const tasks = await upsertTask(task)
    if (when) await remindAt(task.title, when)
    const spoken = when
      ? `C’est noté. Je te rappelle « ${task.title} » ${when.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.`
      : `Tâche ajoutée : ${task.title}.`
    return { tasks, spoken }
  }
  if (/priorit[eé]s? du jour|ma journ[eé]e|mon agenda|mes t[aâ]ches|today'?s priorities/.test(heard)) {
    const tasks = await listTasks()
    const { open, dueToday, overdue } = todayPriorities(tasks)
    const parts = [
      overdue.length ? `${overdue.length} en retard` : '',
      dueToday.length ? `${dueToday.length} pour aujourd’hui` : '',
      `${open.length} encore ouvertes`,
    ].filter(Boolean)
    return { tasks, spoken: `Voici ta journée : ${parts.join(', ') || 'rien de prévu'}.` }
  }
  if (/coche|termin[eé]e?|done|faite/.test(heard) && /t[aâ]che|rappel|liste/.test(heard)) {
    const tasks = await listTasks()
    const open = tasks.find((item) => !item.done)
    if (!open) return { tasks, spoken: 'Toutes les tâches sont déjà cochées.' }
    const next = await toggleTask(open.id)
    return { tasks: next, spoken: `Je coche « ${open.title} ».` }
  }
  return null
}
