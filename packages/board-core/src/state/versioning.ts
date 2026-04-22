import type { BoardNode, NodeData } from '../types'

export interface StoredNode<
  TType extends string = string,
  TData extends NodeData = NodeData,
> extends BoardNode<TType, TData> {
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
  const dataChanged = prev.data !== next.data
  return {
    ...next,
    version: prev.version + 1,
    geometryVersion: geometryChanged
      ? prev.geometryVersion + 1
      : prev.geometryVersion,
    dataVersion: dataChanged ? prev.dataVersion + 1 : prev.dataVersion,
  }
}
