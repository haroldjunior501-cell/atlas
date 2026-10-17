import * as THREE from 'three'
import type { OfficeDesk, OfficeProp } from '@atlas/domain'

/**
 * Modèles 3D procéduraux low-poly (style maquette de jumeau numérique).
 * Unité : 1 ≈ 1,2 m. L’avant d’un véhicule ou d’une personne est +z local.
 */

export type Kit = ReturnType<typeof createKit>

export interface Person {
  root: THREE.Group
  body: THREE.Group
  legL: THREE.Object3D
  legR: THREE.Object3D
  armL: THREE.Object3D
  armR: THREE.Object3D
  status: THREE.Mesh
}

const SKIN = ['#f1c7a5', '#d9a47f', '#a8724f', '#f4d3b8', '#7b4a32']
const HAIR = ['#1f2937', '#4b3621', '#111827', '#9a6b3f', '#d6b370', '#3f3f46']

export function createKit() {
  const materials = new Map<string, THREE.MeshStandardMaterial>()

  function mat(color: string, opts: { rough?: number; metal?: number; emissive?: string; intensity?: number; opacity?: number } = {}) {
    const key = `${color}|${opts.rough ?? 0.7}|${opts.metal ?? 0}|${opts.emissive ?? ''}|${opts.intensity ?? 0}|${opts.opacity ?? 1}`
    let m = materials.get(key)
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: opts.rough ?? 0.7,
        metalness: opts.metal ?? 0,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : undefined,
        emissiveIntensity: opts.intensity ?? 0,
        transparent: (opts.opacity ?? 1) < 1,
        opacity: opts.opacity ?? 1,
      })
      materials.set(key, m)
    }
    return m
  }

  function box(w: number, h: number, d: number, color: string | THREE.Material, x = 0, y = 0, z = 0, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    return mesh
  }

  function cyl(rt: number, rb: number, h: number, color: string | THREE.Material, x = 0, y = 0, z = 0, seg = 18) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? mat(color) : color)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  function sphere(r: number, color: string | THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), typeof color === 'string' ? mat(color) : color)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    return mesh
  }

  function group(...children: THREE.Object3D[]) {
    const g = new THREE.Group()
    for (const child of children) g.add(child)
    return g
  }

  function wheel(x: number, z: number, r = 0.33) {
    const w = cyl(r, r, 0.26, '#111827', x, r, z, 16)
    w.rotation.z = Math.PI / 2
    const hub = cyl(r * 0.5, r * 0.5, 0.27, '#9ca3af', x, r, z, 12)
    hub.rotation.z = Math.PI / 2
    return group(w, hub)
  }

  const glass = () => mat('#1e293b', { rough: 0.15, metal: 0.4 })

  function car(color: string) {
    const g = group(
      box(1.5, 0.5, 3.6, mat(color, { rough: 0.3, metal: 0.35 }), 0, 0.5, 0),
      box(1.36, 0.46, 1.9, glass(), 0, 0.96, -0.15),
      box(1.38, 0.06, 1.7, mat(color, { rough: 0.3, metal: 0.35 }), 0, 1.2, -0.2),
      box(1.52, 0.16, 0.12, '#374151', 0, 0.36, 1.78),
      box(1.52, 0.16, 0.12, '#374151', 0, 0.36, -1.78),
      box(0.32, 0.1, 0.05, mat('#f8fafc', { emissive: '#ffffff', intensity: 0.6 }), -0.5, 0.6, 1.81),
      box(0.32, 0.1, 0.05, mat('#f8fafc', { emissive: '#ffffff', intensity: 0.6 }), 0.5, 0.6, 1.81),
      box(0.34, 0.1, 0.05, mat('#dc2626', { emissive: '#dc2626', intensity: 0.5 }), -0.52, 0.6, -1.81),
      box(0.34, 0.1, 0.05, mat('#dc2626', { emissive: '#dc2626', intensity: 0.5 }), 0.52, 0.6, -1.81),
      wheel(-0.72, 1.15), wheel(0.72, 1.15), wheel(-0.72, -1.15), wheel(0.72, -1.15),
    )
    return g
  }

  function van(color: string, ambulance = false) {
    const g = group(
      box(1.7, 1.55, 4.2, mat(color, { rough: 0.4, metal: 0.2 }), 0, 1.15, 0),
      box(1.6, 0.55, 0.06, glass(), 0, 1.45, 2.1),
      box(1.72, 0.18, 4.22, '#374151', 0, 0.42, 0),
      wheel(-0.8, 1.35, 0.36), wheel(0.8, 1.35, 0.36), wheel(-0.8, -1.35, 0.36), wheel(0.8, -1.35, 0.36),
    )
    if (ambulance) {
      g.add(box(1.72, 0.22, 4.22, '#dc2626', 0, 1.0, 0, false))
      g.add(box(0.5, 0.14, 0.14, '#dc2626', 0, 1.97, -0.6), box(0.14, 0.14, 0.5, '#dc2626', 0, 1.97, -0.6))
      g.add(box(0.8, 0.12, 0.25, mat('#3b82f6', { emissive: '#3b82f6', intensity: 1.2 }), 0, 2, 1.6))
    }
    return g
  }

  function truck(color: string) {
    return group(
      box(2.0, 1.9, 1.7, mat(color, { rough: 0.4, metal: 0.2 }), 0, 1.35, 2.3),
      box(1.9, 0.7, 0.06, glass(), 0, 1.75, 3.16),
      box(2.1, 2.5, 4.6, '#f8fafc', 0, 1.75, -0.9),
      box(2.12, 0.25, 4.6, color, 0, 0.6, -0.9),
      box(2.0, 0.3, 6.2, '#374151', 0, 0.42, 0),
      wheel(-0.95, 2.3, 0.42), wheel(0.95, 2.3, 0.42),
      wheel(-0.95, -1.4, 0.42), wheel(0.95, -1.4, 0.42),
      wheel(-0.95, -2.4, 0.42), wheel(0.95, -2.4, 0.42),
    )
  }

  function forklift(color: string) {
    const g = group(
      box(1.0, 0.7, 1.5, color, 0, 0.6, -0.1),
      box(0.95, 0.5, 0.5, '#374151', 0, 0.7, -0.75),
      box(0.08, 1.4, 0.08, '#374151', -0.4, 1.6, -0.6),
      box(0.08, 1.4, 0.08, '#374151', 0.4, 1.6, -0.6),
      box(0.08, 1.4, 0.08, '#374151', -0.4, 1.6, 0.4),
      box(0.08, 1.4, 0.08, '#374151', 0.4, 1.6, 0.4),
      box(0.98, 0.06, 1.1, '#374151', 0, 2.3, -0.1),
      box(0.1, 2.4, 0.1, '#6b7280', -0.32, 1.2, 0.8),
      box(0.1, 2.4, 0.1, '#6b7280', 0.32, 1.2, 0.8),
      box(0.12, 0.05, 1.0, '#9ca3af', -0.25, 0.25, 1.3),
      box(0.12, 0.05, 1.0, '#9ca3af', 0.25, 0.25, 1.3),
      box(0.9, 0.6, 0.9, '#c49a6c', 0, 0.62, 1.35),
      wheel(-0.48, 0.45, 0.24), wheel(0.48, 0.45, 0.24), wheel(-0.48, -0.6, 0.24), wheel(0.48, -0.6, 0.24),
    )
    const driver = person('#f59e0b', 'sit', 3)
    driver.root.position.set(0, 0.35, -0.2)
    driver.root.scale.setScalar(0.85)
    g.add(driver.root)
    return g
  }

  function scooter(color: string) {
    return group(box(0.4, 0.4, 1.3, color, 0, 0.45, 0), box(0.5, 0.5, 0.5, '#f8fafc', 0, 0.95, -0.4), wheel(0, 0.5, 0.22), wheel(0, -0.5, 0.22))
  }

  function chair(color = '#334155') {
    return group(
      box(0.45, 0.07, 0.45, color, 0, 0.42, 0),
      box(0.45, 0.45, 0.07, color, 0, 0.66, -0.2),
      cyl(0.03, 0.03, 0.38, '#6b7280', 0, 0.2, 0, 8),
      cyl(0.22, 0.22, 0.04, '#6b7280', 0, 0.03, 0, 10),
    )
  }

  function person(color: string, pose: 'sit' | 'stand', seed = 0): Person {
    const skin = SKIN[seed % SKIN.length]!
    const hair = HAIR[(seed * 7) % HAIR.length]!
    const pants = seed % 3 === 0 ? '#1f2937' : seed % 3 === 1 ? '#334155' : '#3f3f46'
    const root = new THREE.Group()
    const body = new THREE.Group()
    root.add(body)
    const hip = pose === 'sit' ? 0.46 : 0.72
    const legGeo = (x: number) => {
      const leg = new THREE.Group()
      leg.position.set(x, hip, 0)
      const mesh = box(0.16, 0.7, 0.18, pants, 0, -0.35, 0)
      const shoe = box(0.17, 0.08, 0.28, '#111827', 0, -0.7, 0.05)
      leg.add(mesh, shoe)
      if (pose === 'sit') leg.rotation.x = -Math.PI / 2.2
      return leg
    }
    const legL = legGeo(-0.1)
    const legR = legGeo(0.1)
    body.add(legL, legR)
    const torso = box(0.44, 0.58, 0.26, mat(color, { rough: 0.6 }), 0, hip + 0.3, 0)
    body.add(torso)
    const armGeo = (x: number) => {
      const arm = new THREE.Group()
      arm.position.set(x, hip + 0.56, 0)
      arm.add(box(0.12, 0.52, 0.14, mat(color, { rough: 0.6 }), 0, -0.26, 0), box(0.1, 0.1, 0.12, skin, 0, -0.55, 0))
      if (pose === 'sit') arm.rotation.x = -0.9
      return arm
    }
    const armL = armGeo(-0.29)
    const armR = armGeo(0.29)
    body.add(armL, armR)
    body.add(box(0.1, 0.08, 0.1, skin, 0, hip + 0.63, 0))
    body.add(sphere(0.17, mat(skin, { rough: 0.55 }), 0, hip + 0.83, 0))
    const cap = sphere(0.175, hair, 0, hip + 0.88, -0.02)
    cap.scale.set(1, 0.7, 1)
    body.add(cap)
    const status = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat('#22c55e', { emissive: '#22c55e', intensity: 1 }))
    status.position.set(0, hip + 1.2, 0)
    body.add(status)
    return { root, body, legL, legR, armL, armR, status }
  }

  function desk(d: OfficeDesk) {
    const wide = d.style === 'bench' ? 1.4 : d.style === 'u_shape' ? 1.8 : 1.3
    const wood = d.style === 'bench' ? '#f1f5f9' : '#d6c3a5'
    const g = group(
      box(wide, 0.05, 0.7, mat(wood, { rough: 0.55 }), 0, 0.62, 0),
      box(0.05, 0.6, 0.6, '#9ca3af', -wide / 2 + 0.06, 0.31, 0),
      box(0.05, 0.6, 0.6, '#9ca3af', wide / 2 - 0.06, 0.31, 0),
    )
    if (d.style === 'l_shape' || d.style === 'u_shape') g.add(box(0.6, 0.05, 1.1, mat(wood, { rough: 0.55 }), wide / 2 + 0.25, 0.62, 0.2))
    if (d.style === 'u_shape') g.add(box(0.6, 0.05, 1.1, mat(wood, { rough: 0.55 }), -wide / 2 - 0.25, 0.62, 0.2))
    const monitors = d.style === 'bench' ? [-0.3, 0.3] : [0]
    for (const x of monitors) {
      g.add(box(0.5, 0.32, 0.03, '#111827', x, 0.88, -0.22))
      g.add(box(0.46, 0.27, 0.01, mat('#93c5fd', { emissive: '#60a5fa', intensity: 0.55 }), x, 0.88, -0.2, false))
      g.add(box(0.05, 0.12, 0.05, '#4b5563', x, 0.7, -0.24))
    }
    g.add(box(0.36, 0.02, 0.13, '#e5e7eb', 0, 0.655, 0.05))
    if (d.hasLamp) g.add(cyl(0.03, 0.05, 0.36, '#111827', -wide / 2 + 0.15, 0.82, -0.2, 8))
    const c = chair()
    c.position.set(0, 0, 0.55)
    c.rotation.y = Math.PI
    g.add(c)
    g.position.set(d.x, 0, d.z)
    g.rotation.y = d.rotation
    return g
  }

  function rack(length: number, color: string, depth = 1, height = 2.4) {
    const g = new THREE.Group()
    const posts = Math.max(2, Math.round(length / 1.6) + 1)
    for (let i = 0; i < posts; i += 1) {
      const x = -length / 2 + (i * length) / (posts - 1)
      g.add(box(0.08, height, 0.08, color, x, height / 2, -depth / 2), box(0.08, height, 0.08, color, x, height / 2, depth / 2))
    }
    const levels = [0.15, 0.95, 1.75]
    const palette = ['#c49a6c', '#d6b07a', '#e5e7eb', '#93c5fd', '#fca5a5', '#fde68a']
    levels.forEach((y, li) => {
      g.add(box(length, 0.06, 0.08, color, 0, y, -depth / 2), box(length, 0.06, 0.08, color, 0, y, depth / 2))
      g.add(box(length, 0.03, depth, '#9ca3af', 0, y + 0.02, 0, false))
      for (let i = 0; i < posts - 1; i += 1) {
        const x = -length / 2 + ((i + 0.5) * length) / (posts - 1)
        if ((i + li) % 4 === 3) continue
        g.add(box(1.1, 0.55, depth * 0.8, palette[(i * 3 + li) % palette.length]!, x, y + 0.32, 0))
      }
    })
    return g
  }

  function plant(scale = 1) {
    const g = group(cyl(0.2, 0.16, 0.36, '#e5e7eb', 0, 0.18, 0, 12), sphere(0.32, '#4d9a5b', 0, 0.62, 0), sphere(0.22, '#3f8a4e', 0.12, 0.85, 0.05))
    g.scale.setScalar(scale)
    return g
  }

  function screen(w: number, h: number, accent: string) {
    const g = group(box(w, h, 0.06, '#111827', 0, 0, 0))
    g.add(box(w - 0.1, h - 0.1, 0.01, mat('#0f172a', { emissive: '#1e3a8a', intensity: 0.5 }), 0, 0, 0.035, false))
    const bars = Math.max(3, Math.round(w * 2))
    for (let i = 0; i < bars; i += 1) {
      const bh = 0.15 + ((i * 37) % 10) / 20
      g.add(box(0.12, bh * h * 0.6, 0.01, mat(i % 2 ? accent : '#38bdf8', { emissive: i % 2 ? accent : '#38bdf8', intensity: 0.9 }), -w / 2 + 0.3 + (i * (w - 0.6)) / bars, -h / 2 + 0.15 + (bh * h * 0.6) / 2, 0.045, false))
    }
    return g
  }

  function boxes(n = 3) {
    const g = new THREE.Group()
    for (let i = 0; i < n; i += 1) g.add(box(0.55, 0.42, 0.45, i % 2 ? '#c49a6c' : '#d6b07a', (i % 2) * 0.3 - 0.15, 0.21 + Math.floor(i / 2) * 0.42, (i % 3) * 0.08))
    return g
  }

  function prop(p: OfficeProp, accent: string): THREE.Object3D | null {
    const c = p.color ?? accent
    const w = p.w ?? 2
    const d = p.d ?? 2
    let g: THREE.Object3D | null = null
    switch (p.kind) {
      case 'car': g = car(p.color ?? '#f8fafc'); if (p.label === 'lift') g.position.y = 0.95; if (p.label === 'show' || p.label === 'delivery') g.position.y = 0.16; break
      case 'van': g = van(p.color ?? '#f8fafc'); break
      case 'ambulance': g = van('#f8fafc', true); break
      case 'truck': g = truck(c); break
      case 'forklift': g = forklift(p.color ?? '#f59e0b'); break
      case 'scooter': g = scooter(c); break
      case 'car_lift': {
        const lift = new THREE.Group()
        for (const x of [-1.15, 1.15]) {
          lift.add(box(0.28, 2.6, 0.28, c, x, 1.3, 0), box(0.5, 0.05, 0.5, '#6b7280', x, 0.03, 0))
          lift.add(box(0.7, 0.07, 0.12, '#374151', x * 0.72, 0.9, 1.0), box(0.7, 0.07, 0.12, '#374151', x * 0.72, 0.9, -1.0))
        }
        lift.add(box(2.6, 0.12, 0.2, c, 0, 2.62, 0))
        g = lift
        break
      }
      case 'tool_cabinet': {
        const cab = group(box(0.9, 1.0, 0.5, c, 0, 0.5, 0))
        for (let i = 0; i < 4; i += 1) cab.add(box(0.8, 0.02, 0.01, '#111827', 0, 0.2 + i * 0.22, 0.26, false))
        cab.add(box(0.95, 0.04, 0.55, '#374151', 0, 1.02, 0))
        g = cab
        break
      }
      case 'tire_stack': { const t = new THREE.Group(); for (let i = 0; i < 4; i += 1) t.add(cyl(0.33, 0.33, 0.22, '#111827', 0, 0.12 + i * 0.23, 0, 16)); g = t; break }
      case 'display_podium': g = group(cyl(2.0, 2.05, 0.15, '#f8fafc', 0, 0.075, 0, 40), cyl(2.06, 2.06, 0.04, c, 0, 0.02, 0, 40)); break
      case 'flag_banner': g = group(cyl(0.03, 0.03, 2.6, '#9ca3af', 0, 1.3, 0, 8), box(0.5, 1.6, 0.02, c, 0.27, 1.7, 0), cyl(0.2, 0.2, 0.04, '#6b7280', 0, 0.02, 0, 12)); break
      case 'bay_marking': {
        const m = mat(c, { rough: 0.9 })
        const t = 0.07
        g = group(
          box(w, 0.01, t, m, 0, 0.025, -d / 2, false), box(w, 0.01, t, m, 0, 0.025, d / 2, false),
          box(t, 0.01, d, m, -w / 2, 0.025, 0, false), box(t, 0.01, d, m, w / 2, 0.025, 0, false),
        )
        break
      }
      case 'parking_line': g = box(0.08, 0.01, d, mat('#ffffff', { rough: 0.9 }), 0, 0.025, 0, false); break
      case 'counter': g = group(box(w, 1.05, 0.7, '#f8fafc', 0, 0.525, 0), box(w, 0.6, 0.02, c, 0, 0.55, 0.36, false), box(w + 0.1, 0.05, 0.8, '#e5e7eb', 0, 1.07, 0), box(0.45, 0.3, 0.03, '#111827', -w / 4, 1.25, -0.15)); break
      case 'chairs_row': { const r = new THREE.Group(); for (let i = -1; i <= 1; i += 1) { const ch = chair('#64748b'); ch.position.x = i * 0.55; r.add(ch) } g = r; break }
      case 'logo_wall': g = group(box(w, 2.2, 0.15, '#f8fafc', 0, 1.1, 0), box(w, 0.25, 0.02, mat(c, { emissive: c, intensity: 0.5 }), 0, 1.75, -0.09, false), box(w * 0.4, 0.5, 0.02, c, 0, 1.1, -0.09, false)); break
      case 'moodboard': {
        const mb = group(box(2.2, 1.4, 0.06, '#f8fafc', 0, 1.35, 0), box(0.04, 0.65, 0.04, '#9ca3af', -0.9, 0.33, 0), box(0.04, 0.65, 0.04, '#9ca3af', 0.9, 0.33, 0))
        const tiles = ['#fda4af', c, '#fde68a', '#a5b4fc', '#6ee7b7', '#111827']
        for (let i = 0; i < 6; i += 1) mb.add(box(0.55, 0.45, 0.01, tiles[i]!, -0.65 + (i % 3) * 0.65, 1.62 - Math.floor(i / 3) * 0.55, -0.04, false))
        g = mb
        break
      }
      case 'easel': g = group(box(0.05, 1.6, 0.05, '#a16207', -0.3, 0.8, 0), box(0.05, 1.6, 0.05, '#a16207', 0.3, 0.8, 0), box(0.8, 0.6, 0.04, '#f8fafc', 0, 1.2, 0.05), box(0.6, 0.4, 0.01, c, 0, 1.2, 0.08, false)); break
      case 'big_screen': { const s = screen(p.w ?? 2.4, 1.3, c); s.position.y = 1.45; const stand = box(0.1, 0.8, 0.1, '#374151', 0, 0.4, 0.05); g = group(s, stand); break }
      case 'backdrop': g = group(box(w, 2.6, 0.08, '#fafafa', 0, 1.3, 0), box(w, 0.02, 2, '#fafafa', 0, 0.02, -1, false)); break
      case 'camera_tripod': g = group(box(0.04, 1.3, 0.04, '#111827', -0.18, 0.62, 0), box(0.04, 1.3, 0.04, '#111827', 0.18, 0.62, 0), box(0.04, 1.3, 0.04, '#111827', 0, 0.62, -0.2), box(0.35, 0.25, 0.4, '#111827', 0, 1.35, 0), cyl(0.09, 0.09, 0.2, '#374151', 0, 1.35, 0.28, 12)); (g.children[4] as THREE.Mesh).rotation.x = Math.PI / 2; break
      case 'softbox': g = group(box(0.04, 1.8, 0.04, '#111827', 0, 0.9, 0), box(0.8, 0.8, 0.3, mat('#ffffff', { emissive: '#fff7ed', intensity: 0.9 }), 0, 1.9, 0)); break
      case 'bean_bag': { const b = sphere(0.45, c, 0, 0.3, 0); b.scale.set(1, 0.6, 1); g = group(b); break }
      case 'ping_pong': g = group(box(1.5, 0.05, 2.7, '#1d4ed8', 0, 0.75, 0), box(1.5, 0.15, 0.02, '#f8fafc', 0, 0.85, 0), box(0.06, 0.72, 0.06, '#111827', -0.6, 0.36, -1.1), box(0.06, 0.72, 0.06, '#111827', 0.6, 0.36, 1.1)); break
      case 'neon_sign': g = group(box(1.6, 0.5, 0.05, '#111827', 0, 1.7, 0), box(1.3, 0.12, 0.02, mat(c, { emissive: c, intensity: 2 }), 0, 1.7, 0.04, false)); break
      case 'stove': g = group(box(1.0, 0.9, 0.8, mat('#cbd5e1', { metal: 0.6, rough: 0.3 }), 0, 0.45, 0), box(1.0, 0.03, 0.8, '#111827', 0, 0.91, 0), cyl(0.12, 0.12, 0.03, mat('#f97316', { emissive: '#f97316', intensity: 0.8 }), -0.22, 0.93, 0.1, 12), cyl(0.12, 0.12, 0.03, '#374151', 0.22, 0.93, 0.1, 12), box(1.1, 0.4, 0.9, mat('#e2e8f0', { metal: 0.6, rough: 0.3 }), 0, 2.2, -0.05)); break
      case 'prep_table': g = group(box(w, 0.06, 0.9, mat('#e2e8f0', { metal: 0.6, rough: 0.25 }), 0, 0.9, 0), box(w - 0.2, 0.04, 0.8, mat('#cbd5e1', { metal: 0.5 }), 0, 0.3, 0), box(0.4, 0.06, 0.3, '#f8fafc', -w / 4, 0.96, 0), sphere(0.08, '#ef4444', w / 5, 0.98, 0.1), sphere(0.08, '#22c55e', w / 5 + 0.2, 0.98, -0.1)); break
      case 'fridge_pro': g = group(box(1.2, 2.0, 0.8, mat('#e2e8f0', { metal: 0.6, rough: 0.3 }), 0, 1.0, 0), box(0.02, 1.8, 0.01, '#94a3b8', 0, 1.0, 0.41, false)); break
      case 'pass_counter': { const pc = group(box(w, 1.1, 0.5, mat('#e2e8f0', { metal: 0.6, rough: 0.3 }), 0, 0.55, 0)); for (let i = 0; i < Math.floor(w / 1.2); i += 1) pc.add(cyl(0.08, 0.14, 0.12, mat('#f97316', { emissive: '#fb923c', intensity: 1 }), -w / 2 + 0.6 + i * 1.2, 1.7, 0, 10)); g = pc; break }
      case 'dining_table': {
        const t = group(box(1.0, 0.05, 1.0, '#e7d7bd', 0, 0.74, 0), cyl(0.06, 0.06, 0.72, '#374151', 0, 0.36, 0, 8), cyl(0.06, 0.06, 0.06, '#f8fafc', 0.2, 0.8, 0.2, 8))
        for (const [x, z, r] of [[-0.6, 0, Math.PI / 2], [0.6, 0, -Math.PI / 2], [0, -0.6, 0], [0, 0.6, Math.PI]] as const) { const ch = chair('#a16207'); ch.position.set(x, 0, z); ch.rotation.y = r; t.add(ch) }
        g = t
        break
      }
      case 'bar_counter': { const len = p.w ?? p.d ?? 4; const b = group(box(len, 1.1, 0.7, '#3f2a1d', 0, 0.55, 0), box(len + 0.1, 0.06, 0.8, '#e5e7eb', 0, 1.12, 0), box(len, 0.08, 0.02, mat(c, { emissive: c, intensity: 0.8 }), 0, 0.2, 0.36, false)); for (let i = 0; i < Math.floor(len / 0.8); i += 1) b.add(cyl(0.16, 0.16, 0.06, '#111827', -len / 2 + 0.4 + i * 0.8, 0.75, 0.7, 10), cyl(0.03, 0.03, 0.72, '#9ca3af', -len / 2 + 0.4 + i * 0.8, 0.36, 0.7, 6)); g = b; break }
      case 'parasol_table': { const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.45, 12), mat(c)); cone.position.y = 2.2; cone.castShadow = true; g = group(cyl(0.45, 0.45, 0.04, '#f8fafc', 0, 0.74, 0, 16), cyl(0.04, 0.04, 2.2, '#9ca3af', 0, 1.1, 0, 8), cone); const a = chair('#9ca3af'); a.position.set(-0.75, 0, 0); a.rotation.y = Math.PI / 2; const b = chair('#9ca3af'); b.position.set(0.75, 0, 0); b.rotation.y = -Math.PI / 2; g.add(a, b); break }
      case 'planter': g = group(box(w, 0.5, 0.5, '#d6d3d1', 0, 0.25, 0), box(w - 0.1, 0.35, 0.4, '#4d9a5b', 0, 0.6, 0)); break
      case 'guest':
      case 'shopper': { const pp = person(p.color ?? '#64748b', p.kind === 'guest' ? 'sit' : 'stand', Math.abs(Math.round(p.x * 13 + p.z * 7))); pp.status.visible = false; g = pp.root; if (p.kind === 'shopper') g.add(box(0.25, 0.3, 0.1, '#f8fafc', 0.35, 0.55, 0)); break }
      case 'exam_bed': g = group(box(0.8, 0.12, 2.0, mat('#5eead4', { rough: 0.5 }), 0, 0.72, 0), box(0.7, 0.62, 1.8, '#f1f5f9', 0, 0.33, 0), box(0.6, 0.1, 0.35, '#f8fafc', 0, 0.83, -0.75)); break
      case 'medical_cart': g = group(box(0.6, 0.85, 0.45, '#f8fafc', 0, 0.5, 0), box(0.62, 0.04, 0.47, '#0ea5e9', 0, 0.94, 0), box(0.55, 0.02, 0.01, '#94a3b8', 0, 0.6, 0.23, false), box(0.55, 0.02, 0.01, '#94a3b8', 0, 0.35, 0.23, false)); break
      case 'lab_bench': g = group(box(p.w ?? 2, 0.95, 0.8, '#f8fafc', 0, 0.475, 0), box((p.w ?? 2) + 0.05, 0.04, 0.85, '#1f2937', 0, 0.97, 0), cyl(0.08, 0.1, 0.35, '#e5e7eb', -0.4, 1.15, 0, 10), box(0.3, 0.25, 0.3, '#94a3b8', 0.4, 1.12, 0), cyl(0.04, 0.04, 0.2, mat('#a5f3fc', { opacity: 0.6 }), 0, 1.09, 0.2, 8)); break
      case 'wall_partition': g = box(0.08, 1.1, d, '#f8fafc', 0, 0.55, 0); break
      case 'pallet_rack': g = rack(w, c); break
      case 'pallet': g = group(box(1.0, 0.14, 1.2, '#b48a5a', 0, 0.07, 0), boxes(4)); break
      case 'conveyor': { const cv = group(box(w, 0.08, 0.8, '#1f2937', 0, 0.8, 0), box(w, 0.1, 0.06, '#9ca3af', 0, 0.78, 0.42), box(w, 0.1, 0.06, '#9ca3af', 0, 0.78, -0.42)); for (let x = -w / 2 + 0.3; x < w / 2; x += 1.4) { cv.add(box(0.06, 0.76, 0.7, '#6b7280', x, 0.38, 0)) ; cv.add(box(0.5, 0.35, 0.45, '#c49a6c', x + 0.6, 1.02, 0)) } g = cv; break }
      case 'pack_table': g = group(box(1.4, 0.05, 0.8, '#e5e7eb', 0, 0.9, 0), box(0.05, 0.88, 0.7, '#9ca3af', -0.65, 0.44, 0), box(0.05, 0.88, 0.7, '#9ca3af', 0.65, 0.44, 0), box(0.5, 0.35, 0.4, '#c49a6c', -0.3, 1.1, 0), box(0.35, 0.25, 0.03, '#111827', 0.4, 1.12, -0.25)); break
      case 'box_stack': g = boxes(5); break
      case 'dock_door': g = group(box(2.8, 2.8, 0.15, '#94a3b8', 0, 1.4, 0), box(2.5, 2.5, 0.05, '#cbd5e1', 0, 1.3, 0.08), box(2.9, 0.15, 0.2, c, 0, 2.85, 0), box(0.15, 2.8, 0.2, c, -1.4, 1.4, 0), box(0.15, 2.8, 0.2, c, 1.4, 1.4, 0), box(2.6, 0.25, 0.4, '#111827', 0, 0.12, 0.3)); break
      case 'cnc_machine': g = group(box(1.8, 2.0, 1.4, '#e5e7eb', 0, 1.0, 0), box(1.8, 0.2, 1.42, c, 0, 1.9, 0), box(1.0, 0.8, 0.02, glass(), -0.2, 1.1, 0.71, false), box(0.35, 0.3, 0.05, mat('#1e293b', { emissive: '#22d3ee', intensity: 0.6 }), 0.65, 1.3, 0.72, false)); break
      case 'robot_arm': {
        const base = cyl(0.45, 0.55, 0.4, '#374151', 0, 0.2, 0, 16)
        const spinner = new THREE.Group()
        spinner.position.y = 0.4
        const lower = box(0.25, 1.2, 0.25, c, 0, 0.6, 0)
        const elbow = new THREE.Group()
        elbow.position.y = 1.2
        elbow.rotation.z = 1.0
        elbow.add(box(0.2, 1.0, 0.2, c, 0, 0.5, 0), box(0.3, 0.2, 0.3, '#111827', 0, 1.05, 0))
        spinner.add(lower, elbow)
        spinner.userData.spinner = true
        g = group(base, spinner)
        break
      }
      case 'measure_machine': g = group(box(1.4, 0.8, 1.0, '#4b5563', 0, 0.4, 0), box(1.3, 0.1, 0.9, '#1f2937', 0, 0.85, 0), box(0.1, 0.9, 0.1, '#e5e7eb', -0.6, 1.3, 0), box(0.1, 0.9, 0.1, '#e5e7eb', 0.6, 1.3, 0), box(1.3, 0.12, 0.15, c, 0, 1.75, 0)); break
      case 'shelving': { const s = rack(w, '#9ca3af', 0.5, 2.0); g = s; break }
      case 'retail_shelf': {
        const sh = group(box(w, 1.5, 0.3, '#f8fafc', 0, 0.75, 0), box(w, 0.1, 0.9, '#e5e7eb', 0, 0.05, 0))
        const colors = ['#f87171', '#60a5fa', '#fbbf24', '#34d399', '#a78bfa', '#f472b6']
        for (let lv = 0; lv < 3; lv += 1) for (let i = 0; i < Math.floor(w / 0.35); i += 1) { sh.add(box(0.28, 0.32, 0.25, colors[(i + lv * 2) % colors.length]!, -w / 2 + 0.2 + i * 0.35, 0.32 + lv * 0.45, 0.28)); sh.add(box(0.28, 0.32, 0.25, colors[(i + lv) % colors.length]!, -w / 2 + 0.2 + i * 0.35, 0.32 + lv * 0.45, -0.28)) }
        g = sh
        break
      }
      case 'display_table': { const dt = group(box(1.6, 0.06, 1.0, '#e7d7bd', 0, 0.8, 0), box(1.4, 0.75, 0.8, '#f8fafc', 0, 0.38, 0)); for (let i = 0; i < 4; i += 1) dt.add(box(0.32, 0.08, 0.3, i % 2 ? c : '#111827', -0.5 + i * 0.33, 0.87, 0)); g = dt; break }
      case 'mannequin': g = group(cyl(0.2, 0.2, 0.04, '#111827', 0, 0.02, 0, 12), cyl(0.02, 0.02, 0.7, '#9ca3af', 0, 0.38, 0, 6), cyl(0.15, 0.3, 0.8, c, 0, 1.05, 0, 12), sphere(0.13, '#e5e7eb', 0, 1.6, 0)); break
      case 'checkout_counter': g = group(box(1.6, 0.95, 0.8, '#f8fafc', 0, 0.475, 0), box(1.6, 0.4, 0.02, c, 0, 0.6, 0.41, false), box(1.65, 0.04, 0.85, '#1f2937', 0, 0.97, 0), box(0.4, 0.3, 0.05, '#111827', 0.4, 1.2, 0.1), box(0.6, 0.02, 0.6, '#374151', -0.4, 0.99, 0)); break
      case 'fitting_booth': g = group(box(1.6, 2.2, 0.08, '#f8fafc', 0, 1.1, -0.8), box(0.08, 2.2, 1.6, '#f8fafc', -0.8, 1.1, 0), box(0.08, 2.2, 1.6, '#f8fafc', 0.8, 1.1, 0), box(1.5, 1.9, 0.03, mat(c, { rough: 0.9 }), 0, 1.15, 0.78)); break
      case 'server_rack': {
        const sr = group(box(0.8, 2.1, 1.0, '#111827', 0, 1.05, 0))
        for (let i = 0; i < 8; i += 1) sr.add(box(0.06, 0.04, 0.01, mat(i % 3 ? '#22c55e' : '#3b82f6', { emissive: i % 3 ? '#22c55e' : '#3b82f6', intensity: 1.5 }), -0.25 + (i % 2) * 0.1, 0.4 + i * 0.2, 0.51, false))
        g = sr
        break
      }
      case 'listing_board': {
        const lb = group(box(0.05, 1.8, 0.05, '#9ca3af', -0.8, 0.9, 0), box(0.05, 1.8, 0.05, '#9ca3af', 0.8, 0.9, 0), box(1.7, 1.3, 0.05, '#f8fafc', 0, 1.25, 0))
        for (let i = 0; i < 2; i += 1) { lb.add(box(0.7, 0.45, 0.01, i ? '#93c5fd' : '#86efac', -0.4 + i * 0.8, 1.5, 0.03, false)); lb.add(box(0.7, 0.12, 0.01, c, -0.4 + i * 0.8, 1.17, 0.03, false)) }
        g = lb
        break
      }
      case 'model_table': { const mt = group(box(2.2, 0.8, 1.4, '#f8fafc', 0, 0.4, 0), box(2.0, 0.02, 1.2, '#bbf7d0', 0, 0.81, 0)); for (let i = 0; i < 5; i += 1) mt.add(box(0.25, 0.2 + (i % 3) * 0.15, 0.25, i === 2 ? c : '#e5e7eb', -0.7 + i * 0.35, 0.9 + (i % 3) * 0.07, (i % 2) * 0.3 - 0.15)); g = mt; break }
      case 'plant': g = plant(p.scale ?? 1); break
      case 'tree': { const tr = group(cyl(0.12, 0.16, 1.4, '#7c5a3a', 0, 0.7, 0, 8), sphere(0.9, '#5c9e64', 0, 1.9, 0), sphere(0.6, '#4d8f57', 0.4, 2.3, 0.2)); g = tr; break }
      case 'chair': g = chair(); break
      case 'sofa': g = group(box(1.5, 0.35, 0.7, '#94a3b8', 0, 0.3, 0), box(1.5, 0.45, 0.18, '#94a3b8', 0, 0.6, -0.27), box(0.18, 0.5, 0.7, '#64748b', -0.75, 0.4, 0), box(0.18, 0.5, 0.7, '#64748b', 0.75, 0.4, 0)); break
      case 'table': g = group(box(1.2, 0.05, 0.8, '#e7d7bd', 0, 0.62, 0), box(0.06, 0.6, 0.06, '#374151', -0.5, 0.3, -0.3), box(0.06, 0.6, 0.06, '#374151', 0.5, 0.3, 0.3)); break
      case 'round_table': g = group(cyl(0.75, 0.75, 0.05, '#f1f5f9', 0, 0.72, 0, 28), cyl(0.06, 0.2, 0.7, '#475569', 0, 0.35, 0, 10)); break
      case 'whiteboard': g = group(box(1.8, 1.1, 0.04, '#ffffff', 0, 1.4, 0), box(1.0, 0.04, 0.01, '#2563eb', -0.2, 1.6, 0.03, false), box(0.7, 0.04, 0.01, '#dc2626', 0.1, 1.4, 0.03, false)); break
      case 'tv': { const s = screen(1.6, 0.9, accent); s.position.y = 1.5; g = group(s); break }
      case 'bookshelf': g = group(box(0.9, 1.8, 0.35, '#d6c3a5', 0, 0.9, 0), box(0.8, 0.25, 0.3, '#2563eb', 0, 0.5, 0.02), box(0.8, 0.25, 0.3, '#ea580c', 0, 1.0, 0.02), box(0.8, 0.25, 0.3, '#059669', 0, 1.5, 0.02)); break
      case 'cabinet':
      case 'locker': g = box(0.6, 1.2, 0.45, '#cbd5e1', 0, 0.6, 0); break
      case 'server': g = group(box(0.6, 1.6, 0.7, '#1e1b4b', 0, 0.8, 0), box(0.05, 0.05, 0.01, mat('#22c55e', { emissive: '#22c55e', intensity: 1.5 }), 0.15, 1.3, 0.36, false)); break
      case 'mailbox': g = group(box(0.5, 0.4, 0.3, c, 0, 1.0, 0), cyl(0.03, 0.03, 0.8, '#6b7280', 0, 0.4, 0, 6)); break
      case 'printer': g = group(box(0.6, 0.4, 0.5, '#e5e7eb', 0, 0.75, 0), box(0.6, 0.55, 0.5, '#9ca3af', 0, 0.28, 0)); break
      case 'coffee': g = group(box(1.2, 0.9, 0.6, '#f8fafc', 0, 0.45, 0), box(0.35, 0.45, 0.35, '#111827', -0.25, 1.12, 0)); break
      case 'fridge': g = box(0.7, 1.8, 0.65, '#e5e7eb', 0, 0.9, 0); break
      case 'microwave': g = group(box(0.8, 0.9, 0.6, '#f8fafc', 0, 0.45, 0), box(0.5, 0.3, 0.4, '#374151', 0, 1.05, 0)); break
      case 'lamp': g = group(cyl(0.02, 0.02, 1.4, '#111827', 0, 0.7, 0, 6), cyl(0.15, 0.25, 0.2, mat('#fef3c7', { emissive: '#fde68a', intensity: 0.6 }), 0, 1.45, 0, 12)); break
      case 'partition': g = box(1.5, 1.0, 0.06, mat('#cbd5e1', { rough: 0.9 }), 0, 0.5, 0); break
      case 'phone_booth': g = group(box(1.1, 2.1, 1.1, mat('#e2e8f0', { opacity: 0.5, rough: 0.2 }), 0, 1.05, 0), box(1.1, 0.1, 1.1, accent, 0, 2.12, 0)); break
      case 'rug': g = box(2.6, 0.01, 1.8, '#e2e8f0', 0, 0.02, 0, false); break
      case 'reception_desk': g = group(box(2.6, 1.05, 0.8, '#f8fafc', 0, 0.525, 0), box(2.6, 0.5, 0.02, c, 0, 0.6, 0.41, false), box(2.7, 0.05, 0.9, '#e5e7eb', 0, 1.07, 0)); break
      default: g = box(0.5, 0.8, 0.4, '#cbd5e1', 0, 0.4, 0)
    }
    if (!g) return null
    const holder = new THREE.Group()
    holder.add(g)
    holder.position.set(p.x, 0, p.z)
    holder.rotation.y = p.rotation
    if (p.scale && p.kind !== 'plant') holder.scale.setScalar(p.scale)
    return holder
  }

  function floorText(text: string, color: string, size: 'zone' | 'bay' = 'zone') {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = size === 'bay' ? 'bold 150px system-ui, sans-serif' : '800 72px system-ui, sans-serif'
    ctx.font = font
    const width = Math.ceil(ctx.measureText(text).width + 40)
    canvas.width = width
    canvas.height = size === 'bay' ? 180 : 100
    ctx.font = font
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.globalAlpha = size === 'bay' ? 0.85 : 0.9
    ctx.fillText(text, width / 2, canvas.height / 2 + 4)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const h = size === 'bay' ? 0.9 : 0.6
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry((width / canvas.height) * h, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    plane.rotation.set(-Math.PI / 2, 0, Math.PI)
    plane.position.y = 0.035
    plane.renderOrder = 2
    return plane
  }

  /** Enseigne verticale au-dessus d’une porte, lisible depuis l’entrée (−z). */
  function sign(text: string, color: string) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = '800 56px system-ui, sans-serif'
    ctx.font = font
    const width = Math.ceil(ctx.measureText(text).width + 70)
    canvas.width = width
    canvas.height = 96
    ctx.font = font
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, 96)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 14, 96)
    ctx.fillStyle = '#0f172a'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 36, 52)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const h = 0.62
    const plane = new THREE.Mesh(new THREE.PlaneGeometry((width / 96) * h, h), new THREE.MeshBasicMaterial({ map: tex }))
    plane.rotation.y = Math.PI
    return plane
  }

  function tag(title: string, sub: string | undefined, color: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = sub ? 200 : 120
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.strokeStyle = color
    ctx.lineWidth = 6
    const r = 28
    ctx.beginPath()
    ctx.moveTo(r, 4)
    ctx.arcTo(636, 4, 636, canvas.height - 4, r)
    ctx.arcTo(636, canvas.height - 4, 4, canvas.height - 4, r)
    ctx.arcTo(4, canvas.height - 4, 4, 4, r)
    ctx.arcTo(4, 4, 636, 4, r)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 54px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title.slice(0, 22), 320, sub ? 66 : 62)
    if (sub) {
      ctx.fillStyle = '#475569'
      ctx.font = '40px system-ui, sans-serif'
      ctx.fillText(sub.slice(0, 30), 320, 146)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
    sprite.scale.set(2.4, (2.4 * canvas.height) / canvas.width, 1)
    sprite.renderOrder = 10
    return sprite
  }

  return { mat, box, cyl, group, person, desk, prop, floorText, sign, tag, plant }
}
