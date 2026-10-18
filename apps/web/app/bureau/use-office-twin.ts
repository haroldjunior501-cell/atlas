'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  generateLayout,
  liveProductOperations,
  sampleOrganization,
  SPACE_CATALOG,
  ZTC_NAME,
  type OfficeArchetype,
  type OfficeExtraSpace,
  type OfficeSpaceKind,
  type OfficeLayout,
  type OfficeOps,
  type OfficeOrgInput,
  type OpsAction,
  type OpsProductLive,
} from '@atlas/domain'

export type Live = { openTasks: number; pendingDecisions: number; activeAgents: number }

export type ActionRun = { state: 'running' | 'done' | 'failed'; note: string }

/** Envoie une consigne à un agent réel ; renvoie le statut lisible. */
export type Dispatch = (agentId: string, mission: string) => Promise<string>

export interface OfficeTwin {
  org: OfficeOrgInput | null
  name: string
  choice: OfficeArchetype | 'auto'
  detected: OfficeArchetype
  archetype: OfficeArchetype
  layout: OfficeLayout
  ops: OfficeOps
  runs: Record<string, ActionRun>
  /** Zones ajoutées par l’utilisateur ou ATLAS (supprimables). */
  extraRoomIds: Set<string>
  removedCount: number
  pickChoice: (next: string) => void
  run: (action: OpsAction) => Promise<string>
  runMany: (actions: OpsAction[]) => Promise<string[]>
  addSpace: (kind: OfficeSpaceKind, name?: string) => string
  removeSpace: (roomId: string) => boolean
  restoreSpaces: () => void
}

type Spaces = { added: OfficeExtraSpace[]; removed: string[] }

type ZtcOpsPayload = {
  live?: {
    products?: Array<{ title: string; priceFrom: number | null; comingSoon?: boolean; unit?: string }>
    devoid?: { ok?: boolean; model?: string }
  }
  ops?: {
    scan?: { status?: number; server?: string; missing?: string[] }
    speed?: Array<{ path: string; ttfbMs: number; ok: boolean }>
  }
}

/**
 * Jumeau numérique : layout 3D + opérations produit LIVE (FOSSBilling / DEVOID / missions).
 * Aucune facture ni KPI inventés.
 */
