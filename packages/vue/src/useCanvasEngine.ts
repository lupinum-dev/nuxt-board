import { computed, inject } from 'vue'
import { getBoundsFromPoints, getVisibleBounds } from '@canvas/core'
import { canvasEngineKey } from './context'

export function useCanvasEngine() {
  const context = inject(canvasEngineKey)
  if (!context) {
    throw new Error('Canvas composables must be used under <CanvasRoot>.')
  }
  return context
}

export function useCamera() {
  const { snapshot } = useCanvasEngine()
  return computed(() => snapshot.value.camera)
}

export function useNodes() {
  const { snapshot } = useCanvasEngine()
  return computed(() => snapshot.value.nodes)
}

export function useSelection() {
  const { snapshot } = useCanvasEngine()
  return computed(() => snapshot.value.selection)
}

export function useInteraction() {
  const { snapshot } = useCanvasEngine()
  return computed(() => snapshot.value.interaction)
}

export function useVisibleBounds() {
  const { snapshot, viewportSize } = useCanvasEngine()
  return computed(() => getVisibleBounds(viewportSize.value.x, viewportSize.value.y, snapshot.value.camera))
}

export function useVisibleNodes(margin = 200) {
  const { snapshot, viewportSize } = useCanvasEngine()
  return computed(() => {
    const bounds = getVisibleBounds(viewportSize.value.x, viewportSize.value.y, snapshot.value.camera)
    return snapshot.value.nodes.filter((node) => {
      if (!node.visible) {
        return false
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

export function useGridStyle() {
  const { snapshot, resolvedGrid } = useCanvasEngine()

  function modulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor
  }

  return computed(() => {
    const zoom = snapshot.value.camera.z
    const minorWorldStep = resolvedGrid.value.size
    const majorWorldStep = resolvedGrid.value.size * resolvedGrid.value.majorEvery
    const minorScreenStep = minorWorldStep * zoom
    const majorScreenStep = majorWorldStep * zoom
    const cameraScreenX = snapshot.value.camera.x * zoom
    const cameraScreenY = snapshot.value.camera.y * zoom
    const minorAlpha =
      minorScreenStep < 6 ? 0 : minorScreenStep < 12 ? resolvedGrid.value.minorOpacity * 0.57 : resolvedGrid.value.minorOpacity
    const majorAlpha =
      majorScreenStep < 8 ? resolvedGrid.value.majorOpacity * 0.44 : resolvedGrid.value.majorOpacity

    return {
      '--grid-minor-size': `${minorScreenStep}px`,
      '--grid-major-size': `${majorScreenStep}px`,
      '--grid-minor-x': `${modulo(cameraScreenX, minorScreenStep)}px`,
      '--grid-minor-y': `${modulo(cameraScreenY, minorScreenStep)}px`,
      '--grid-major-x': `${modulo(cameraScreenX, majorScreenStep)}px`,
      '--grid-major-y': `${modulo(cameraScreenY, majorScreenStep)}px`,
      '--grid-minor-color': `rgba(148, 163, 184, ${minorAlpha})`,
      '--grid-major-color': `rgba(71, 85, 105, ${majorAlpha})`,
      '--grid-mask-image': resolvedGrid.value.fadeEdges
        ? 'radial-gradient(circle at center, black 68%, transparent 100%)'
        : 'none'
    }
  })
}

export function useNode(id: string) {
  const { engine, snapshot, toLocalPoint } = useCanvasEngine()

  const node = computed(() => {
    const current = snapshot.value.nodes.find((entry) => entry.id === id)
    if (!current) {
      throw new Error(`Node "${id}" is not present in the current snapshot.`)
    }
    return current
  })

  const selectionSet = computed(() => new Set(snapshot.value.selection))
  const selected = computed(() => selectionSet.value.has(id))
  const editing = computed(
    () => snapshot.value.interaction.mode === 'editing-text' && snapshot.value.interaction.nodeId === id
  )
  const locked = computed(() => node.value.locked)

  const style = computed(() => ({
    left: `${node.value.x}px`,
    top: `${node.value.y}px`,
    width: `${node.value.width}px`,
    height: `${node.value.height}px`,
    zIndex: String(node.value.zIndex)
  }))

  return {
    node,
    selected,
    editing,
    locked,
    style,
    beginEdit: () => engine.beginTextEdit(id),
    commitText: (text: string) => engine.commitTextEdit(id, text),
    startDrag: (event: PointerEvent) => engine.beginNodeDrag(id, event.pointerId, toLocalPoint(event.clientX, event.clientY)),
    startResize: (handle: Parameters<typeof engine.beginResize>[1], event: PointerEvent) =>
      engine.beginResize(id, handle, event.pointerId, toLocalPoint(event.clientX, event.clientY))
  }
}

export function useBoxSelectBounds() {
  const interaction = useInteraction()
  return computed(() => {
    if (interaction.value.mode !== 'box-select') {
      return null
    }
    return getBoundsFromPoints(interaction.value.startScreenPoint, interaction.value.currentScreenPoint)
  })
}
