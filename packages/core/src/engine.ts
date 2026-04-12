import {
  boundsIntersect,
  clamp,
  getBoundsFromPoints,
  getVisibleBounds,
  lerpCamera,
  pointInBounds,
  screenToWorld,
  snapPoint,
  snapSize,
  snapValue,
  worldToScreen,
  zoomCameraAtScreenPoint
} from './math'
import { createSnapshot, validateState } from './invariants'
import { applyResizeDelta, snapResizedBounds } from './resize'
import type {
  BoardSnapshot,
  BoardState,
  Bounds,
  Camera,
  CanvasEngine,
  CanvasEngineOptions,
  CanvasEventMap,
  CanvasNode,
  CanvasPlugin,
  GridSettings,
  InteractionState,
  InvariantMode,
  NodeConstraints,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  ResizeHandle,
  SelectionMode,
  TraceEntry,
  ZoomSettings
} from './types'

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, z: 1 }
const DEFAULT_ZOOM: ZoomSettings = { min: 0.1, max: 8 }
const DEFAULT_GRID: GridSettings = { size: 10, majorEvery: 5, snap: true, pattern: 'line' }
const DEFAULT_NODE_CONSTRAINTS: NodeConstraints = {
  minWidth: 50,
  minHeight: 50,
  defaultWidth: 240,
  defaultHeight: 160
}
const DEFAULT_VIEWPORT_SIZE: Point = { x: 1280, y: 720 }