export function useOfficeTwin(
  org: OfficeOrgInput | null,
  live: Live | null,
  dispatch: Dispatch,
  realTasks?: Record<string, string> | null,
): OfficeTwin {
  const storageKey = `atlas-office-archetype:${org?.id ?? 'demo'}`
  const spacesKey = `atlas-office-spaces:${org?.id ?? 'demo'}`
  const [choice, setChoice] = useState<OfficeArchetype | 'auto'>('auto')
  const [spaces, setSpaces] = useState<Spaces>({ added: [], removed: [] })
  const [product, setProduct] = useState<OpsProductLive | null>(null)

  useEffect(() => {
    setChoice('hosting')
    window.localStorage.setItem(storageKey, 'hosting')
  }, [storageKey])

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(spacesKey) || 'null') as Spaces | null
      setSpaces(saved && Array.isArray(saved.added) && Array.isArray(saved.removed) ? saved : { added: [], removed: [] })
    } catch {
      setSpaces({ added: [], removed: [] })
    }
  }, [spacesKey])

  useEffect(() => {
    let cancel = false
    const pull = () => {
      void fetch('/api/atlas/ztc')
        .then((response) => response.json())
        .then((body: ZtcOpsPayload) => {
          if (cancel) return
          setProduct({
            products: body.live?.products ?? [],
            devoidOk: body.live?.devoid?.ok ?? null,
            devoidModel: body.live?.devoid?.model ?? null,
            speed: body.ops?.speed ?? [],
            scan: body.ops?.scan ?? null,
          })
        })
        .catch(() => {
          if (!cancel) setProduct((prev) => prev ?? { products: [], devoidOk: null, speed: [], scan: null })
        })
    }
    pull()
    const timer = window.setInterval(pull, 15000)
    return () => { cancel = true; window.clearInterval(timer) }
  }, [])

  const saveSpaces = useCallback((next: Spaces) => {
    setSpaces(next)
    window.localStorage.setItem(spacesKey, JSON.stringify(next))
  }, [spacesKey])

  const detected = useMemo<OfficeArchetype>(() => 'hosting', [])
  const archetype: OfficeArchetype = 'hosting'

  const layout = useMemo(() => {
    if (org) return generateLayout({ ...org, archetype, spaces }, 1)
    const sample = sampleOrganization(archetype)
    return generateLayout({ id: `demo-${archetype}`, ...sample, archetype, spaces }, 1)
  }, [org, archetype, spaces])

  const ops = useMemo(() => liveProductOperations(layout, {
    live: org ? live : null,
    product: {
      ...(product ?? {}),
      realTasks: realTasks ?? {},
    },
  }), [layout, live, org, product, realTasks])

  const name = ZTC_NAME
  const extraRoomIds = useMemo(
    () => new Set(spaces.added.map((space) => layout.rooms.find((room) => room.id.endsWith(`-room-x-${space.id}`))?.id).filter((id): id is string => Boolean(id))),
    [spaces, layout.rooms],
  )

  const addSpace = useCallback((kind: OfficeSpaceKind, label?: string) => {
    const base = label?.trim() || SPACE_CATALOG.find((option) => option.kind === kind)?.label || 'Nouvelle zone'
    const same = layout.rooms.filter((room) => room.name === base || room.name.startsWith(`${base} `)).length
    const name = same ? `${base} ${same + 1}` : base
    saveSpaces({ ...spaces, added: [...spaces.added, { id: `${Date.now().toString(36)}`, kind, name }] })
    return name
  }, [layout.rooms, saveSpaces, spaces])

  const removeSpace = useCallback((roomId: string) => {
    const room = layout.rooms.find((item) => item.id === roomId)
    if (!room || (room.departmentId && roomId.endsWith(`-room-${room.departmentId}`))) return false
    const extra = spaces.added.find((space) => roomId.endsWith(`-room-x-${space.id}`))
    saveSpaces(extra
      ? { ...spaces, added: spaces.added.filter((space) => space !== extra) }
      : { ...spaces, removed: [...new Set([...spaces.removed, roomId])] })
    return true
  }, [layout.rooms, saveSpaces, spaces])

  const restoreSpaces = useCallback(() => saveSpaces({ ...spaces, removed: [] }), [saveSpaces, spaces])

  const [runs, setRuns] = useState<Record<string, ActionRun>>({})
  useEffect(() => setRuns({}), [layout.id])

  const pickChoice = useCallback((_next: string) => {
    setChoice('hosting')
    window.localStorage.setItem(storageKey, 'hosting')
  }, [storageKey])

  const run = useCallback(async (action: OpsAction) => {
    if (!action.agentId) return 'aucun agent disponible'
    setRuns((prev) => ({ ...prev, [action.id]: { state: 'running', note: `Transmis à ${action.agentName}…` } }))
    try {
      const note = org ? await dispatch(action.agentId, action.mission) : 'organisation absente'
      const failed = /introuvable|non transmise|refus/i.test(note)
      setRuns((prev) => ({ ...prev, [action.id]: { state: failed ? 'failed' : 'done', note: `${action.agentName} · ${note}` } }))
      return note
    } catch {
      setRuns((prev) => ({ ...prev, [action.id]: { state: 'failed', note: 'non transmise' } }))
      return 'non transmise'
    }
  }, [dispatch, org])

  const runMany = useCallback(async (actions: OpsAction[]) => {
    const notes: string[] = []
    for (const action of actions) notes.push(`${action.title} : ${await run(action)}`)
    return notes
  }, [run])

  return { org, name, choice, detected, archetype, layout, ops, runs, extraRoomIds, removedCount: spaces.removed.length, pickChoice, run, runMany, addSpace, removeSpace, restoreSpaces }
}
