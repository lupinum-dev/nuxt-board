import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  BoardEngine,
  BoardNode as BoardNodeState,
  Camera,
  NodeId,
  Point,
} from '@lupinum/board-core'

export type NodeLod = 'full' | 'simple' | 'hidden'
export type LodNode = BoardNodeState & { lod: NodeLod }

export interface UseLodCullingOptions {
  engine: BoardEngine
  nodes: Ref<ReadonlyMap<NodeId, BoardNodeState>>
  camera: Ref<Camera>
  selectionSet: Ref<ReadonlySet<NodeId>>
  viewportSize: Ref<Point>
  cullMargin: Ref<number>
}

function getNodeLod(
  node: BoardNodeState,
  zoom: number,
  selected: boolean,
): NodeLod {
  if (selected) return 'full'
  const screenSize = Math.max(node.width, node.height) * zoom
  if (screenSize < 8) return 'hidden'
  if (screenSize < 120) return 'simple'
  return 'full'
}

export function useLodCulling(
  options: UseLodCullingOptions,
): ComputedRef<LodNode[]> {
  return computed(() => {
    const canCull =
      options.viewportSize.value.x > 0 && options.viewportSize.value.y > 0
    const bounds = canCull
      ? options.engine.getVisibleBounds(
          options.viewportSize.value.x,
          options.viewportSize.value.y,
        )
      : null
    const zoom = options.camera.value.z
    const sel = options.selectionSet.value
    const margin = options.cullMargin.value
    const result: LodNode[] = []
    for (const node of options.nodes.value.values()) {
      if (!node.visible) continue
      if (
        bounds &&
        (node.x + node.width <= bounds.minX - margin ||
          node.x >= bounds.maxX + margin ||
          node.y + node.height <= bounds.minY - margin ||
          node.y >= bounds.maxY + margin)
      ) {
        continue
      }
      const lod = getNodeLod(node, zoom, sel.has(node.id))
      if (lod !== 'hidden') {
        result.push({ ...node, lod })
      }
    }
    return result
  })
}
