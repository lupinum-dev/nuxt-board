import type { Camera, Point, VisibleBounds } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function screenToWorld(screenPoint: Point, camera: Camera): Point {
  return {
    x: screenPoint.x / camera.z - camera.x,
    y: screenPoint.y / camera.z - camera.y
  }
}

export function snapValue(value: number, step: number): number {
  if (step <= 0) {
    return value
  }
  return Math.round(value / step) * step
}

export function snapPoint(point: Point, step: number): Point {
  return {
    x: snapValue(point.x, step),
    y: snapValue(point.y, step)
  }
}

export function snapSize(value: number, step: number, min: number): number {
  return Math.max(min, snapValue(value, step))
}

export function worldToScreen(worldPoint: Point, camera: Camera): Point {
  return {
    x: (worldPoint.x + camera.x) * camera.z,
    y: (worldPoint.y + camera.y) * camera.z
  }
}

export function getVisibleBounds(
  viewportWidth: number,
  viewportHeight: number,
  camera: Camera
): VisibleBounds {
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera)
  const bottomRight = screenToWorld({ x: viewportWidth, y: viewportHeight }, camera)

  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y
  }
}

export function zoomCameraAtScreenPoint(
  screenPoint: Point,
  delta: number,
  camera: Camera,
  minZoom: number,
  maxZoom: number
): Camera {
  const nextZoom = clamp(camera.z * Math.pow(2, -delta * 0.01), minZoom, maxZoom)
  const before = screenToWorld(screenPoint, camera)
  const after = {
    x: screenPoint.x / nextZoom - camera.x,
    y: screenPoint.y / nextZoom - camera.y
  }

  return {
    x: camera.x + (after.x - before.x),
    y: camera.y + (after.y - before.y),
    z: nextZoom
  }
}
