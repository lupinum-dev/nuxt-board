import { computed, inject, toValue, type MaybeRefOrGetter } from 'vue'
import {
  getBoundsFromPoints,
  getVisibleBounds,
  type BoardNode,
  type NodeId,
  type ResizeHandle,
} from '@lupinum/board-core'
import { getBoardInteractionAdapter } from '@lupinum/board-core/internal'
import { boardEngineKey } from './context.js'

/** Access the board context provided by `BoardRoot`. */
export function useBoardEngine() {
  const context = inject(boardEngineKey)
  if (!context) {
    throw new Error('Board composables must be used under <BoardRoot>.')
  }
  return context
}

/** Reactive camera state for the current board. */
export function useCamera() {
  const { $camera } = useBoardEngine()
  return computed(() => $camera.value)
}

/** Reactive node map for the current board. */
export function useNodes() {
  const { $nodes } = useBoardEngine()
  return computed(() => $nodes.value)
}

/** Reactive selection ids as an ordered array. */
export function useSelection() {
  const { $selection } = useBoardEngine()
  return computed<readonly NodeId[]>(() => [...$selection.value])
}

/** Reactive interaction state for the current board gesture. */
export function useInteraction() {
  const { $interaction } = useBoardEngine()
  return computed(() => $interaction.value)
}

/** Compute the currently visible world bounds from camera and viewport size. */
export function useVisibleBounds() {
  const { $camera, viewportSize } = useBoardEngine()
  return computed(() =>
    getVisibleBounds(viewportSize.value.x, viewportSize.value.y, $camera.value),
  )
}

/** Filter visible nodes to the viewport with an optional culling margin. */
export function useVisibleNodes(margin = 200) {
  const { $nodes, viewportSize, $camera } = useBoardEngine()
  return computed<readonly BoardNode[]>(() => {
    const canCull = viewportSize.value.x > 0 && viewportSize.value.y > 0
    const bounds = canCull
      ? getVisibleBounds(
          viewportSize.value.x,
          viewportSize.value.y,
          $camera.value,
        )
      : null
    return Array.from($nodes.value.values()).filter((node) => {
      if (!node.visible) {
        return false
      }
      if (!bounds) {
        return true
      }
      return (
        node.x + node.width > bounds.minX - margin &&
        node.x < bounds.maxX + margin &&
        node.y + node.height > bounds.minY - margin &&
        node.y < bounds.maxY + margin
      )
    })
  })
}

/** CSS custom properties used by `BoardGrid` to render the active grid pattern. */
export function useGridStyle() {
  const { $camera, resolvedGrid } = useBoardEngine()

  function modulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor
  }

  return computed(() => {
    const zoom = $camera.value.z
    const minorWorldStep = resolvedGrid.value.size
    const majorWorldStep =
      resolvedGrid.value.size * resolvedGrid.value.majorEvery
    const minorScreenStep = minorWorldStep * zoom
    const majorScreenStep = majorWorldStep * zoom
    const cameraScreenX = $camera.value.x * zoom
    const cameraScreenY = $camera.value.y * zoom
    const minorAlpha =
      minorScreenStep < 6
        ? 0
        : minorScreenStep < 12
          ? resolvedGrid.value.minorOpacity * 0.57
          : resolvedGrid.value.minorOpacity
    const majorAlpha =
      majorScreenStep < 8
        ? resolvedGrid.value.majorOpacity * 0.44
        : resolvedGrid.value.majorOpacity

    return {
      '--grid-minor-size': `${minorScreenStep}px`,
      '--grid-major-size': `${majorScreenStep}px`,
      '--grid-minor-x': `${modulo(cameraScreenX, minorScreenStep)}px`,
      '--grid-minor-y': `${modulo(cameraScreenY, minorScreenStep)}px`,
      '--grid-major-x': `${modulo(cameraScreenX, majorScreenStep)}px`,
      '--grid-major-y': `${modulo(cameraScreenY, majorScreenStep)}px`,
      '--grid-minor-color': `rgba(var(--board-grid-minor-rgb, 148 163 184) / ${minorAlpha})`,
      '--grid-major-color': `rgba(var(--board-grid-major-rgb, 71 85 105) / ${majorAlpha})`,
      '--grid-mask-image': resolvedGrid.value.fadeEdges
        ? 'radial-gradient(circle at center, black 68%, transparent 100%)'
        : 'none',
    }
  })
}

/**
 * Access a single node plus common node-level actions used by renderers.
 *
 * The returned helpers intentionally stay thin over the engine command API.
 */
export function useNode(id: MaybeRefOrGetter<NodeId>) {
  const { engine, $nodes, $selection, $interaction, toLocalPoint } =
    useBoardEngine()
  const interaction = getBoardInteractionAdapter(engine)
  const nodeId = computed(() => toValue(id))

  const node = computed(() => {
    const current = $nodes.value.get(nodeId.value)
    if (!current) {
      throw new Error(
        `Node "${nodeId.value}" is not present in the current snapshot.`,
      )
    }
    return current
  })

  const selected = computed(() => $selection.value.has(nodeId.value))
  const editing = computed(
    () =>
      $interaction.value.mode === 'editing-text' &&
      $interaction.value.nodeId === nodeId.value,
  )
  const locked = computed(() => node.value.locked)

  const style = computed(() => ({
    left: `${node.value.x}px`,
    top: `${node.value.y}px`,
    width: `${node.value.width}px`,
    height: `${node.value.height}px`,
    zIndex: String(node.value.zIndex),
  }))

  return {
    node,
    selected,
    editing,
    locked,
    style,
    beginEdit: () => {
      if (node.value.type === 'text') engine.beginTextEdit(nodeId.value)
    },
    commitText: (text: string) => {
      if (node.value.type === 'text') engine.commitTextEdit(nodeId.value, text)
    },
    startDrag: (event: PointerEvent) =>
      interaction.beginNodeDrag(
        nodeId.value,
        event.pointerId,
        toLocalPoint(event.clientX, event.clientY),
      ),
    startResize: (handle: ResizeHandle, event: PointerEvent) =>
      interaction.beginResize(
        nodeId.value,
        handle,
        event.pointerId,
        toLocalPoint(event.clientX, event.clientY),
      ),
  }
}

/** Screen-space rectangle for the active box-selection gesture, or `null` when idle. */
export function useBoxSelectBounds() {
  const { $interaction } = useBoardEngine()
  return computed(() => {
    const interaction = $interaction.value
    if (interaction.mode !== 'box-select') {
      return null
    }
    return getBoundsFromPoints(
      interaction.startScreenPoint,
      interaction.currentScreenPoint,
    )
  })
}