export function createCanvasEngine(options: CanvasEngineOptions = {}): CanvasEngine {
  const camera: Camera = { ...DEFAULT_CAMERA, ...options.camera }
  const zoom: ZoomSettings = { ...DEFAULT_ZOOM, ...options.zoom }
  const grid: GridSettings = { ...DEFAULT_GRID, ...options.grid }
  const nodeConstraints: NodeConstraints = { ...DEFAULT_NODE_CONSTRAINTS, ...options.nodes }
  const invariantMode: InvariantMode = options.invariants ?? 'strict'
  const diagnosticsEnabled = options.diagnostics !== false
  const traceLimit =
    typeof options.diagnostics === 'object' && options.diagnostics.traceLimit
      ? options.diagnostics.traceLimit
      : 500

  const listeners = new Map<keyof CanvasEventMap, Set<(...args: unknown[]) => void>>()
  const trace: TraceEntry[] = []
  const pluginCleanups = new Map<string, () => void>()
  const clipboard: CanvasNode[] = []
  let viewportSize = { ...DEFAULT_VIEWPORT_SIZE }
  let animationToken = 0

  const state: BoardState = {
    camera,
    nodes: new Map(),
    selection: new Set(),
    interaction: { mode: 'idle' },
    nextZIndex: 1
  }

  for (const node of options.initialNodes ?? []) {
    const normalized = normalizeExistingNode(node)
    state.nodes.set(normalized.id, normalized)
    state.nextZIndex = Math.max(state.nextZIndex, normalized.zIndex + 1)
  }

  function cloneNode<T extends Record<string, unknown> = Record<string, unknown>>(node: CanvasNode<T>): CanvasNode<T> {
    return {
      ...node,
      data: structuredClone(node.data)
    }
  }

  function emit<K extends keyof CanvasEventMap>(event: K, ...args: Parameters<CanvasEventMap[K]>): void {
    if (diagnosticsEnabled) {
      trace.push({ event, timestamp: Date.now(), args })
      if (trace.length > traceLimit) {
        trace.shift()
      }
    }
    for (const handler of listeners.get(event) ?? []) {
      ;(handler as (...payload: Parameters<CanvasEventMap[K]>) => void)(...args)
    }
  }

  function on<K extends keyof CanvasEventMap>(event: K, handler: CanvasEventMap[K]) {
    const set = listeners.get(event) ?? new Set<(...args: unknown[]) => void>()
    set.add(handler as (...args: unknown[]) => void)
    listeners.set(event, set)
    return () => off(event, handler)
  }

  function once<K extends keyof CanvasEventMap>(event: K, handler: CanvasEventMap[K]) {
    const unsubscribe = on(event, ((...args: unknown[]) => {
      unsubscribe()
      ;(handler as (...payload: unknown[]) => void)(...args)
    }) as CanvasEventMap[K])
    return unsubscribe
  }

  function off<K extends keyof CanvasEventMap>(event: K, handler: CanvasEventMap[K]): void {
    listeners.get(event)?.delete(handler as (...args: unknown[]) => void)
  }

  function getGridSettings(): GridSettings {
    return { ...grid }
  }

  function getViewportSize(): Point {
    return { ...viewportSize }
  }

  function getSnapshot(): BoardSnapshot {
    return createSnapshot(state, grid)
  }

  function runCommand<T>(name: string, args: unknown[], fn: () => T): T {
    const started = performance.now()
    emit('command:before', name, args)
    const result = fn()
    validate(name)
    emit('command:after', name, args, performance.now() - started)
    return result
  }

  async function runAsyncCommand<T>(name: string, args: unknown[], fn: () => Promise<T>): Promise<T> {
    const started = performance.now()
    emit('command:before', name, args)
    const result = await fn()
    validate(name)
    emit('command:after', name, args, performance.now() - started)
    return result
  }

  function validate(context: string): void {
    if (invariantMode === 'off') {
      return
    }
    const failures = validateState(state, grid, context)
    for (const failure of failures) {
      emit('invariant:failed', failure)
    }
    if (failures.length > 0 && invariantMode === 'strict') {
      throw new Error(`Canvas invariant failed in ${context}: ${failures[0]?.message}`)
    }
  }

  function setCamera(next: Camera): void {
    const prev = { ...state.camera }
    if (prev.x === next.x && prev.y === next.y && prev.z === next.z) {
      return
    }
    state.camera = next
    emit('camera:change', { ...next }, prev)
  }

  function setSelection(nextSelection: Iterable<NodeId>): void {
    const prev = Array.from(state.selection.values())
    const next = Array.from(nextSelection)
    if (sameArray(prev, next)) {
      return
    }
    state.selection = new Set(next)
    emit('selection:change', next, prev)
  }

  function setInteraction(next: InteractionState): void {
    const prev = state.interaction
    state.interaction = next
    if (prev.mode === 'idle' && next.mode !== 'idle') {
      emit('interaction:start', next)
      return
    }
    if (prev.mode !== 'idle' && next.mode === 'idle') {
      emit('interaction:end', prev)
      return
    }
    if (prev.mode !== 'idle' && next.mode !== 'idle') {
      emit('interaction:update', next)
    }
  }

  function assertNode(id: NodeId): CanvasNode {
    const node = state.nodes.get(id)
    if (!node) {
      throw new Error(`Node "${id}" does not exist.`)
    }
    return node
  }

  function getNodeBounds(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>): Bounds {
    return {
      minX: node.x,
      minY: node.y,
      maxX: node.x + node.width,
      maxY: node.y + node.height
    }
  }

  function normalizeExistingNode(node: CanvasNode): CanvasNode {
    return {
      ...node,
      data: structuredClone(node.data),
      locked: Boolean(node.locked),
      visible: node.visible !== false
    }
  }

  function normalizeNode<T extends Record<string, unknown> = Record<string, unknown>>(input: NodeInput<T>): CanvasNode<T> {
    const rawPoint = {
      x: input.x ?? 0,
      y: input.y ?? 0
    }
    const snappedPoint = grid.snap ? snapPoint(rawPoint, grid.size) : rawPoint
    const width = grid.snap
      ? snapSize(input.width ?? nodeConstraints.defaultWidth, grid.size, nodeConstraints.minWidth)
      : input.width ?? nodeConstraints.defaultWidth
    const height = grid.snap
      ? snapSize(input.height ?? nodeConstraints.defaultHeight, grid.size, nodeConstraints.minHeight)
      : input.height ?? nodeConstraints.defaultHeight

    return {
      id: input.id ?? crypto.randomUUID(),
      type: input.type ?? 'text',
      x: snappedPoint.x,
      y: snappedPoint.y,
      width,
      height,
      data: structuredClone(
        input.data ??
          ((input.type ?? 'text') === 'text'
            ? ({ content: '' } as unknown as T)
            : ({} as T))
      ),
      zIndex: state.nextZIndex++,
      locked: Boolean(input.locked),
      visible: input.visible !== false
    }
  }

  function applyNodePatch<T extends Record<string, unknown> = Record<string, unknown>>(
    node: CanvasNode<T>,
    patch: NodePatch<T>
  ): CanvasNode<T> {
    const next: CanvasNode<T> = {
      ...node,
      ...patch,
      data: patch.data === undefined ? cloneNode(node).data : structuredClone(patch.data),
      visible: patch.visible ?? node.visible,
      locked: patch.locked ?? node.locked
    }
    if (grid.snap) {
      next.x = snapValue(next.x, grid.size)
      next.y = snapValue(next.y, grid.size)
      next.width = snapSize(next.width, grid.size, nodeConstraints.minWidth)
      next.height = snapSize(next.height, grid.size, nodeConstraints.minHeight)
    }
    return next
  }

  function replaceNode(node: CanvasNode, next: CanvasNode): void {
    state.nodes.set(node.id, next)
  }

  function duplicateNode(node: CanvasNode, offset: Point): CanvasNode {
    return {
      ...cloneNode(node),
      id: crypto.randomUUID(),
      x: grid.snap ? snapValue(node.x + offset.x, grid.size) : node.x + offset.x,
      y: grid.snap ? snapValue(node.y + offset.y, grid.size) : node.y + offset.y,
      zIndex: state.nextZIndex++
    }
  }

  function getSelectionNodes(): CanvasNode[] {
    return Array.from(state.selection.values())
      .map((id) => state.nodes.get(id))
      .filter((node): node is CanvasNode => Boolean(node))
  }

  function cleanupSelection(): void {
    const next = Array.from(state.selection.values()).filter((id) => state.nodes.has(id))
    setSelection(next)
  }

  function getAnimationFrameDriver() {
    const raf = globalThis.requestAnimationFrame?.bind(globalThis)
    const caf = globalThis.cancelAnimationFrame?.bind(globalThis)
    if (typeof raf === 'function' && typeof caf === 'function') {
      return { raf, caf }
    }
    return {
      raf: (cb: FrameRequestCallback) => globalThis.setTimeout(() => cb(Date.now()), 16) as unknown as number,
      caf: (handle: number) => globalThis.clearTimeout(handle)
    }
  }

  async function animateCamera(target: Camera): Promise<void> {
    animationToken += 1
    const token = animationToken
    const start = { ...state.camera }
    const started = performance.now()
    const duration = 280
    const { raf } = getAnimationFrameDriver()

    await new Promise<void>((resolve) => {
      const tick = () => {
        if (token !== animationToken) {
          resolve()
          return
        }
        const elapsed = performance.now() - started
        const t = clamp(elapsed / duration, 0, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        setCamera(lerpCamera(start, target, eased))
        if (t < 1) {
          raf(tick)
        } else {
          resolve()
        }
      }
      raf(tick)
    })
  }

  function computeFitCamera(ids: NodeId[] | null, padding = 40): Camera | null {
    const source = ids
      ? ids.map((id) => state.nodes.get(id)).filter((node): node is CanvasNode => Boolean(node && node.visible))
      : Array.from(state.nodes.values()).filter((node) => node.visible)
    if (source.length === 0) {
      return null
    }
    const bounds = source.reduce<Bounds>((acc, node) => {
      const current = getNodeBounds(node)
      return {
        minX: Math.min(acc.minX, current.minX),
        minY: Math.min(acc.minY, current.minY),
        maxX: Math.max(acc.maxX, current.maxX),
        maxY: Math.max(acc.maxY, current.maxY)
      }
    }, getNodeBounds(source[0]!))

    const width = Math.max(1, bounds.maxX - bounds.minX)
    const height = Math.max(1, bounds.maxY - bounds.minY)
    const zoomLevel = clamp(
      Math.min((viewportSize.x - padding * 2) / width, (viewportSize.y - padding * 2) / height),
      zoom.min,
      zoom.max
    )
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    }
    return {
      x: viewportSize.x / (2 * zoomLevel) - center.x,
      y: viewportSize.y / (2 * zoomLevel) - center.y,
      z: zoomLevel
    }
  }

  function restoreSnapshot(snapshot: BoardSnapshot, mode: 'replace' | 'merge'): void {
    if (mode === 'replace') {
      state.nodes = new Map(snapshot.nodes.map((node) => [node.id, normalizeExistingNode(node)]))
      state.selection = new Set(snapshot.selection.filter((id) => state.nodes.has(id)))
      state.interaction = { mode: 'idle' }
      state.nextZIndex = snapshot.nextZIndex
      setCamera({ ...snapshot.camera })
      grid.size = snapshot.grid.size
      grid.majorEvery = snapshot.grid.majorEvery
      grid.snap = snapshot.grid.snap
      grid.pattern = snapshot.grid.pattern
      return
    }

    for (const rawNode of snapshot.nodes) {
      const node = normalizeExistingNode(rawNode)
      const id = state.nodes.has(node.id) ? crypto.randomUUID() : node.id
      state.nodes.set(id, { ...node, id })
      state.nextZIndex = Math.max(state.nextZIndex, node.zIndex + 1)
    }
  }

  const engine: CanvasEngine = {
    getState() {
      return state
    },
    getSnapshot,
    getGridSettings,
    getViewportSize,
    updateGridSettings(patch) {
      return runCommand('updateGridSettings', [patch], () => {
        if (patch.size !== undefined) {
          grid.size = Math.max(1, Math.round(patch.size))
        }
        if (patch.majorEvery !== undefined) {
          grid.majorEvery = Math.max(1, Math.round(patch.majorEvery))
        }
        if (patch.snap !== undefined) {
          grid.snap = patch.snap
        }
        if (patch.pattern !== undefined) {
          grid.pattern = patch.pattern
        }
        return getGridSettings()
      })
    },
    setViewportSize(size) {
      viewportSize = {
        x: Math.max(1, size.x),
        y: Math.max(1, size.y)
      }
    },
    emit,
    on,
    once,
    off,
    exportTrace() {
      return trace.slice()
    },
    use(plugin: CanvasPlugin) {
      if (pluginCleanups.has(plugin.name)) {
        return
      }
      const cleanup = plugin.install(engine)
      pluginCleanups.set(plugin.name, cleanup ?? (() => undefined))
    },
    screenToWorld(point) {
      return screenToWorld(point, state.camera)
    },
    worldToScreen(point) {
      return worldToScreen(point, state.camera)
    },
    getVisibleBounds(width, height) {
      return getVisibleBounds(width, height, state.camera)
    },
    getNodeAt(worldPoint) {
      const ordered = Array.from(state.nodes.values())
        .filter((node) => node.visible)
        .sort((a, b) => b.zIndex - a.zIndex)
      return ordered.find((node) => pointInBounds(worldPoint, getNodeBounds(node))) ?? null
    },
    getNodesInBounds(bounds) {
      return Array.from(state.nodes.values()).filter((node) => node.visible && boundsIntersect(getNodeBounds(node), bounds))
    },
    panBy(dx, dy) {
      runCommand('panBy', [dx, dy], () => {
        setCamera({
          x: state.camera.x - dx / state.camera.z,
          y: state.camera.y - dy / state.camera.z,
          z: state.camera.z
        })
      })
    },
    panTo(worldPoint, animated = false) {
      const target = { x: -worldPoint.x, y: -worldPoint.y, z: state.camera.z }
      return runAsyncCommand('panTo', [worldPoint, animated], async () => {
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      })
    },
    zoomAt(screenPoint, delta) {
      runCommand('zoomAt', [screenPoint, delta], () => {
        setCamera(zoomCameraAtScreenPoint(screenPoint, delta, state.camera, zoom.min, zoom.max))
      })
    },
    zoomTo(level, animated = false) {
      const clamped = clamp(level, zoom.min, zoom.max)
      const viewportCenter = {
        x: viewportSize.x / 2,
        y: viewportSize.y / 2
      }
      const centerWorld = screenToWorld(viewportCenter, state.camera)
      const target = {
        x: viewportCenter.x / clamped - centerWorld.x,
        y: viewportCenter.y / clamped - centerWorld.y,
        z: clamped
      }
      return runAsyncCommand('zoomTo', [level, animated], async () => {
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      })
    },
    zoomToFit(padding = 40, animated = false) {
      return runAsyncCommand('zoomToFit', [padding, animated], async () => {
        const target = computeFitCamera(null, padding)
        if (!target) {
          return
        }
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      })
    },
    zoomToNodes(ids, padding = 40, animated = false) {
      return runAsyncCommand('zoomToNodes', [ids, padding, animated], async () => {
        const target = computeFitCamera(ids, padding)
        if (!target) {
          return
        }
        if (animated) {
          await animateCamera(target)
        } else {
          setCamera(target)
        }
      })
    },
    createNode<T extends Record<string, unknown> = Record<string, unknown>>(input: NodeInput<T>) {
      return runCommand('createNode', [input], () => {
        const node = normalizeNode(input)
        state.nodes.set(node.id, node)
        setSelection([node.id])
        emit('node:created', cloneNode(node))
        return cloneNode(node)
      })
    },
    updateNode<T extends Record<string, unknown> = Record<string, unknown>>(id: NodeId, patch: NodePatch<T>) {
      return runCommand('updateNode', [id, patch], () => {
        const current = assertNode(id) as CanvasNode<T>
        const next = applyNodePatch(current, patch)
        replaceNode(current, next)
        emit('node:updated', cloneNode(next), cloneNode(current))
        return cloneNode(next)
      })
    },
    deleteNode(id) {
      runCommand('deleteNode', [id], () => {
        const node = assertNode(id)
        state.nodes.delete(id)
        cleanupSelection()
        if (state.interaction.mode !== 'idle') {
          setInteraction({ mode: 'idle' })
        }
        emit('node:deleted', id, cloneNode(node))
      })
    },
    moveNode(id, dx, dy) {
      return runCommand('moveNode', [id, dx, dy], () => {
        const node = assertNode(id)
        if (node.locked) {
          return cloneNode(node)
        }
        const prev = cloneNode(node)
        const next = {
          ...node,
          x: grid.snap ? snapValue(node.x + dx, grid.size) : node.x + dx,
          y: grid.snap ? snapValue(node.y + dy, grid.size) : node.y + dy
        }
        replaceNode(node, next)
        emit('node:moved', cloneNode(next), { x: next.x - prev.x, y: next.y - prev.y })
        emit('node:updated', cloneNode(next), prev)
        return cloneNode(next)
      })
    },
    resizeNode(id, handle, dx, dy) {
      return runCommand('resizeNode', [id, handle, dx, dy], () => {
        const node = assertNode(id)
        if (node.locked) {
          return cloneNode(node)
        }
        const prev = cloneNode(node)
        const raw = applyResizeDelta(node, handle, dx, dy, {
          minWidth: nodeConstraints.minWidth,
          minHeight: nodeConstraints.minHeight
        })
        const nextBounds = grid.snap
          ? snapResizedBounds(raw, handle, grid.size, {
              minWidth: nodeConstraints.minWidth,
              minHeight: nodeConstraints.minHeight
            })
          : raw
        const next = { ...node, ...nextBounds }
        replaceNode(node, next)
        emit('node:resized', cloneNode(next), {
          x: prev.x,
          y: prev.y,
          width: prev.width,
          height: prev.height
        })
        emit('node:updated', cloneNode(next), prev)
        return cloneNode(next)
      })
    },
    bringToFront(id) {
      runCommand('bringToFront', [id], () => {
        const node = assertNode(id)
        const prev = cloneNode(node)
        const next = { ...node, zIndex: state.nextZIndex++ }
        replaceNode(node, next)
        emit('node:updated', cloneNode(next), prev)
      })
    },
    sendToBack(id) {
      runCommand('sendToBack', [id], () => {
        const node = assertNode(id)
        const prev = cloneNode(node)
        const minZ = Math.min(...Array.from(state.nodes.values(), (entry) => entry.zIndex))
        const next = { ...node, zIndex: minZ - 1 }
        replaceNode(node, next)
        emit('node:updated', cloneNode(next), prev)
      })
    },
    lockNode(id) {
      runCommand('lockNode', [id], () => {
        const node = assertNode(id)
        const prev = cloneNode(node)
        const next = { ...node, locked: true }
        replaceNode(node, next)
        emit('node:updated', cloneNode(next), prev)
      })
    },
    unlockNode(id) {
      runCommand('unlockNode', [id], () => {
        const node = assertNode(id)
        const prev = cloneNode(node)
        const next = { ...node, locked: false }
        replaceNode(node, next)
        emit('node:updated', cloneNode(next), prev)
      })
    },
    duplicateNodes(ids, offset = { x: grid.size, y: grid.size }) {
      return runCommand('duplicateNodes', [ids, offset], () => {
        const created = ids
          .map((id) => state.nodes.get(id))
          .filter((node): node is CanvasNode => Boolean(node))
          .map((node) => duplicateNode(node, offset))
        for (const node of created) {
          state.nodes.set(node.id, node)
          emit('node:created', cloneNode(node))
        }
        setSelection(created.map((node) => node.id))
        return created.map(cloneNode)
      })
    },
    copySelected() {
      return runCommand('copySelected', [], () => {
        clipboard.length = 0
        for (const node of getSelectionNodes()) {
          clipboard.push(cloneNode(node))
        }
        return clipboard.map(cloneNode)
      })
    },
    pasteClipboard(offset = { x: grid.size, y: grid.size }) {
      return runCommand('pasteClipboard', [offset], () => {
        const created = clipboard.map((node) => duplicateNode(node, offset))
        for (const node of created) {
          state.nodes.set(node.id, node)
          emit('node:created', cloneNode(node))
        }
        setSelection(created.map((node) => node.id))
        return created.map(cloneNode)
      })
    },
    select(ids, mode = 'replace') {
      runCommand('select', [ids, mode], () => {
        const resolved = Array.isArray(ids) ? ids : [ids]
        if (mode === 'replace') {
          setSelection(resolved)
          return
        }
        const next = new Set(state.selection)
        for (const id of resolved) {
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
        setSelection(next)
      })
    },
    selectAll() {
      runCommand('selectAll', [], () => {
        setSelection(Array.from(state.nodes.values()).filter((node) => node.visible).map((node) => node.id))
      })
    },
    clearSelection() {
      runCommand('clearSelection', [], () => {
        setSelection([])
      })
    },
    deleteSelected() {
      runCommand('deleteSelected', [], () => {
        const deleting = getSelectionNodes().filter((node) => !node.locked)
        for (const node of deleting) {
          state.nodes.delete(node.id)
          emit('node:deleted', node.id, cloneNode(node))
        }
        setSelection([])
        setInteraction({ mode: 'idle' })
      })
    },
    getSelection() {
      return Array.from(state.selection.values())
    },
    beginPan(pointerId, screenPoint) {
      runCommand('beginPan', [pointerId, screenPoint], () => {
        setInteraction({
          mode: 'panning',
          pointerId,
          lastScreenPoint: { ...screenPoint }
        })
      })
    },
    beginNodeDrag(id, pointerId, screenPoint) {
      runCommand('beginNodeDrag', [id, pointerId, screenPoint], () => {
        const node = assertNode(id)
        if (node.locked) {
          return
        }
        const nodeIds = state.selection.has(id) ? getSelectionNodes().filter((entry) => !entry.locked).map((entry) => entry.id) : [id]
        if (!state.selection.has(id)) {
          setSelection([id])
        }
        const startNodePositions = Object.fromEntries(
          nodeIds.map((nodeId) => {
            const current = assertNode(nodeId)
            return [nodeId, { x: current.x, y: current.y }]
          })
        )
        setInteraction({
          mode: 'dragging-nodes',
          pointerId,
          nodeIds,
          startScreenPoint: { ...screenPoint },
          startNodePositions
        })
        engine.bringToFront(id)
      })
    },
    beginResize(id, handle, pointerId, screenPoint) {
      runCommand('beginResize', [id, handle, pointerId, screenPoint], () => {
        const node = assertNode(id)
        if (node.locked) {
          return
        }
        setSelection([id])
        setInteraction({
          mode: 'resizing-node',
          pointerId,
          nodeId: id,
          handle,
          startScreenPoint: { ...screenPoint },
          startNodeBounds: {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height
          }
        })
        engine.bringToFront(id)
      })
    },
    beginBoxSelect(pointerId, screenPoint) {
      runCommand('beginBoxSelect', [pointerId, screenPoint], () => {
        const worldPoint = engine.screenToWorld(screenPoint)
        setSelection([])
        setInteraction({
          mode: 'box-select',
          pointerId,
          startScreenPoint: { ...screenPoint },
          currentScreenPoint: { ...screenPoint },
          startWorldPoint: worldPoint,
          currentWorldPoint: worldPoint
        })
      })
    },
    beginTextEdit(id) {
      runCommand('beginTextEdit', [id], () => {
        assertNode(id)
        setSelection([id])
        setInteraction({ mode: 'editing-text', nodeId: id })
      })
    },
    commitTextEdit(id, text) {
      return runCommand('commitTextEdit', [id, text], () => {
        const node = assertNode(id)
        const prev = cloneNode(node)
        const data = typeof node.data === 'object' && node.data !== null ? structuredClone(node.data) : {}
        ;(data as Record<string, unknown>).content = text
        const next = { ...node, data }
        replaceNode(node, next)
        setInteraction({ mode: 'idle' })
        emit('node:updated', cloneNode(next), prev)
        return cloneNode(next)
      })
    },
    updatePointer(pointerId, screenPoint) {
      const interaction = state.interaction
      if (interaction.mode === 'idle' || interaction.mode === 'editing-text' || interaction.pointerId !== pointerId) {
        return
      }

      if (interaction.mode === 'panning') {
        runCommand('updatePointer', [pointerId, screenPoint], () => {
          const deltaX = screenPoint.x - interaction.lastScreenPoint.x
          const deltaY = screenPoint.y - interaction.lastScreenPoint.y
          setCamera({
            x: state.camera.x + deltaX / state.camera.z,
            y: state.camera.y + deltaY / state.camera.z,
            z: state.camera.z
          })
          interaction.lastScreenPoint = { ...screenPoint }
        })
        return
      }

      if (interaction.mode === 'dragging-nodes') {
        runCommand('updatePointer', [pointerId, screenPoint], () => {
          const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z
          const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z
          for (const nodeId of interaction.nodeIds) {
            const node = assertNode(nodeId)
            const origin = interaction.startNodePositions[nodeId]
            const next = {
              ...node,
              x: grid.snap ? snapValue(origin.x + deltaX, grid.size) : origin.x + deltaX,
              y: grid.snap ? snapValue(origin.y + deltaY, grid.size) : origin.y + deltaY
            }
            replaceNode(node, next)
            emit('node:moved', cloneNode(next), { x: next.x - origin.x, y: next.y - origin.y })
          }
        })
        return
      }

      if (interaction.mode === 'resizing-node') {
        runCommand('updatePointer', [pointerId, screenPoint], () => {
          const node = assertNode(interaction.nodeId)
          const deltaX = (screenPoint.x - interaction.startScreenPoint.x) / state.camera.z
          const deltaY = (screenPoint.y - interaction.startScreenPoint.y) / state.camera.z
          const raw = applyResizeDelta(interaction.startNodeBounds, interaction.handle, deltaX, deltaY, {
            minWidth: nodeConstraints.minWidth,
            minHeight: nodeConstraints.minHeight
          })
          const nextBounds = grid.snap
            ? snapResizedBounds(raw, interaction.handle, grid.size, {
                minWidth: nodeConstraints.minWidth,
                minHeight: nodeConstraints.minHeight
              })
            : raw
          replaceNode(node, { ...node, ...nextBounds })
        })
        return
      }

      runCommand('updatePointer', [pointerId, screenPoint], () => {
        const currentWorldPoint = engine.screenToWorld(screenPoint)
        interaction.currentScreenPoint = { ...screenPoint }
        interaction.currentWorldPoint = currentWorldPoint
        const bounds = getBoundsFromPoints(interaction.startWorldPoint, currentWorldPoint)
        const matches = engine
          .getNodesInBounds(bounds)
          .filter((node) => node.visible)
          .map((node) => node.id)
        setSelection(matches)
      })
    },
    endInteraction(pointerId) {
      const interaction = state.interaction
      if (interaction.mode === 'idle') {
        return
      }
      if ('pointerId' in interaction && pointerId !== undefined && interaction.pointerId !== pointerId) {
        return
      }
      runCommand('endInteraction', [pointerId], () => {
        setInteraction({ mode: 'idle' })
      })
    },
    exportJSON() {
      return JSON.stringify(getSnapshot())
    },
    importJSON(json, mode = 'replace') {
      runCommand('importJSON', [mode], () => {
        const parsed = JSON.parse(json) as BoardSnapshot
        restoreSnapshot(parsed, mode)
      })
    }
  }

  for (const plugin of options.plugins ?? []) {
    engine.use(plugin)
  }

  validate('createCanvasEngine')
  emit('ready')

  return engine
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value === b[index])
}
