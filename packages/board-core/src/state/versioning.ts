import type { BoardNode } from '../types'

export interface StoredNode extends BoardNode {
  readonly version: number
  readonly geometryVersion: number
  readonly dataVersion: number
}

export const ZERO_VERSIONS = {
  version: 0,
  geometryVersion: 0,
  dataVersion: 0,
} as const

export function bumpVersions(prev: StoredNode, next: StoredNode): StoredNode {
  const geometryChanged =
    prev.x !== next.x ||
    prev.y !== next.y ||
    prev.width !== next.width ||
    prev.height !== next.height
  const dataChanged =
    prev.text !== next.text ||
    prev.file !== next.file ||
    prev.subpath !== next.subpath ||
    prev.url !== next.url ||
    prev.label !== next.label ||
    prev.background !== next.background ||
    prev.backgroundStyle !== next.backgroundStyle
  return {
    ...next,
    version: prev.version + 1,
    geometryVersion: geometryChanged
      ? prev.geometryVersion + 1
      : prev.geometryVersion,
    dataVersion: dataChanged ? prev.dataVersion + 1 : prev.dataVersion,
  }
}
