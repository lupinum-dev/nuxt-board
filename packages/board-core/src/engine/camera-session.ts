import { getBoundsFromNode } from '../hierarchy.js'
import { clamp, lerpCamera } from '../math.js'
import {
  AnimationCancelled,
  getAnimationFrameDriver,
} from '../helpers/animation.js'
import { validateCamera } from './options.js'
import type {
  BoardNode,
  Bounds,
  Camera,
  NodeId,
  Point,
  ZoomSettings,
} from '../types.js'

interface CameraSessionDeps {
  getCamera(): Camera
  getNodes(): Iterable<BoardNode>
  getViewportSize(): Point
  setCamera(camera: Camera): void
  zoom: ZoomSettings
}

export function createCameraSession(deps: CameraSessionDeps) {
  let animationToken = 0

  function cancelAnimations(): void {
    animationToken += 1
  }

  async function animateTo(target: Camera): Promise<void> {
    validateCamera(target)
    animationToken += 1
    const token = animationToken
    const start = { ...deps.getCamera() }
    const started = performance.now()
    const duration = 280
    const { raf } = getAnimationFrameDriver()

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (token !== animationToken) {
          reject(new AnimationCancelled())
          return
        }
        const elapsed = performance.now() - started
        const t = clamp(elapsed / duration, 0, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        deps.setCamera(lerpCamera(start, target, eased))
        if (t < 1) raf(tick)
        else resolve()
      }
      raf(tick)
    })
  }

  function computeFit(
    ids: readonly NodeId[] | null,
    padding = 40,
  ): Camera | null {
    const idSet = ids ? new Set(ids) : null
    const source = Array.from(deps.getNodes()).filter(
      (node) => node.visible && (!idSet || idSet.has(node.id)),
    )
    if (source.length === 0) return null

    const bounds = source.reduce<Bounds>((acc, node) => {
      const current = getBoundsFromNode(node)
      return {
        minX: Math.min(acc.minX, current.minX),
        minY: Math.min(acc.minY, current.minY),
        maxX: Math.max(acc.maxX, current.maxX),
        maxY: Math.max(acc.maxY, current.maxY),
      }
    }, getBoundsFromNode(source[0]!))
    const viewport = deps.getViewportSize()
    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const zoomLevel = clamp(
      Math.min(
        (viewport.x - padding * 2) / width,
        (viewport.y - padding * 2) / height,
      ),
      deps.zoom.min,
      deps.zoom.max,
    )
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    }
    return {
      x: viewport.x / (2 * zoomLevel) - center.x,
      y: viewport.y / (2 * zoomLevel) - center.y,
      z: zoomLevel,
    }
  }

  return { animateTo, cancelAnimations, computeFit }
}
