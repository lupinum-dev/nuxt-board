import type { Bounds, Camera, Point } from './types.js'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpCamera(from: Camera, to: Camera, t: number): Camera {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    z: lerp(from.z, to.z, t),
  }
}

export function screenToWorld(point: Point, camera: Camera): Point {
  return {
    x: point.x / camera.z - camera.x,
    y: point.y / camera.z - camera.y,
  }
}

export function worldToScreen(point: Point, camera: Camera): Point {
  return {
    x: (point.x + camera.x) * camera.z,
    y: (point.y + camera.y) * camera.z,
  }
}

export function getVisibleBounds(
  width: number,
  height: number,
  camera: Camera,
): Bounds {
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera)
  const bottomRight = screenToWorld({ x: width, y: height }, camera)
  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  }
}

export function pointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  )
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  )
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY
  )
}

export function getBoundsFromPoints(a: Point, b: Point): Bounds {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
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
    y: snapValue(point.y, step),
  }
}

export function snapBounds(bounds: Bounds, step: number): Bounds {
  return {
    minX: snapValue(bounds.minX, step),
    minY: snapValue(bounds.minY, step),
    maxX: snapValue(bounds.maxX, step),
    maxY: snapValue(bounds.maxY, step),
  }
}

export function snapSize(value: number, step: number, min: number): number {
  return Math.max(min, snapValue(value, step))
}

export function zoomCameraAtScreenPoint(
  screenPoint: Point,
  delta: number,
  camera: Camera,
  min: number,
  max: number,
): Camera {
  const nextZoom = clamp(camera.z * Math.pow(2, -delta * 0.01), min, max)
  const before = screenToWorld(screenPoint, camera)
  const after = {
    x: screenPoint.x / nextZoom - camera.x,
    y: screenPoint.y / nextZoom - camera.y,
  }
  return {
    x: camera.x + (after.x - before.x),
    y: camera.y + (after.y - before.y),
    z: nextZoom,
  }
}
