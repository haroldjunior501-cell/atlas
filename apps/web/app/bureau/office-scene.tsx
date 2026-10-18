'use client'

/**
 * Jumeau numérique 3D de l’organisation.
 * L’environnement (zones, équipements, véhicules) vient de generateLayout :
 * il change avec le métier de l’entreprise, pas seulement avec les noms.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { OfficeAgentPlacement, OfficeLayout, OfficeRoom } from '@atlas/domain'
import { handoverErrand, pickErrand, route, type Errand, type Point } from './agent-life'
import { createKit, type Person } from './office-models'
import styles from './office-scene.module.css'

export type SceneView = { kind: 'overview' | 'top'; nonce: number }

const FLOOR: Record<string, string> = {
  carpet: '#eef0f3',
  wood: '#eadfcd',
  concrete: '#e7e7e4',
  tile: '#f8f8f6',
  asphalt: '#cfd2d7',
}

const STATUS: Record<string, string> = {
  working: '#22c55e',
  online: '#38bdf8',
  idle: '#f59e0b',
  offline: '#9ca3af',
}

export type Handoff = { key: string; from: string; to: string; what: string }
export type LifeEntry = { agentId: string; name: string; text: string }

type Life = {
  agent: OfficeAgentPlacement
  person: Person
  home: THREE.Vector3
  sits: boolean
  wander: boolean
  mode: 'home' | 'go' | 'there' | 'back'
  path: THREE.Vector3[]
  leg: number
  t: number
  timer: number
  errand: Errand | null
  queue: Errand[]
  stand: number
  doc: THREE.Mesh
  attention: THREE.Vector3 | null
}

const SIT_LIFT = 0.26
const SPEED = 1.5

type Mover = { obj: THREE.Object3D; x0: number; x1: number; dir: 1 | -1; speed: number; wait: number }

export function OfficeScene({
  layout,
  tasks,
  selectedAgentId,
  selectedRoomId,
  selectedAssetId,
  showLabels = false,
  view,
  handoffs,
  onSelectAgent,
  onSelectRoom,
  onSelectAsset,
  onActivity,
}: {
  layout: OfficeLayout
  tasks?: Record<string, string>
  /** Livrables réels qui passent d’un agent à l’autre pendant une mission. */
  handoffs?: Handoff[]
  onActivity?: (entry: LifeEntry) => void
  selectedAgentId?: string | null
  selectedRoomId?: string | null
  selectedAssetId?: string | null
  showLabels?: boolean
  view?: SceneView
  onSelectAgent?: (agentId: string) => void
  onSelectRoom?: (roomId: string, departmentId: string | null) => void
  onSelectAsset?: (assetId: string, roomId: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const handlers = useRef({ onSelectAgent, onSelectRoom, onSelectAsset, onActivity })
  handlers.current = { onSelectAgent, onSelectRoom, onSelectAsset, onActivity }
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const seenHandoffs = useRef<Set<string> | null>(null)

  const api = useRef<{
    highlightRoom: (id: string | null) => void
    focusAgent: (id: string | null) => void
    focusAsset: (id: string | null) => void
    setLabels: (on: boolean) => void
    setView: (kind: SceneView['kind']) => void
    setLive: (statuses: Record<string, string>, tasks: Record<string, string> | undefined) => void
    handoff: (items: Handoff[]) => void
  } | null>(null)

  const [hover, setHover] = useState<{ title: string; sub?: string; x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)

  const layoutKey = [
    layout.id,
    layout.rooms.map((r) => `${r.id}:${r.kind}:${r.x},${r.z}`).join('|'),
    layout.agents.map((a) => `${a.id}:${a.x},${a.z}`).join('|'),
  ].join('#')
  const statusKey = layout.agents.map((a) => `${a.id}:${a.status}`).join('|')
  const taskKey = tasks ? Object.entries(tasks).map(([id, t]) => `${id}:${t}`).join('|') : ''

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    setReady(false)
    const kit = createKit()
    const theme = layout.theme
    const accent = theme.accent

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f3f4f6')
    const span = Math.max(layout.width, layout.depth)
    scene.fog = new THREE.Fog('#f3f4f6', span * 1.6, span * 3.4)

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.touchAction = 'none'
    host.innerHTML = ''
    host.appendChild(renderer.domElement)

    const cx = layout.width / 2
    const cz = layout.depth / 2

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dde4, 1.15))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(cx - span * 0.35, span * 0.9, cz - span * 0.6)
    sun.target.position.set(cx, 0, cz)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.02
    const half = span * 0.7
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: span * 3 })
    scene.add(sun, sun.target)

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, span * 6)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.screenSpacePanning = false
    controls.minDistance = 4
    controls.maxDistance = span * 2.4
    controls.maxPolarAngle = 1.3

    const fitDistance = () => {
      const vfov = THREE.MathUtils.degToRad(camera.fov)
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
      return Math.max(layout.width / (2 * Math.tan(hfov / 2)), layout.depth / (2 * Math.tan(vfov / 2))) * 0.92
    }
    const overview = () => {
      const r = fitDistance()
      camera.position.set(cx + r * 0.3, r * 0.76, cz - r * 0.58)
      controls.target.set(cx, 0, cz - span * 0.02)
      controls.update()
    }
    const topView = () => {
      camera.position.set(cx, fitDistance() * 1.05, cz + 0.01)
      controls.target.set(cx, 0, cz)
      controls.update()
    }

    const root = new THREE.Group()
    scene.add(root)
    const pickables: THREE.Object3D[] = []

    // Sol extérieur et dalle du bâtiment
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 6, span * 6), kit.mat(theme.ground, { rough: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(cx, -0.01, cz)
    ground.receiveShadow = true
    root.add(ground)

    const b = layout.building
    const slab = kit.box(b.w, 0.06, b.d, kit.mat(theme.corridor, { rough: 0.95 }), b.x + b.w / 2, 0.03, b.z + b.d / 2, false)
    root.add(slab)

    // Enveloppe du bâtiment (couleur de marque) avec entrée
    const wallMat = kit.mat(accent, { rough: 0.6 })
    const wallH = 1.5
    const t = 0.24
    const gap = 3.2
    const ex = Math.min(Math.max(layout.building.entranceX, b.x + gap), b.x + b.w - gap)
    root.add(
      kit.box(ex - gap / 2 - b.x, wallH, t, wallMat, (b.x + ex - gap / 2) / 2, wallH / 2, b.z),
      kit.box(b.x + b.w - (ex + gap / 2), wallH, t, wallMat, (ex + gap / 2 + b.x + b.w) / 2, wallH / 2, b.z),
      kit.box(b.w + t, wallH * 1.6, t, kit.mat('#f8fafc'), b.x + b.w / 2, (wallH * 1.6) / 2, b.z + b.d),
      kit.box(t, wallH * 1.6, b.d, kit.mat('#f8fafc'), b.x, (wallH * 1.6) / 2, b.z + b.d / 2),
      kit.box(t, wallH * 1.6, b.d, kit.mat('#f8fafc'), b.x + b.w, (wallH * 1.6) / 2, b.z + b.d / 2),
      kit.box(b.w + t, 0.12, t + 0.04, wallMat, b.x + b.w / 2, wallH * 1.6, b.z + b.d),
    )
    const entrance = kit.box(gap, 0.02, 1.4, kit.mat('#d1d5db', { rough: 1 }), ex, 0.07, b.z - 0.4, false)
    root.add(entrance)

    // Circulations : pointillés au sol
    const dash = kit.mat('#d4d6da', { rough: 1 })
    for (const walk of layout.walkways) {
      for (let x = walk.x0 + 0.4; x < walk.x1; x += 1.3) root.add(kit.box(0.6, 0.01, 0.08, dash, x, 0.065, walk.z, false))
    }

    // Zones
    const roomFx = new Map<string, { glow: THREE.Mesh; room: OfficeRoom }>()
    for (const room of layout.rooms) {
      const g = new THREE.Group()
      const base = room.outdoor ? 0.005 : 0.065
      const floorColor = room.floor === 'carpet' && room.departmentId
        ? new THREE.Color(room.color).lerp(new THREE.Color('#ffffff'), 0.9).getStyle()
        : FLOOR[room.floor] ?? '#f5f5f3'
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), kit.mat(floorColor, { rough: 0.9 }))
      floor.rotation.x = -Math.PI / 2
      floor.position.set(room.x + room.w / 2, base, room.z + room.d / 2)
      floor.receiveShadow = true
      floor.userData = { kind: 'room', roomId: room.id, departmentId: room.departmentId }
      g.add(floor)
      pickables.push(floor)

      const lineColor = room.outdoor ? '#ffffff' : room.departmentId ? room.color : accent
      const line = kit.mat(lineColor, { rough: 0.9 })
      const lw = 0.08
      g.add(
        kit.box(room.w, 0.012, lw, line, room.x + room.w / 2, base + 0.01, room.z + lw / 2, false),
        kit.box(room.w, 0.012, lw, line, room.x + room.w / 2, base + 0.01, room.z + room.d - lw / 2, false),
        kit.box(lw, 0.012, room.d, line, room.x + lw / 2, base + 0.01, room.z + room.d / 2, false),
        kit.box(lw, 0.012, room.d, line, room.x + room.w - lw / 2, base + 0.01, room.z + room.d / 2, false),
      )

      if (!room.outdoor && room.wallHeight > 0) {
        const h = room.wallHeight
        const wm = room.glass
          ? kit.mat('#dbeafe', { rough: 0.1, metal: 0.1, opacity: 0.35 })
          : kit.mat('#ffffff', { rough: 0.85 })
        const trim = kit.mat(room.departmentId ? room.color : accent, { rough: 0.5 })
        const door = Math.min(1.8, room.w * 0.4)
        const doorX = room.x + room.w / 2
        const seg = (x0: number, x1: number, z: number) => {
          if (x1 - x0 < 0.05) return
          g.add(kit.box(x1 - x0, h, 0.1, wm, (x0 + x1) / 2, base + h / 2, z))
          g.add(kit.box(x1 - x0, 0.05, 0.12, trim, (x0 + x1) / 2, base + h, z, false))
        }
        seg(room.x, doorX - door / 2, room.z)
        seg(doorX + door / 2, room.x + room.w, room.z)
        seg(room.x, room.x + room.w, room.z + room.d)
        g.add(kit.box(0.1, h, room.d, wm, room.x, base + h / 2, room.z + room.d / 2))
        g.add(kit.box(0.1, h, room.d, wm, room.x + room.w, base + h / 2, room.z + room.d / 2))
        g.add(kit.box(0.12, 0.05, room.d, trim, room.x, base + h, room.z + room.d / 2, false))
        g.add(kit.box(0.12, 0.05, room.d, trim, room.x + room.w, base + h, room.z + room.d / 2, false))
      }

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(room.w - 0.1, room.d - 0.1),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false }),
      )
      glow.rotation.x = -Math.PI / 2
      glow.position.set(room.x + room.w / 2, base + 0.02, room.z + room.d / 2)
      g.add(glow)
      roomFx.set(room.id, { glow, room })
      root.add(g)
    }

    for (const label of layout.labels) {
      if (!label.floorPrint) continue
      const room = layout.rooms.find((r) => r.id === label.roomId)
      if (room && !room.outdoor && (label.size ?? 'zone') === 'zone') {
        const board = kit.sign(room.name, label.color)
        board.position.set(room.x + room.w / 2, 0.065 + Math.max(room.wallHeight, 0.6) + 0.5, room.z - 0.07)
        root.add(board)
        continue
      }
      const text = kit.floorText(label.text, label.color, label.size ?? 'zone')
      text.position.set(label.x, (room?.outdoor ? 0.01 : 0.07) + 0.002, label.z)
      root.add(text)
    }

    for (const desk of layout.desks) root.add(kit.desk(desk))

    const movers: Mover[] = []
    const spinners: THREE.Object3D[] = []
    const assets = new Map<string, THREE.Object3D>()
    for (const prop of layout.props) {
      const obj = kit.prop(prop, accent)
      if (!obj) continue
      const room = layout.rooms.find((r) => r.id === prop.roomId)
      obj.position.y += room && !room.outdoor ? 0.065 : 0
      if (prop.assetId) {
        obj.userData = { kind: 'asset', assetId: prop.assetId, roomId: prop.roomId }
        pickables.push(obj)
        assets.set(prop.assetId, obj)
      }
      if ((prop.motion === 'drive' || prop.motion === 'patrol') && prop.path) {
        movers.push({ obj, x0: prop.path.x0, x1: prop.path.x1, dir: 1, speed: prop.motion === 'drive' ? 2.2 : 1.3, wait: 0 })
      }
      if (prop.motion === 'spin') obj.traverse((child) => { if (child.userData.spinner) spinners.push(child) })
      root.add(obj)
    }

    // Agents
    const people = new Map<string, Person>()
    const lives = new Map<string, Life>()
    const tags = new Map<string, THREE.Sprite>()
    layout.agents.forEach((agent, index) => {
      const person = kit.person(agent.color, agent.pose, index + agent.name.length)
      const room = layout.rooms.find((r) => r.id === agent.roomId)
      const y = room && !room.outdoor ? 0.065 : 0
      person.root.position.set(agent.x, y, agent.z)
      person.root.rotation.y = agent.rotation
      person.status.material = kit.mat(STATUS[agent.status] ?? '#38bdf8', { emissive: STATUS[agent.status] ?? '#38bdf8', intensity: 1.2 })
      person.root.userData = { kind: 'agent', agentId: agent.id }
      person.root.traverse((child) => { child.userData.agentId = agent.id })
      pickables.push(person.root)
      root.add(person.root)
      people.set(agent.id, person)

      const doc = kit.box(0.2, 0.26, 0.04, '#f8fafc', 0, -0.52, 0.12, false)
      doc.visible = false
      person.armR.add(doc)
      lives.set(agent.id, {
        agent, person, doc,
        home: new THREE.Vector3(agent.x, y, agent.z),
        sits: agent.pose === 'sit',
        wander: agent.wander,
        mode: 'home', path: [], leg: 0, t: 0,
        timer: (agent.wander ? 2 : 4) + ((index * 7919) % 100) / 100 * (agent.wander ? 8 : 22),
        errand: null, queue: [],
        stand: agent.pose === 'sit' ? 0 : 1,
        attention: null,
      })

      const sprite = kit.tag(agent.name.split(' ')[0] ?? agent.name, tasksRef.current?.[agent.id], agent.color)
      sprite.position.set(0, (agent.pose === 'sit' ? 0.46 : 0.72) + 1.65, 0)
      sprite.visible = false
      person.body.add(sprite)
      tags.set(agent.id, sprite)
    })

    // Marqueur de sélection
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2
    ring.visible = false
    root.add(ring)
    let ringFollow: THREE.Object3D | null = null
    let ringScale = 1

    let labelsOn = false
    let selectedAgent: string | null = null
    const shown = {
      status: new Map(layout.agents.map((a) => [a.id, a.status as string])),
      task: new Map(layout.agents.map((a) => [a.id, tasksRef.current?.[a.id]])),
    }
    const focus = { target: null as THREE.Vector3 | null, distance: 0 }
    let liveTasks = tasksRef.current
    const agentById = new Map(layout.agents.map((a) => [a.id, a]))

    function labelOf(id: string) {
      const life = lives.get(id)
      if (life?.errand && life.mode !== 'home') {
        return life.mode === 'go' ? life.errand.going : life.mode === 'there' ? life.errand.there : 'Retourne à son poste'
      }
      return liveTasks?.[id]
    }
    function showTag(id: string) {
      const sprite = tags.get(id)
      if (sprite) sprite.visible = labelsOn || id === selectedAgent || lives.get(id)?.mode !== 'home'
    }
    function retag(id: string) {
      const agent = agentById.get(id)
      const old = tags.get(id)
      const text = labelOf(id)
      if (agent && old && shown.task.get(id) !== text) {
        const next = kit.tag(agent.name.split(' ')[0] ?? agent.name, text, agent.color)
        next.position.copy(old.position)
        old.parent?.add(next)
        old.removeFromParent()
        old.material.map?.dispose()
        old.material.dispose()
        tags.set(id, next)
        shown.task.set(id, text)
      }
      showTag(id)
    }
    const building = layout.building
    const floorAt = (p: Point) => (p.x > building.x && p.x < building.x + building.w && p.z > building.z && p.z < building.z + building.d ? 0.065 : 0)
    const toPath = (points: Point[]) => points.map((p) => new THREE.Vector3(p.x, floorAt(p), p.z))
    function begin(life: Life, errand: Errand) {
      const home = { x: life.home.x, z: life.home.z }
      const points = route(layout, home, life.agent.roomId, errand.to, errand.roomId)
      if (life.sits) {
        const r = life.agent.rotation
        points.splice(1, 0, { x: home.x - Math.sin(r) * 0.6, z: home.z - Math.cos(r) * 0.6 })
      }
      life.path = toPath(points)
      life.path[0] = life.home.clone()
      life.leg = 0
      life.t = 0
      life.errand = errand
      life.mode = 'go'
      life.doc.visible = errand.carry
      retag(life.agent.id)
      handlers.current.onActivity?.({ agentId: life.agent.id, name: life.agent.name, text: errand.going })
    }
    function arrive(life: Life) {
      const errand = life.errand!
      life.mode = 'there'
      life.timer = errand.stay
      life.person.root.rotation.y = Math.atan2(errand.face.x - life.person.root.position.x, errand.face.z - life.person.root.position.z)
      const host = errand.withId ? lives.get(errand.withId) : null
      if (host) host.attention = life.person.root.position
      retag(life.agent.id)
      handlers.current.onActivity?.({ agentId: life.agent.id, name: life.agent.name, text: errand.there })
    }
    function leave(life: Life) {
      const errand = life.errand!
      const host = errand.withId ? lives.get(errand.withId) : null
      if (host?.attention === life.person.root.position) host.attention = null
      if (errand.kind === 'handover') life.doc.visible = false
      const at = { x: life.person.root.position.x, z: life.person.root.position.z }
      const points = route(layout, at, errand.roomId, { x: life.home.x, z: life.home.z }, life.agent.roomId)
      if (life.sits) {
        const r = life.agent.rotation
        points.splice(points.length - 1, 0, { x: life.home.x - Math.sin(r) * 0.6, z: life.home.z - Math.cos(r) * 0.6 })
      }
      life.path = toPath(points)
      life.path[life.path.length - 1] = life.home.clone()
      life.leg = 0
      life.t = 0
      life.mode = 'back'
      retag(life.agent.id)
    }
    function settle(life: Life) {
      life.mode = 'home'
      life.errand = null
      life.doc.visible = false
      life.person.root.position.copy(life.home)
      life.person.root.rotation.y = life.agent.rotation
      life.timer = nextDelay(life)
      retag(life.agent.id)
    }
    function nextDelay(life: Life) {
      const status = shown.status.get(life.agent.id)
      if (status === 'working') return 40 + Math.random() * 50
      return life.wander ? 6 + Math.random() * 12 : 16 + Math.random() * 30
    }

    api.current = {
      highlightRoom(id) {
        for (const [roomId, fx] of roomFx) {
          ;(fx.glow.material as THREE.MeshBasicMaterial).opacity = roomId === id ? 0.14 : 0
        }
        if (id) {
          const fx = roomFx.get(id)
          if (fx) {
            focus.target = new THREE.Vector3(fx.room.x + fx.room.w / 2, 0, fx.room.z + fx.room.d / 2)
            focus.distance = Math.max(10, Math.max(fx.room.w, fx.room.d) * 1.5)
          }
        }
      },
      focusAgent(id) {
        selectedAgent = id
        for (const agentId of tags.keys()) showTag(agentId)
        const person = id ? people.get(id) : null
        ringFollow = person?.root ?? null
        ringScale = 1
        ring.visible = Boolean(person)
        if (person) {
          focus.target = person.root.position.clone()
          focus.distance = 9
        }
      },
      focusAsset(id) {
        const obj = id ? assets.get(id) : null
        if (!obj) {
          if (!selectedAgent) ring.visible = false
          return
        }
        ringFollow = obj
        ringScale = 3.2
        ring.visible = true
        focus.target = obj.position.clone()
        focus.distance = 12
      },
      setLabels(on) {
        labelsOn = on
        for (const agentId of tags.keys()) showTag(agentId)
      },
      setLive(statuses, nextTasks) {
        liveTasks = nextTasks
        for (const agent of layout.agents) {
          const person = people.get(agent.id)
          if (!person) continue
          const status = statuses[agent.id] ?? agent.status
          if (shown.status.get(agent.id) !== status) {
            const color = STATUS[status] ?? '#38bdf8'
            person.status.material = kit.mat(color, { emissive: color, intensity: 1.2 })
            shown.status.set(agent.id, status)
          }
          retag(agent.id)
        }
      },
      handoff(items) {
        if (!seenHandoffs.current) {
          seenHandoffs.current = new Set(items.map((item) => item.key))
          return
        }
        for (const item of items) {
          if (seenHandoffs.current.has(item.key)) continue
          seenHandoffs.current.add(item.key)
          const life = lives.get(item.from)
          const to = agentById.get(item.to)
          if (life && to) life.queue.push(handoverErrand(layout, to, item.what))
        }
      },
      setView(kind) {
        focus.target = null
        if (kind === 'top') topView()
        else overview()
      },
    }

    function resize() {
      const el = hostRef.current
      if (!el) return
      const w = Math.max(320, el.clientWidth)
      const h = Math.max(320, el.clientHeight)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    overview()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    function hit(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      for (const h of raycaster.intersectObjects(pickables, true)) {
        let o: THREE.Object3D | null = h.object
        while (o) {
          if (o.userData?.kind) return { data: o.userData as Record<string, string>, rect }
          o = o.parent
        }
      }
      return { data: null, rect }
    }

    let lastHover = ''
    function onMove(event: PointerEvent) {
      if (event.buttons) return
      const { data, rect } = hit(event)
      const key = data?.agentId ?? data?.assetId ?? ''
      renderer.domElement.style.cursor = data && data.kind !== 'room' ? 'pointer' : 'grab'
      if (data?.kind === 'agent') {
        const agent = agentById.get(data.agentId!)
        if (agent) setHover({ title: agent.name, sub: `${agent.role} · ${tasksRef.current?.[agent.id] ?? ''}`, x: event.clientX - rect.left, y: event.clientY - rect.top })
      } else if (key !== lastHover) {
        setHover(null)
      }
      lastHover = key
    }
    let down: { x: number; y: number } | null = null
    function onDown(event: PointerEvent) { down = { x: event.clientX, y: event.clientY } }
    function onUp(event: PointerEvent) {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) { down = null; return }
      down = null
      const { data } = hit(event)
      if (!data) return
      if (data.kind === 'agent' && data.agentId) handlers.current.onSelectAgent?.(data.agentId)
      else if (data.kind === 'asset' && data.assetId) handlers.current.onSelectAsset?.(data.assetId, data.roomId ?? '')
      else if (data.kind === 'room' && data.roomId) handlers.current.onSelectRoom?.(data.roomId, data.departmentId ?? null)
    }
    function onLeave() { setHover(null) }
    const stopFocus = () => { focus.target = null }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointerleave', onLeave)
    renderer.domElement.addEventListener('wheel', stopFocus, { passive: true })

    const clock = new THREE.Clock()
    let raf = 0
    const tmp = new THREE.Vector3()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, clock.getDelta())
      const time = clock.elapsedTime

      if (focus.target) {
        controls.target.lerp(focus.target, 0.08)
        const offset = tmp.copy(camera.position).sub(controls.target)
        const len = offset.length()
        offset.setLength(len + (focus.distance - len) * 0.06)
        camera.position.copy(controls.target).add(offset)
        if (controls.target.distanceTo(focus.target) < 0.05 && Math.abs(len - focus.distance) < 0.1) focus.target = null
      }
      controls.update()

      for (const m of movers) {
        if (m.wait > 0) { m.wait -= dt; continue }
        m.obj.position.x += m.dir * m.speed * dt
        m.obj.rotation.y = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2
        if (m.obj.position.x > m.x1) { m.obj.position.x = m.x1; m.dir = -1; m.wait = 2.5 }
        if (m.obj.position.x < m.x0) { m.obj.position.x = m.x0; m.dir = 1; m.wait = 2.5 }
      }
      for (const s of spinners) s.rotation.y = Math.sin(time * 0.8) * 1.4

      let trips = 0
      const busy = new Set<string>()
      for (const life of lives.values()) {
        if (life.mode === 'home') continue
        trips += 1
        busy.add(life.agent.id)
        if (life.errand?.withId) busy.add(life.errand.withId)
      }
      const maxTrips = Math.max(1, Math.ceil(lives.size * 0.4))

      let i = 0
      for (const [id, life] of lives) {
        i += 1
        const person = life.person
        const status = shown.status.get(id)
        let walking = false

        if (life.mode === 'home') {
          const next = life.queue[0]
          if (next && !busy.has(id)) {
            life.queue.shift()
            begin(life, next)
            trips += 1
            busy.add(id)
          } else {
            life.timer -= dt
            if (life.timer <= 0) {
              life.timer = nextDelay(life)
              if (status !== 'offline' && trips < maxTrips && !busy.has(id)) {
                const errand = pickErrand(layout, life.agent, { busy, task: liveTasks?.[id], requireTask: true })
                if (errand) {
                  begin(life, errand)
                  trips += 1
                  busy.add(id)
                  if (errand.withId) busy.add(errand.withId)
                }
              }
            }
          }
        }

        if ((life.mode === 'go' || life.mode === 'back') && life.stand >= 1) {
          const from = life.path[life.leg]
          const to = life.path[life.leg + 1]
          if (!from || !to) {
            if (life.mode === 'go') arrive(life)
            else settle(life)
          } else {
            life.t += (SPEED * dt) / Math.max(from.distanceTo(to), 0.01)
            person.root.position.lerpVectors(from, to, Math.min(1, life.t))
            const yaw = Math.atan2(to.x - from.x, to.z - from.z)
            person.root.rotation.y += Math.atan2(Math.sin(yaw - person.root.rotation.y), Math.cos(yaw - person.root.rotation.y)) * Math.min(1, dt * 12)
            walking = true
            if (life.t >= 1) {
              life.t = 0
              life.leg += 1
            }
          }
        } else if (life.mode === 'there') {
          life.timer -= dt
          if (life.timer <= 0) leave(life)
        }

        const seated = life.sits && life.mode === 'home'
        life.stand = Math.min(1, Math.max(0, life.stand + (seated ? -dt : dt) * 2.4))
        const rise = life.sits ? life.stand : 1
        if (life.sits) person.body.position.y = SIT_LIFT * rise
        const legBase = life.sits ? (-Math.PI / 2.2) * (1 - rise) : 0
        const armBase = life.sits ? -0.9 * (1 - rise) : 0

        let yaw = 0
        if (walking) {
          const swing = Math.sin(time * 9 + i) * 0.55
          person.legL.rotation.x = swing
          person.legR.rotation.x = -swing
          person.armL.rotation.x = -swing * 0.8
          person.armR.rotation.x = life.doc.visible ? -0.5 : swing * 0.8
        } else if (life.mode === 'there') {
          person.legL.rotation.x = 0
          person.legR.rotation.x = 0
          if (life.errand?.kind === 'asset') {
            person.armL.rotation.x = -1 + Math.sin(time * 5 + i) * 0.12
            person.armR.rotation.x = -1.1 + Math.cos(time * 4.6 + i) * 0.12
          } else {
            person.armL.rotation.x = -0.25 + Math.sin(time * 2.2 + i) * 0.2
            person.armR.rotation.x = life.errand?.kind === 'handover' && life.timer > life.errand.stay / 2 ? -1.2 : -0.5 + Math.sin(time * 3.1 + i) * 0.35
          }
        } else if (life.sits && rise < 1) {
          person.legL.rotation.x = legBase
          person.legR.rotation.x = legBase
          const pace = status === 'working' ? 14 : 6
          const reach = status === 'working' ? 0.06 : 0.03
          person.armL.rotation.x = armBase + (rise === 0 ? Math.sin(time * pace + i) * reach : 0)
          person.armR.rotation.x = armBase + (rise === 0 ? Math.cos(time * (pace - 1) + i) * reach : 0)
        } else if (status === 'working') {
          person.legL.rotation.x = 0
          person.legR.rotation.x = 0
          person.armL.rotation.x = -0.7 + Math.sin(time * 2.4 + i) * 0.35
          person.armR.rotation.x = -0.5 + Math.cos(time * 2.1 + i) * 0.4
          yaw = Math.sin(time * 0.6 + i) * 0.25
        } else {
          person.legL.rotation.x = 0
          person.legR.rotation.x = 0
          person.armL.rotation.x = 0
          person.armR.rotation.x = 0
        }
        if (life.attention && life.mode === 'home') {
          const p = person.root.position
          const want = Math.atan2(life.attention.x - p.x, life.attention.z - p.z) - person.root.rotation.y
          yaw = Math.max(-1.3, Math.min(1.3, Math.atan2(Math.sin(want), Math.cos(want))))
        }
        person.body.rotation.y += (yaw - person.body.rotation.y) * Math.min(1, dt * 4)
        person.status.scale.setScalar(1 + Math.sin(time * 3 + i) * 0.18)
      }

      if (ring.visible && ringFollow) {
        ring.position.set(ringFollow.position.x, 0.09, ringFollow.position.z)
        ring.scale.setScalar(ringScale * (1 + Math.sin(time * 4) * 0.06))
      }
      renderer.render(scene, camera)
    }
    tick()
    setReady(true)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointerleave', onLeave)
      renderer.domElement.removeEventListener('wheel', stopFocus)
      api.current = null
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          obj.geometry.dispose()
          const material = obj.material as THREE.Material | THREE.Material[]
          for (const m of Array.isArray(material) ? material : [material]) {
            const map = (m as THREE.MeshBasicMaterial).map
            map?.dispose()
            m.dispose()
          }
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    }
    // layoutKey résume la structure ; le reste passe par api.current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey])

  useEffect(() => { api.current?.highlightRoom(selectedRoomId ?? null) }, [selectedRoomId, ready])
  useEffect(() => { api.current?.focusAgent(selectedAgentId ?? null) }, [selectedAgentId, ready])
  useEffect(() => { api.current?.focusAsset(selectedAssetId ?? null) }, [selectedAssetId, ready])
  useEffect(() => { api.current?.setLabels(showLabels) }, [showLabels, ready])
  useEffect(() => {
    api.current?.setLive(Object.fromEntries(layout.agents.map((a) => [a.id, a.status])), tasks)
    // statusKey / taskKey résument les données vivantes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, taskKey, ready])
  const handoffKey = handoffs?.map((item) => item.key).join('|') ?? ''
  useEffect(() => {
    if (ready) api.current?.handoff(handoffs ?? [])
    // handoffKey résume la liste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffKey, ready])
  useEffect(() => { if (view) api.current?.setView(view.kind) }, [view])

  return (
    <div className={styles.stage} data-office-ready={ready ? '1' : '0'}>
      <div ref={hostRef} className={styles.canvas} role="img" aria-label={`Jumeau numérique 3D · ${layout.archetypeLabel}`} />
      {hover ? (
        <div className={styles.hover} style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <strong>{hover.title}</strong>
          {hover.sub ? <span>{hover.sub}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
