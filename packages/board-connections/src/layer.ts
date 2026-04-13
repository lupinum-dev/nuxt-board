import { computed, defineComponent, h, shallowRef, watch, type PropType } from 'vue'
import { type BoardEngine } from '@lupinum/board-core'
import { useBoardEngine } from '@lupinum/vue-board'
import { resolveEdgeRenderState } from './geometry'
import type { AnchorSide, ConnectionRouting, ConnectionsExtension } from './types'

let markerCounter = 0

export const BoardConnectionLayer = defineComponent({
  name: 'BoardConnectionLayer',
  props: {
    engine: {
      type: Object as PropType<BoardEngine | null>,
      default: null
    },
    routing: {
      type: String as PropType<ConnectionRouting | undefined>,
      default: undefined
    }
  },
  setup(props, { slots }) {
    const injected = useBoardEngine()
    const engine = computed(() => props.engine ?? injected.engine)
    const version = shallowRef(0)
    const markerId = `board-connection-arrow-${markerCounter += 1}`
    const sideCache = new Map<string, { source: AnchorSide; target: AnchorSide }>()

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

    const entries = computed(() => {
      void version.value
      const nodes = injected.$nodes.value
      const currentEngine = engine.value
      const routing =
        props.routing ??
        ((currentEngine.ext.connections as ConnectionsExtension & { __routing?: ConnectionRouting }).__routing ?? 'bezier')
      const nextCache = new Map<string, { source: AnchorSide; target: AnchorSide }>()

      const resolved = currentEngine.ext.connections
        .getEdges()
        .map((edge) => {
          const sourceNode = nodes.get(edge.from)
          const targetNode = nodes.get(edge.to)
          if (!sourceNode || !targetNode) {
            return null
          }

          const previous = sideCache.get(String(edge.id))
          const geometry = resolveEdgeRenderState(edge, sourceNode, targetNode, {
            routing,
            previousSourceSide: previous?.source,
            previousTargetSide: previous?.target
          })

          nextCache.set(String(edge.id), {
            source: geometry.source.side,
            target: geometry.target.side
          })

          return {
            edge,
            source: geometry.source,
            target: geometry.target,
            route: geometry.route
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

      sideCache.clear()
      for (const [edgeId, value] of nextCache) {
        sideCache.set(edgeId, value)
      }

      return resolved
    })

    const needsArrowMarker = computed(() =>
      entries.value.some((entry) => entry.edge.fromEnd === 'arrow' || entry.edge.toEnd === 'arrow')
    )

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
        [
          needsArrowMarker.value
            ? h('defs', [
                h(
                  'marker',
                  {
                    id: markerId,
                    markerWidth: 14,
                    markerHeight: 14,
                    refX: 12,
                    refY: 7,
                    orient: 'auto-start-reverse',
                    markerUnits: 'userSpaceOnUse',
                    viewBox: '0 0 14 14'
                  },
                  [
                    h('path', {
                      d: 'M2,2 L12,7 L2,12 L5.2,7 Z',
                      fill: 'currentColor'
                    })
                  ]
                )
              ])
            : null,
          ...entries.value.map((entry) =>
            slots.edge
              ? slots.edge(entry)
              : h('path', {
                  d: entry.route.path,
                  stroke: entry.edge.color ?? 'currentColor',
                  color: entry.edge.color ?? undefined,
                  fill: 'none',
                  'stroke-width': 2,
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                  'vector-effect': 'non-scaling-stroke',
                  'marker-start': entry.edge.fromEnd === 'arrow' ? `url(#${markerId})` : undefined,
                  'marker-end': entry.edge.toEnd === 'arrow' ? `url(#${markerId})` : undefined
                })
          )
        ]
      )
  }
})

