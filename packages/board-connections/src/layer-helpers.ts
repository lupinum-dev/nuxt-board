import type { BoardEngine, BoardNode, NodeId, Point } from '@lupinum/board-core'
import type { AnchorPosition, AnchorSide } from './types'

export interface EdgeRenderLayerContext {
  toLocalPoint(clientX: number, clientY: number): Point
}

export type HoveredNodeHandle = {
  nodeId: NodeId
  side: AnchorSide
  offset: number
}

export const CONNECTION_DRAG_THRESHOLD = 6
export const EDGE_STROKE_LOD_FADE_START = 0.95
export const EDGE_STROKE_LOD_SOFTEN_AT = 0.45
export const EDGE_ARROW_MARKER_SIZE = 18
export const EDGE_ARROW_SCREEN_SIZE = 16
export const EDGE_ARROW_MIN_SCREEN_SIZE = 10
export const EDGE_ARROW_MAX_SCREEN_SIZE = 22
export const EDGE_LABEL_MIN_ZOOM = 0.1
export const EDGE_LABEL_MAX_SCREEN_WIDTH = 220
export const EDGE_LABEL_HORIZONTAL_PADDING = 20
export const EDGE_LABEL_IDLE_HEIGHT = 18
export const EDGE_LABEL_ACTIVE_HEIGHT = 24
export const EDGE_LABEL_SCREEN_FONT_SIZE = 14
export const EDGE_LABEL_ACTIVE_FONT_SIZE = 13

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function resolveLodAmount(
  zoom: number,
  fadeStart: number,
  minDetailAt: number,
): number {
  if (zoom >= fadeStart) {
    return 1
  }
  if (zoom <= minDetailAt) {
    return 0
  }
  return clamp01((zoom - minDetailAt) / (fadeStart - minDetailAt))
}

export function resolveArrowScreenSize(zoom: number): number {
  return Math.max(
    EDGE_ARROW_MIN_SCREEN_SIZE,
    Math.min(
      EDGE_ARROW_MAX_SCREEN_SIZE,
      EDGE_ARROW_SCREEN_SIZE * Math.sqrt(zoom),
    ),
  )
}

export function edgeIdFromTarget(target: EventTarget | null): string | null {
  return target instanceof Element
    ? (target.closest<HTMLElement>('[data-connection-edge-id]')?.dataset
        .connectionEdgeId ?? null)
    : null
}

export function nodeHandleFromTarget(
  target: EventTarget | null,
): HoveredNodeHandle | null {
  if (!(target instanceof Element)) {
    return null
  }
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

export function worldPointFromClient(
  ctx: EdgeRenderLayerContext,
  engine: BoardEngine,
  clientX: number,
  clientY: number,
): Point {
  return engine.screenToWorld(ctx.toLocalPoint(clientX, clientY))
}

export function floatingNodeAt(
  point: Point,
  role: 'source' | 'target',
): Pick<BoardNode, 'id' | 'x' | 'y' | 'width' | 'height'> {
  return {
    id: `floating-${role}` as NodeId,
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  }
}

export function anchorForPointOnNode(
  node: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
  side: AnchorSide,
  point: Point,
): AnchorPosition {
  const offset =
    side === 'top' || side === 'bottom'
      ? clamp01((point.x - node.x) / Math.max(node.width, 1))
      : clamp01((point.y - node.y) / Math.max(node.height, 1))
  return { side, offset }
}

export function sameAnchor(
  left: AnchorPosition | undefined,
  right: AnchorPosition | null,
): boolean {
  return Boolean(
    left &&
    right &&
    left.side === right.side &&
    Math.abs(left.offset - right.offset) < 0.001,
  )
}
