declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Group } from 'three'

  export class Viewer {
    threeScene?: Group | null
    camera?: unknown
    splatMesh?: unknown
    addSplatScene(path: string, opts?: Record<string, unknown>): Promise<void>
    start(): void
    dispose(): void
    onSplatMeshChanged(cb: () => void): void
  }

  export class DropInViewer extends Group {
    viewer: Viewer
    constructor(options?: Record<string, unknown>)
    addSplatScene(path: string, options?: Record<string, unknown>): Promise<unknown>
    addSplatScenes(scenes: Array<Record<string, unknown>>, showLoadingUI?: boolean): Promise<unknown>
  }

  export class OrbitControls {
    constructor(camera: unknown, domElement: HTMLElement)
  }
}
