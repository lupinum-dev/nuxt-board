import { computed, defineComponent, h, shallowRef, watch, type PropType } from 'vue'
import {
  boundsIntersect,
  asEdgeId,
  type Bounds,
  type BoardEngine,
  type BoardNode,
  type BoardPlugin,
  type EdgeId,
  type NodeData,
  type NodeId,
  type Point
} from '@lupinum/board-core'
import { useBoardEngine } from '@lupinum/vue-board'

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'
export type ConnectionRouting = 'bezier' | 'step' | 'straight'

export interface AnchorPosition {
  side: AnchorSide
  offset: number
}

export interface BoardEdge<T = Record<string, unknown>> {
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

export interface ConnectionsExtension {
  createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
    input: Omit<BoardEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId; zIndex?: number }
  ): BoardEdge<T>
  deleteEdge(id: EdgeId): void
  getEdges(): BoardEdge[]
  getEdgesFrom(id: NodeId): BoardEdge[]
  getEdgesTo(id: NodeId): BoardEdge[]
  getEdgesBetween(from: NodeId, to: NodeId): BoardEdge[]
}

declare module '@lupinum/board-core' {
  interface BoardEventMap<R extends import('@lupinum/board-core').NodeTypeRegistry = import('@lupinum/board-core').NodeTypeRegistry> {
    'edge:created': (edge: BoardEdge) => void
    'edge:deleted': (edgeId: EdgeId) => void
  }

  interface BoardEngineExtensions<R extends import('@lupinum/board-core').NodeTypeRegistry = import('@lupinum/board-core').NodeTypeRegistry> {
    connections: ConnectionsExtension
  }
}

function cloneEdge<T>(edge: BoardEdge<T>): BoardEdge<T> {
  return {
    ...edge,
    data: structuredClone(edge.data)
  }
}

export function connectionPlugin(options: ConnectionPluginOptions = {}): BoardPlugin {
  const routing = options.routing ?? 'bezier'

  return {
    name: 'connections',
    install(engine) {
      const edges = new Map<EdgeId, BoardEdge>()
      let nextZIndex = 1

      const api: ConnectionsExtension = {
        createEdge<T extends Record<string, unknown> = Record<string, unknown>>(
          input: Omit<BoardEdge<T>, 'id' | 'zIndex'> & { id?: EdgeId; zIndex?: number }
        ) {
          return engine.runCommand('edge:create', [input], () => {
            if (!engine.hasNode(input.from)) {
              throw new Error(`Cannot create edge: source node "${input.from}" does not exist.`)
            }
            if (!engine.hasNode(input.to)) {
              throw new Error(`Cannot create edge: target node "${input.to}" does not exist.`)
            }
            const edge: BoardEdge<T> = {
              id: input.id ?? asEdgeId(crypto.randomUUID()),
              from: input.from,
              to: input.to,
              fromAnchor: input.fromAnchor,
              toAnchor: input.toAnchor,
              data: structuredClone(input.data ?? ({} as T)),
              zIndex: input.zIndex ?? nextZIndex++
            }
            nextZIndex = Math.max(nextZIndex, edge.zIndex + 1)
            edges.set(edge.id, edge)
            const cloned = cloneEdge(edge)
            engine.emit('edge:created', cloned)
            return cloned
          }) as BoardEdge<T>
        },
        deleteEdge(id) {
          if (!edges.has(id)) {
            return
          }
          engine.runCommand('edge:delete', [id], () => {
            edges.delete(id)
            engine.emit('edge:deleted', id)
          })
        },
        getEdges() {
          return Array.from(edges.values(), (edge) => cloneEdge(edge))
        },
        getEdgesFrom(id) {
          return api.getEdges().filter((edge) => edge.from === id)
        },
        getEdgesTo(id) {
          return api.getEdges().filter((edge) => edge.to === id)
        },
        getEdgesBetween(from, to) {
          return api.getEdges().filter((edge) => edge.from === from && edge.to === to)
        }
      }

      engine.extend('connections', api)
      ;(engine.ext.connections as ConnectionsExtension & { __routing?: ConnectionRouting }).__routing = routing

      const unsubscribe = engine.on('node:deleted', (id) => {
        // Cascade: collect first to avoid mutation-during-iteration, then remove directly.
        // We bypass runCommand here because this is a side effect of deleteNode, not a
        // separate user action — the history plugin captures edge state as part of the
        // parent command's extras, so routing this through a nested command would corrupt it.
        const toDelete = Array.from(edges.values()).filter((edge) => edge.from === id || edge.to === id)
        for (const edge of toDelete) {
          edges.delete(edge.id)
          engine.emit('edge:deleted', edge.id)
        }
      })

      return () => {
        unsubscribe()
      }
    }
  }
}

export function resolveAnchorPoint(node: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>, anchor?: AnchorPosition): Point {
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

export function getVisibleEdges(engine: BoardEngine, bounds: Bounds): BoardEdge[] {
  const nodes = engine.$nodes.get()
  return engine.ext.connections.getEdges().filter((edge) => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from || !to) {
      return false
    }
    return boundsIntersect(bounds, getEdgeBounds(resolveAnchorPoint(from, edge.fromAnchor), resolveAnchorPoint(to, edge.toAnchor)))
  })
}

export const BoardConnectionLayer = defineComponent({
  name: 'BoardConnectionLayer',
  props: {
    engine: {
      type: Object as PropType<BoardEngine | null>,
      default: null
    },
    routing: {
      type: String as PropType<ConnectionRouting>,
      default: 'bezier'
    }
  },
  setup(props, { slots }) {
    const injected = useBoardEngine()
    const engine = computed(() => props.engine ?? injected.engine)
    const version = shallowRef(0)

    let versionDirty = false
    function scheduleVersion(): void {
      if (!versionDirty) {
        versionDirty = true
        queueMicrotask(() => {
          version.value += 1
          versionDirty = false
        })
      }
    }

    watch(
      engine,
      (current, _prev, onCleanup) => {
        const unsubscribes = [
          current.on('edge:created', scheduleVersion),
          current.on('edge:deleted', scheduleVersion),
          current.$nodes.subscribe(() => scheduleVersion())
        ]
        onCleanup(() => {
          for (const unsubscribe of unsubscribes) {
            unsubscribe()
          }
        })
      },
      { immediate: true }
    )

    const paths = computed(() => {
      void version.value
      const nodes = injected.$nodes.value
      return engine.value.ext.connections.getEdges().map((edge) => {
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
          class: 'board-connection-layer',
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
            : h('path', { d: entry.path, stroke: 'currentColor', fill: 'none', 'stroke-width': 2 })
        )
      )
  }
})
