import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OFFICE_HYPER } from '@/lib/office-hyper'

const loader = new GLTFLoader()
let bodyTemplate: THREE.Group | null = null
let bodyPromise: Promise<THREE.Group | null> | null = null

/** Charge une fois le corps atlas.glb pour cloner chaque agent. */
export function loadAtlasBodyTemplate(): Promise<THREE.Group | null> {
  if (bodyTemplate) return Promise.resolve(bodyTemplate.clone(true) as THREE.Group)
  if (bodyPromise) {
    return bodyPromise.then((t) => (t ? (t.clone(true) as THREE.Group) : null))
  }
  bodyPromise = new Promise((resolve) => {
    loader.load(
      '/avatars/atlas.glb',
      (gltf) => {
        const root = gltf.scene
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true
            obj.frustumCulled = false
          }
        })
        // Normalise ~1.15 m assis/debout
        const box = new THREE.Box3().setFromObject(root)
        const size = box.getSize(new THREE.Vector3())
        const scale = 1.05 / Math.max(size.y, 0.001)
        root.scale.setScalar(scale)
        const center = box.getCenter(new THREE.Vector3())
        root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
        bodyTemplate = root
        resolve(root.clone(true) as THREE.Group)
      },
      undefined,
      () => resolve(null),
    )
  })
  return bodyPromise
}

export function applyPortraitToHead(group: THREE.Object3D, faceUrl: string | null, color: string) {
  if (!faceUrl) return
  const tex = new THREE.TextureLoader().load(faceUrl)
  tex.colorSpace = THREE.SRGBColorSpace
  const head = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 28),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0 }),
  )
  head.position.set(0, 1.05, 0.18)
  head.name = 'atlas-portrait-billboard'
  group.add(head)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.17, 0.2, 28),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  )
  ring.position.copy(head.position)
  ring.position.z -= 0.01
  group.add(ring)
}

export async function createHyperAgent(opts: {
  face: string | null
  color: string
  name: string
  status: string
}): Promise<THREE.Group> {
  const g = new THREE.Group()
  const body = await loadAtlasBodyTemplate()
  if (body) {
    const clone = body.clone(true) as THREE.Group
    // Teinte légère selon département
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const mat of mats) {
          if (mat instanceof THREE.MeshStandardMaterial && /shirt|cloth|body|torso/i.test(obj.name)) {
            mat.color = new THREE.Color(opts.color).lerp(mat.color, 0.55)
          }
        }
      }
    })
    g.add(clone)
  } else {
    // fallback capsule
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15, 0.32, 4, 10),
      new THREE.MeshStandardMaterial({ color: opts.color, roughness: 0.55 }),
    )
    torso.position.y = 0.58
    g.add(torso)
  }
  applyPortraitToHead(g, opts.face, opts.color)
  if (opts.status === 'offline') g.visible = false

  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 256
  labelCanvas.height = 64
  const ctx = labelCanvas.getContext('2d')!
  ctx.fillStyle = '#0f172a'
  round(ctx, 8, 8, 240, 48, 16)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(opts.name.split(' ')[0] || opts.name, 128, 34)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(labelCanvas),
      transparent: true,
      depthTest: false,
    }),
  )
  sprite.position.set(0, 1.45, 0)
  sprite.scale.set(1.1, 0.28, 1)
  g.add(sprite)
  return g
}

function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export const AGENT_MESH = {
  bodyUrl: '/avatars/atlas.glb',
  flameUrl: OFFICE_HYPER.flameMeshUrl,
  splatUrl: OFFICE_HYPER.splatAvatarUrl,
} as const
