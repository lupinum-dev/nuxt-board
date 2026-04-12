import { computed, defineComponent, h, onScopeDispose, shallowRef, type PropType } from 'vue'
import {
  boundsIntersect,
  type Bounds,
  type CanvasEngine,
  type CanvasPlugin,
  type CanvasNode,
  type EdgeId,
  type NodeId,
  type Point
} from '@canvas/core'
import { useCanvasEngine } from '@canvas/vue'

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'
export type ConnectionRouting = 'bezier' | 'step' | 'straight'

export interface AnchorPosition {
  side: AnchorSide
  offset: number
}

export interface CanvasEdge<T = Record<string, unknown>> {
  id: EdgeId
  from: NodeId
  to: NodeId
  fromAnchor?: AnchorPosition
  toAnchor?: AnchorPosition
  data: T
  zIndex: number
}

export interface ConnectionPluginOptions {
  routing?: ConnectionRouting
  defaultArrow?: 'none' | 'start' | 'end' | 'both'
  snapDistance?: number
}

declare module '@canvas/core' {
  interface CanvasEventMap {
    'edge:created': (edge: CanvasEdge) => void
    'edge:deleted': (edgeId: EdgeId) => void
  }

  interface CanvasEngine {
    createEdge?: <T extends Record<string, unknown> = Record<string, unknown>>(
      input: Omit<CanvasEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId }
    ) => CanvasEdge<T>
    deleteEdge?: (id: EdgeId) => void
    getEdges?: () => CanvasEdge[]
    getEdgesFrom?: (id: NodeId) => CanvasEdge[]
    getEdgesTo?: (id: NodeId) => CanvasEdge[]
    getEdgesBetween?: (from: NodeId, to: NodeId) => CanvasEdge[]
  }
}

type ExtendedEngine = CanvasEngine & {
  createEdge: <T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<CanvasEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId }
  ) => CanvasEdge<T>
  deleteEdge: (id: EdgeId) => void
  getEdges: () => CanvasEdge[]
  getEdgesFrom: (id: NodeId) => CanvasEdge[]
  getEdgesTo: (id: NodeId) => CanvasEdge[]
  getEdgesBetween: (from: NodeId, to: NodeId) => CanvasEdge[]
}

export function connectionPlugin(options: ConnectionPluginOptions = {}): CanvasPlugin {
  const routing = options.routing ?? 'bezier'

  return {
    name: 'connections',
    install(engine) {
      const target = engine as ExtendedEngine
      const edges = new Map<EdgeId, CanvasEdge>()
      let nextZIndex = 1

      target.createEdge = <T extends Record<string, unknown> = Record<string, unknown>>(
        input: Omit<CanvasEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId }
      ) => {
        const edge: CanvasEdge<T> = {
          id: input.id ?? crypto.randomUUID(),
          from: input.from,
          to: input.to,
          fromAnchor: input.fromAnchor,
          toAnchor: input.toAnchor,
          data: structuredClone(input.data ?? ({} as T)),
          zIndex: nextZIndex++
        }
        edges.set(edge.id, edge)
        engine.emit('edge:created', edge)
        return structuredClone(edge)
      }

      target.deleteEdge = (id) => {
        if (!edges.has(id)) {
          return
        }
        edges.delete(id)
        engine.emit('edge:deleted', id)
      }

      target.getEdges = () => Array.from(edges.values()).map((edge) => structuredClone(edge))
      target.getEdgesFrom = (id) => target.getEdges().filter((edge) => edge.from === id)
      target.getEdgesTo = (id) => target.getEdges().filter((edge) => edge.to === id)
      target.getEdgesBetween = (from, to) =>
        target.getEdges().filter((edge) => edge.from === from && edge.to === to)

      const unsubscribe = engine.on('node:deleted', (id) => {
        for (const edge of edges.values()) {
          if (edge.from === id || edge.to === id) {
            edges.delete(edge.id)
          }
        }
      })

      ;(target as ExtendedEngine & { __connectionRouting?: ConnectionRouting }).__connectionRouting = routing

      return () => {
        unsubscribe()
      }
    }
  }
}

export function resolveAnchorPoint(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, anchor?: AnchorPosition): Point {
  const offset = anchor?.offset ?? 0.5
  switch (anchor?.side ?? 'right') {
    case 'top':
      return { x: node.x + node.width * offset, y: node.y }
    case 'bottom':
      return { x: node.x + node.width * offset, y: node.y + node.height }
    case 'left':
      return { x: node.x, y: node.y + node.height * offset }
    case 'right':
    default:
      return { x: node.x + node.width, y: node.y + node.height * offset }
  }
}

export function routeEdgePath(from: Point, to: Point, routing: ConnectionRouting = 'bezier'): string {
  if (routing === 'straight') {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }
  if (routing === 'step') {
    const midX = (from.x + to.x) / 2
    return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`
  }
  const controlOffset = Math.max(40, Math.abs(to.x - from.x) * 0.4)
  return `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`
}

export function getEdgeBounds(from: Point, to: Point): Bounds {
  return {
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y)
  }
}

export function getVisibleEdges(engine: ExtendedEngine, bounds: Bounds): CanvasEdge[] {
  const nodes = new Map(engine.getSnapshot().nodes.map((node) => [node.id, node]))
  return engine.getEdges().filter((edge) => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from || !to) {
      return false
    }
    return boundsIntersect(bounds, getEdgeBounds(resolveAnchorPoint(from, edge.fromAnchor), resolveAnchorPoint(to, edge.toAnchor)))
  })
}

export const CanvasConnectionLayer = defineComponent({
  name: 'CanvasConnectionLayer',
  props: {
    engine: {
      type: Object as PropType<ExtendedEngine | null>,
      default: null
    },
    routing: {
      type: String as PropType<ConnectionRouting>,
      default: 'bezier'
    }
  },
  setup(props, { slots }) {
    const injected = useCanvasEngine()
    const engine = computed(() => props.engine ?? (injected.engine as ExtendedEngine))
    const version = shallowRef(0)

    const unsubscribes = [
      engine.value.on('edge:created', () => {
        version.value += 1
      }),
      engine.value.on('edge:deleted', () => {
        version.value += 1
      }),
      engine.value.on('node:updated', () => {
        version.value += 1
      }),
      engine.value.on('node:deleted', () => {
        version.value += 1
      })
    ]

    onScopeDispose(() => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe()
      }
    })

    const paths = computed(() => {
      void version.value
      const snapshot = injected.snapshot.value
      const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]))
      return engine.value.getEdges().map((edge) => {
        const from = nodes.get(edge.from)
        const to = nodes.get(edge.to)
        if (!from || !to) {
          return null
        }
        const fromPoint = resolveAnchorPoint(from, edge.fromAnchor)
        const toPoint = resolveAnchorPoint(to, edge.toAnchor)
        return {
          edge,
          from: fromPoint,
          to: toPoint,
          path: routeEdgePath(fromPoint, toPoint, props.routing)
        }
      }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    })

    return () =>
      h(
        'svg',
        {
          class: 'canvas-connection-layer',
          style: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none'
          }
        },
        paths.value.map((entry) =>
          slots.edge
            ? slots.edge(entry)
            : h('path', {
                d: entry.path,
                stroke: 'currentColor',
                fill: 'none',
                'stroke-width': 2
              })
        )
      )
  }
})
