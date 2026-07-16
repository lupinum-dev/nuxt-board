import type { BoardNode, NodeId, Point } from '@lupinum/board-core'
import { anchorForPointOnNode, clamp01 } from './layer-helpers.js'
import type { AnchorSide } from './types.js'

export interface ConnectionNodeHandle {
  nodeId: NodeId
  side: AnchorSide
  offset: number
}

export function edgeIdFromTarget(target: EventTarget | null): string | null {
  return target instanceof Element
    ? (target.closest<HTMLElement>('[data-connection-edge-id]')?.dataset
        .connectionEdgeId ?? null)
    : null
}

export function nodeHandleFromTarget(
  target: EventTarget | null,
): ConnectionNodeHandle | null {
  if (!(target instanceof Element)) return null
  const element = target.closest<HTMLElement>(
    '[data-connection-node-id][data-connection-side]',
  )
  if (!element?.dataset.connectionNodeId || !element.dataset.connectionSide) {
    return null
  }
  return {
    nodeId: element.dataset.connectionNodeId as NodeId,
    side: element.dataset.connectionSide as AnchorSide,
    offset: clamp01(Number(element.dataset.connectionOffset ?? 0.5)),
  }
}

export function sameEdgeTarget(
  target: EventTarget | null,
  edgeId: string,
): boolean {
  return edgeIdFromTarget(target) === edgeId
}

export function resolveNodeHandleAtWorldPoint(
  nodes: Iterable<BoardNode>,
  point: Point,
  threshold: number,
  cornerClearance: number,
): ConnectionNodeHandle | null {
  let best: ConnectionNodeHandle | null = null
  let bestZIndex = -Infinity

  for (const node of nodes) {
    if (!node.visible || node.zIndex <= bestZIndex) continue

    const left = node.x
    const right = node.x + node.width
    const top = node.y
    const bottom = node.y + node.height
    if (
      point.x < left - threshold ||
      point.x > right + threshold ||
      point.y < top - threshold ||
      point.y > bottom + threshold
    ) {
      continue
    }

    const clearance = Math.min(
      cornerClearance,
      Math.min(node.width, node.height) / 3,
    )
    let closestSide: AnchorSide | null = null
    let closestDistance = Infinity
    const consider = (side: AnchorSide, distance: number): void => {
      if (distance < closestDistance) {
        closestSide = side
        closestDistance = distance
      }
    }

    if (point.x >= left + clearance && point.x <= right - clearance) {
      consider('top', Math.abs(point.y - top))
      consider('bottom', Math.abs(point.y - bottom))
    }
    if (point.y >= top + clearance && point.y <= bottom - clearance) {
      consider('left', Math.abs(point.x - left))
      consider('right', Math.abs(point.x - right))
    }

    if (closestSide && closestDistance <= threshold) {
      best = {
        nodeId: node.id,
        ...anchorForPointOnNode(node, closestSide, point),
      }
      bestZIndex = node.zIndex
    }
  }

  return best
}
