import { getVisibleBounds, screenToWorld, worldToScreen, zoomCameraAtScreenPoint } from './math'
import { applyResizeDelta } from './resize'
import { createInvariantSnapshot, validateState } from './invariants'
import type {
  BoardState,
  CanvasCommandPerformanceSample,
  CanvasDiagnosticsEvent,
  CanvasEngine,
  CanvasEngineOptions,
  CanvasNode,
  NodeId,
  Point,
  ResizeHandle
} from './types'

const DEFAULTS = {
  minZoom: 0.1,
  maxZoom: 5,
  minNodeWidth: 50,
  minNodeHeight: 50,
  defaultNodeWidth: 240,
  defaultNodeHeight: 160,
  traceLimit: 300,
  diagnostics: true,
  strictInvariants: true
} satisfies Required<
  Pick<
    CanvasEngineOptions,
    | 'minZoom'
    | 'maxZoom'
    | 'minNodeWidth'
    | 'minNodeHeight'
    | 'defaultNodeWidth'
    | 'defaultNodeHeight'
    | 'traceLimit'
    | 'diagnostics'
    | 'strictInvariants'
  >
>

export function createCanvasEngine(options: CanvasEngineOptions = {}): CanvasEngine {
  const config = { ...DEFAULTS, ...options }
  const listeners = new Set<(event: CanvasDiagnosticsEvent) => void>()
  const trace: CanvasDiagnosticsEvent[] = []

  const state: BoardState = {
    camera: {
      x: options.initialCamera?.x ?? 0,
      y: options.initialCamera?.y ?? 0,
      z: options.initialCamera?.z ?? 1
    },
    nodes: new Map(),
    selection: new Set(),
    interaction: { mode: 'idle' },
    nextZIndex: 1
  }

  for (const node of options.initialNodes ?? []) {
    state.nodes.set(node.id, { ...node })
    state.nextZIndex = Math.max(state.nextZIndex, node.zIndex + 1)
  }

  function emit(event: CanvasDiagnosticsEvent): void {
    if (config.diagnostics) {
      trace.push(event)
      if (trace.length > config.traceLimit) {
        trace.shift()
      }
    }

    for (const listener of listeners) {
      listener(event)
    }
  }

  function commit(command: string, fn: () => void, payload?: Record<string, unknown>): void {
    const started = performance.now()
    emit({ type: 'command:start', command, timestamp: Date.now(), payload })
    fn()
    runInvariants(command)
    const snapshot = createInvariantSnapshot(state)
    emit({
      type: 'state:changed',
      command,
      timestamp: Date.now(),
      snapshot
    })
    emit({ type: 'command:end', command, timestamp: Date.now(), payload })
    const sample: CanvasCommandPerformanceSample = {
      command,
      durationMs: performance.now() - started,
      timestamp: Date.now()
    }
    emit({ type: 'performance:sample', timestamp: sample.timestamp, sample })
  }

  function runInvariants(context: string): void {
    const failures = validateState(state, context)
    for (const failure of failures) {
      emit({
        type: 'invariant:failed',
        timestamp: Date.now(),
        failure
      })
      options.onInvariantFailure?.(failure)
    }

    if (failures.length > 0 && config.strictInvariants) {
      throw new Error(`Canvas invariant failed in ${context}: ${failures[0]?.message}`)
    }
  }

  function assertNode(nodeId: NodeId): CanvasNode {
    const node = state.nodes.get(nodeId)
    if (!node) {
      throw new Error(`Node "${nodeId}" does not exist.`)
    }
    return node
  }

  function setInteraction(next: BoardState['interaction']): void {
    state.interaction = next
    emit({
      type: 'interaction:changed',
      timestamp: Date.now(),
      interaction: createInvariantSnapshot(state).interaction
    })
  }

  function normalizeNode(input: Partial<Omit<CanvasNode, 'id' | 'zIndex'>> & { id?: NodeId }): CanvasNode {
    return {
      id: input.id ?? crypto.randomUUID(),
      x: input.x ?? 0,
      y: input.y ?? 0,
      width: input.width ?? config.defaultNodeWidth,
      height: input.height ?? config.defaultNodeHeight,
      text: input.text ?? '',
      zIndex: state.nextZIndex++
    }
  }

  const engine: CanvasEngine = {
    getState() {
      return state
    },
    getSnapshot() {
      return createInvariantSnapshot(state)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    exportTrace() {
      return trace.slice()
    },
    screenToWorld(screenPoint) {
      return screenToWorld(screenPoint, state.camera)
    },
    worldToScreen(worldPoint) {
      return worldToScreen(worldPoint, state.camera)
    },
    getVisibleBounds(viewportWidth, viewportHeight) {
      return getVisibleBounds(viewportWidth, viewportHeight, state.camera)
    },
    panByScreenDelta(deltaX, deltaY) {
      commit('panByScreenDelta', () => {
        state.camera.x -= deltaX / state.camera.z
        state.camera.y -= deltaY / state.camera.z
      }, { deltaX, deltaY })
    },
    zoomAtScreenPoint(screenPoint, delta) {
      commit('zoomAtScreenPoint', () => {
        state.camera = zoomCameraAtScreenPoint(
          screenPoint,
          delta,
          state.camera,
          config.minZoom,
          config.maxZoom
        )
      }, { screenPoint, delta })
    },
    createNode(input) {
      const node = normalizeNode(input)
      commit('createNode', () => {
        state.nodes.set(node.id, node)
        state.selection = new Set([node.id])
      }, { nodeId: node.id })
      return { ...node }
    },
    updateNode(nodeId, patch) {
      const node = assertNode(nodeId)
      commit('updateNode', () => {
        Object.assign(node, patch)
      }, { nodeId })
      return { ...node }
    },
    moveNode(nodeId, deltaWorldX, deltaWorldY) {
      const node = assertNode(nodeId)
      commit('moveNode', () => {
        node.x += deltaWorldX
        node.y += deltaWorldY
      }, { nodeId, deltaWorldX, deltaWorldY })
      return { ...node }
    },
    resizeNode(nodeId, handle, deltaWorldX, deltaWorldY) {
      const node = assertNode(nodeId)
      commit('resizeNode', () => {
        const next = applyResizeDelta(node, handle, deltaWorldX, deltaWorldY, {
          minWidth: config.minNodeWidth,
          minHeight: config.minNodeHeight
        })
        Object.assign(node, next)
      }, { nodeId, handle, deltaWorldX, deltaWorldY })
      return { ...node }
    },
    select(nodeIds, mode = 'replace') {
      const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds]
      commit('select', () => {
        if (mode === 'replace') {
          state.selection = new Set(ids)
          return
        }

        const next = new Set(state.selection)
        for (const id of ids) {
          if (mode === 'toggle') {
            if (next.has(id)) {
              next.delete(id)
            } else {
              next.add(id)
            }
          } else {
            next.add(id)
          }
        }
        state.selection = next
      }, { ids, mode })
    },
    clearSelection() {
      commit('clearSelection', () => {
        state.selection = new Set()
      })
    },
    deleteSelected() {
      commit('deleteSelected', () => {
        for (const id of state.selection.values()) {
          state.nodes.delete(id)
        }
        state.selection = new Set()
        if (state.interaction.mode !== 'idle') {
          setInteraction({ mode: 'idle' })
        }
      })
    },
    bringToFront(nodeId) {
      const node = assertNode(nodeId)
      commit('bringToFront', () => {
        node.zIndex = state.nextZIndex++
      }, { nodeId })
      return { ...node }
    },
    beginTextEdit(nodeId) {
      assertNode(nodeId)
      commit('beginTextEdit', () => {
        state.selection = new Set([nodeId])
        setInteraction({ mode: 'editing-text', nodeId })
      }, { nodeId })
    },
    commitTextEdit(nodeId, text) {
      const node = assertNode(nodeId)
      commit('commitTextEdit', () => {
        node.text = text
        setInteraction({ mode: 'idle' })
      }, { nodeId })
      return { ...node }
    },
    beginPan(pointerId, screenPoint) {
      commit('beginPan', () => {
        setInteraction({ mode: 'panning', pointerId, lastScreenPoint: { ...screenPoint } })
      }, { pointerId, screenPoint })
    },
    beginNodeDrag(nodeId, pointerId, screenPoint) {
      assertNode(nodeId)
      commit('beginNodeDrag', () => {
        state.selection = new Set([nodeId])
        engine.bringToFront(nodeId)
        setInteraction({
          mode: 'dragging-node',
          pointerId,
          nodeId,
          lastScreenPoint: { ...screenPoint }
        })
      }, { nodeId, pointerId, screenPoint })
    },
    beginResize(nodeId, handle, pointerId, screenPoint) {
      const node = assertNode(nodeId)
      commit('beginResize', () => {
        state.selection = new Set([nodeId])
        engine.bringToFront(nodeId)
        setInteraction({
          mode: 'resizing-node',
          pointerId,
          nodeId,
          handle,
          startScreenPoint: { ...screenPoint },
          startNodeBounds: {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height
          }
        })
      }, { nodeId, handle, pointerId, screenPoint })
    },
    updatePointer(pointerId, screenPoint) {
      const interaction = state.interaction
      if (interaction.mode === 'idle' || interaction.mode === 'editing-text') {
        return
      }
      if (interaction.pointerId !== pointerId) {
        return
      }

      if (interaction.mode === 'panning') {
        commit('updatePointer:pan', () => {
          const deltaX = screenPoint.x - interaction.lastScreenPoint.x
          const deltaY = screenPoint.y - interaction.lastScreenPoint.y
          state.camera.x -= deltaX / state.camera.z
          state.camera.y -= deltaY / state.camera.z
          interaction.lastScreenPoint = { ...screenPoint }
        }, { pointerId, screenPoint })
        return
      }

      if (interaction.mode === 'dragging-node') {
        const node = assertNode(interaction.nodeId)
        commit('updatePointer:dragging-node', () => {
          const deltaX = (screenPoint.x - interaction.lastScreenPoint.x) / state.camera.z
          const deltaY = (screenPoint.y - interaction.lastScreenPoint.y) / state.camera.z
          node.x += deltaX
          node.y += deltaY
          interaction.lastScreenPoint = { ...screenPoint }
        }, { pointerId, screenPoint, nodeId: interaction.nodeId })
        return
      }

      const node = assertNode(interaction.nodeId)
      commit('updatePointer:resizing-node', () => {
        const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z
        const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z
        const next = applyResizeDelta(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, {
          minWidth: config.minNodeWidth,
          minHeight: config.minNodeHeight
        })
        Object.assign(node, next)
      }, { pointerId, screenPoint, nodeId: interaction.nodeId, handle: interaction.handle })
    },
    endInteraction(pointerId) {
      const interaction = state.interaction
      if (interaction.mode === 'idle') {
        return
      }
      if ('pointerId' in interaction && pointerId !== undefined && pointerId !== interaction.pointerId) {
        return
      }
      commit('endInteraction', () => {
        setInteraction({ mode: 'idle' })
      }, { pointerId })
    }
  }

  runInvariants('createCanvasEngine')
  return engine
}
