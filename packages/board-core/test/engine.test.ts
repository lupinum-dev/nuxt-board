import { describe, expect, it, vi } from 'vitest'
import {
  asNodeId,
  BoardConflictError,
  BoardDestroyedError,
  BoardInputError,
  CommandBlockedError,
  createBoardEngine,
} from '../src'
import {
  defineInternalBoardPlugin,
  getBoardInteractionAdapter,
  type InternalBoardPlugin,
} from '../src/internal'

describe('board engine', () => {
  it('reports listener failures without rolling back committed state', () => {
    const failures: Array<{ error: unknown; event: string }> = []
    const engine = createBoardEngine({
      onUnhandledError(error, context) {
        failures.push({ error, event: context.event })
      },
    })
    engine.on('node:created', () => {
      throw new Error('listener failed')
    })

    const node = engine.createNode({ type: 'text', text: 'Committed' })

    expect(engine.hasNode(node.id)).toBe(true)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({ event: 'node:created' })
    expect(failures[0]?.error).toBeInstanceOf(Error)
  })

  it.each([
    ['zero camera zoom', { camera: { z: 0 } }],
    ['negative camera zoom', { camera: { z: -1 } }],
    ['reversed zoom bounds', { zoom: { min: 2, max: 1 } }],
    ['non-finite edge snap threshold', { grid: { edgeSnapThreshold: NaN } }],
    ['negative node minimum', { nodes: { minWidth: -1 } }],
    [
      'default smaller than minimum',
      { nodes: { minWidth: 200, defaultWidth: 100 } },
    ],
    ['invalid diagnostics limit', { diagnostics: { traceLimit: -1 } }],
  ])('rejects invalid constructor configuration: %s', (_label, options) => {
    expect(() => createBoardEngine(options)).toThrow(BoardInputError)
  })

  it('rejects duplicate initial and created node ids without overwriting state', () => {
    const id = asNodeId('duplicate')
    const node = {
      id,
      type: 'text' as const,
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'First',
      zIndex: 1,
      locked: false,
      visible: true,
    }

    expect(() =>
      createBoardEngine({ initialNodes: [node, { ...node, text: 'Second' }] }),
    ).toThrow(BoardConflictError)

    const engine = createBoardEngine({
      grid: { snap: false },
      initialNodes: [node],
    })
    expect(() =>
      engine.createNode({ id, type: 'text', text: 'Replacement' }),
    ).toThrow(BoardConflictError)
    expect(engine.getNode(id).text).toBe('First')
  })

  it('runs feature cleanups once when destroyed', () => {
    const cleanup = vi.fn()
    const feature: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'cleanup-test',
      install() {
        return cleanup
      },
    })
    const engine = createBoardEngine({
      plugins: [feature],
    })

    engine.destroy()
    engine.destroy()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('makes destruction terminal and releases subscribable listeners', () => {
    const engine = createBoardEngine()
    const nodes = engine.$nodes
    const listener = vi.fn()
    nodes.subscribe(listener)

    engine.destroy()

    expect(() => engine.getState()).toThrow(BoardDestroyedError)
    expect(() => nodes.get()).toThrow(BoardDestroyedError)
    expect(() => nodes.subscribe(listener)).toThrow(BoardDestroyedError)
    expect(() => engine.createNode({ type: 'text' })).toThrow(
      BoardDestroyedError,
    )
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps pointer methods off the runtime public facade', () => {
    const engine = createBoardEngine()
    expect(Object.keys(engine)).not.toContain('beginNodeDrag')
    expect(Object.keys(engine)).not.toContain('runCommand')
    expect('beginNodeDrag' in engine).toBe(false)
    expect(getBoardInteractionAdapter(engine).beginNodeDrag).toBeTypeOf(
      'function',
    )
  })

  it('keeps diagnostics off unless explicitly enabled', () => {
    const defaultEngine = createBoardEngine()
    defaultEngine.createNode({ type: 'text' })
    expect(defaultEngine.exportTrace()).toEqual([])

    const diagnosticEngine = createBoardEngine({ diagnostics: true })
    diagnosticEngine.createNode({ type: 'text' })
    expect(diagnosticEngine.exportTrace().length).toBeGreaterThan(0)
  })

  it('rejects malformed plugin objects before install', () => {
    expect(() =>
      createBoardEngine({
        plugins: [{ name: 'fake' } as never],
      }),
    ).toThrow(
      /Invalid board plugin "fake": expected a token created by a first-party plugin factory/,
    )
  })

  it('keeps zoom anchored to the cursor', () => {
    const engine = createBoardEngine()
    const point = { x: 320, y: 240 }
    const before = engine.screenToWorld(point)

    engine.zoomAt(point, -6)

    expect(engine.screenToWorld(point)).toEqual(before)
  })

  it('rolls back strict validation failures after node updates', () => {
    const commits: string[] = []
    const feature: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'rollback-probe',
      install(engine) {
        return engine.projectCommit(
          (commit) => () => commits.push(commit.label),
        )
      },
    })
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [feature],
    })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'original',
    })
    const before = engine.getState()
    commits.length = 0

    const events: string[] = []
    engine.on('node:updated', () => events.push('node:updated'))

    expect(() => engine.updateNode(node.id, { width: -1 })).toThrow(
      /Invalid node geometry/,
    )

    expect(engine.getState()).toEqual(before)
    expect(commits).toEqual([])
    expect(events).toEqual([])
  })

  it('rolls back invalid node creation and import payloads', () => {
    const commits: string[] = []
    const actionProbe: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'action-probe',
      install(engine) {
        return engine.projectCommit(
          (commit) => () => commits.push(commit.label),
        )
      },
    })
    const engine = createBoardEngine({
      grid: { snap: false },
      plugins: [actionProbe],
    })
    const beforeCreate = engine.getState()
    const events: string[] = []
    engine.on('node:created', () => events.push('node:created'))

    expect(() =>
      engine.createNode({
        type: 'text',
        width: -1,
        height: 80,
        text: '',
      }),
    ).toThrow(/Invalid node geometry/)
    expect(engine.getState()).toEqual(beforeCreate)
    expect(commits).toEqual([])
    expect(events).toEqual([])

    const existing = engine.createNode({
      type: 'text',
      x: 10,
      y: 20,
      text: 'Node',
    })
    const beforeImport = engine.getState()

    expect(() =>
      engine.loadDocument(
        {
          nodes: [
            {
              id: existing.id,
              type: 'text',
              x: existing.x,
              y: existing.y,
              width: -1,
              height: existing.height,
              text: existing.text ?? '',
            },
          ],
        },
        { mode: 'replace' },
      ),
    ).toThrow(/Invalid board document/)
    expect(engine.getState()).toEqual(beforeImport)
    expect(commits).toEqual(['createNode'])
    expect(events).toEqual(['node:created'])
  })

  it('runs command guards for async camera commands', async () => {
    const engine = createBoardEngine()
    const blocked: string[] = []
    engine.addCommandGuard(({ name }) => {
      if (name === 'panTo' || name === 'zoomToFit') {
        blocked.push(name)
        return 'Camera is locked.'
      }
      return true
    })

    await expect(engine.panTo({ x: 100, y: 100 })).rejects.toBeInstanceOf(
      CommandBlockedError,
    )
    await expect(engine.zoomToFit()).rejects.toBeInstanceOf(CommandBlockedError)

    expect(blocked).toEqual(['panTo', 'zoomToFit'])
    expect(engine.getState().camera).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('moves all selected nodes during a drag', () => {
    const engine = createBoardEngine()
    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    const second = engine.createNode({
      type: 'text',
      x: 100,
      y: 50,
      text: 'Node',
    })
    engine.select([first.id, second.id])

    getBoardInteractionAdapter(engine).beginNodeDrag(first.id, 1, {
      x: 0,
      y: 0,
    })
    getBoardInteractionAdapter(engine).updatePointer(1, { x: 50, y: 20 })
    getBoardInteractionAdapter(engine).endInteraction(1)

    const snapshot = engine.getState()
    expect(snapshot.nodes.get(first.id)).toMatchObject({
      x: 50,
      y: 20,
    })
    expect(snapshot.nodes.get(second.id)).toMatchObject({
      x: 150,
      y: 70,
    })
  })

  it('notifies node subscribers once for a multi-node drag update', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'First',
    })
    const second = engine.createNode({
      type: 'text',
      x: 100,
      y: 50,
      text: 'Second',
    })
    const third = engine.createNode({
      type: 'text',
      x: 200,
      y: 100,
      text: 'Third',
    })
    engine.select([first.id, second.id, third.id])
    getBoardInteractionAdapter(engine).beginNodeDrag(first.id, 1, {
      x: 0,
      y: 0,
    })

    let notifications = 0
    const unsubscribe = engine.$nodes.subscribe(() => {
      notifications += 1
    })
    getBoardInteractionAdapter(engine).updatePointer(1, { x: 50, y: 20 })
    unsubscribe()

    expect(notifications).toBe(1)
    expect(engine.findNode(first.id)).toMatchObject({ x: 50, y: 20 })
    expect(engine.findNode(second.id)).toMatchObject({ x: 150, y: 70 })
    expect(engine.findNode(third.id)).toMatchObject({ x: 250, y: 120 })
  })

  it('creates, updates, copies, and pastes node colors', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      color: '4',
      text: 'Node',
    })

    expect(node.color).toBe('4')

    engine.updateNode(node.id, { color: '6' })
    expect(engine.getNode(node.id).color).toBe('6')

    engine.select([node.id])
    const copied = engine.copySelected()
    expect(copied[0]?.color).toBe('6')

    const pasted = engine.pasteClipboard({ x: 100, y: 0 })
    expect(pasted[0]?.color).toBe('6')

    engine.updateNode(node.id, { color: undefined })
    expect(engine.getNode(node.id).color).toBeUndefined()
  })

  it('locks node dragging to the dominant axis while shift is held', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })

    getBoardInteractionAdapter(engine).beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    getBoardInteractionAdapter(engine).updatePointer(
      1,
      { x: 48, y: 14 },
      { shift: true },
    )
    getBoardInteractionAdapter(engine).endInteraction(1)

    expect(engine.getState().nodes.get(node.id)).toMatchObject({
      x: 48,
      y: 0,
    })
  })

  it('keeps pointer-frame geometry out of the persisted document', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0, text: 'Node' })

    getBoardInteractionAdapter(engine).beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    getBoardInteractionAdapter(engine).updatePointer(1, { x: 80, y: 30 })

    expect(engine.getState().nodes.get(node.id)).toMatchObject({ x: 80, y: 30 })
    const document = engine.exportDocument() as unknown as {
      nodes: ReadonlyArray<{ id: string; x: number; y: number }>
    }
    expect(document.nodes.find((entry) => entry.id === node.id)).toMatchObject({
      x: 0,
      y: 0,
    })

    getBoardInteractionAdapter(engine).endInteraction(1)
    expect(engine.findNode(node.id)).toMatchObject({ x: 80, y: 30 })
  })

  it('bypasses grid snapping while dragging when space is held', () => {
    const engine = createBoardEngine({ grid: { size: 20, snap: true } })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })

    getBoardInteractionAdapter(engine).beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    getBoardInteractionAdapter(engine).updatePointer(
      1,
      { x: 17, y: 9 },
      { space: true },
    )
    getBoardInteractionAdapter(engine).endInteraction(1)

    expect(engine.getState().nodes.get(node.id)).toMatchObject({
      x: 17,
      y: 9,
    })
    expect(engine.getState().snapGuides).toEqual([])
  })

  it('bypasses grid snapping while resizing when space is held', () => {
    const engine = createBoardEngine({ grid: { size: 20, snap: true } })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      text: '',
    })

    getBoardInteractionAdapter(engine).beginResize(node.id, 'se', 1, {
      x: 0,
      y: 0,
    })
    getBoardInteractionAdapter(engine).updatePointer(
      1,
      { x: 17, y: 9 },
      { space: true },
    )
    getBoardInteractionAdapter(engine).endInteraction(1)

    expect(engine.getState().nodes.get(node.id)).toMatchObject({
      width: 217,
      height: 109,
    })
    expect(engine.getState().snapGuides).toEqual([])
  })

  it('publishes transient resize geometry before the gesture commits', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    })
    const updates: Array<{ width: number; height: number }> = []
    engine.$nodes.subscribe((nodes) => {
      const current = nodes.get(node.id)
      if (current) {
        updates.push({ width: current.width, height: current.height })
      }
    })

    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginResize(node.id, 'se', 1, { x: 200, y: 100 })
    interaction.updatePointer(1, { x: 240, y: 130 })

    expect(engine.$nodes.get().get(node.id)).toMatchObject({
      width: 240,
      height: 130,
    })
    expect(engine.exportDocument().nodes[0]).toMatchObject({
      width: 200,
      height: 100,
    })
    expect(updates.at(-1)).toEqual({ width: 240, height: 130 })

    interaction.endInteraction(1)
    expect(engine.getNode(node.id)).toMatchObject({
      width: 240,
      height: 130,
    })
  })

  it('supports box selection in screen space', () => {
    const engine = createBoardEngine()
    const first = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 420,
      y: 320,
      width: 80,
      height: 60,
      text: 'Node',
    })

    getBoardInteractionAdapter(engine).beginBoxSelect(1, { x: 0, y: 0 })
    getBoardInteractionAdapter(engine).updatePointer(1, { x: 200, y: 160 })
    getBoardInteractionAdapter(engine).endInteraction(1)

    expect(engine.getSelection()).toEqual([first.id])
  })

  it('uses AutoCAD-style box selection by default', () => {
    const engine = createBoardEngine()
    const contained = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })
    const crossing = engine.createNode({
      type: 'text',
      x: 180,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })

    getBoardInteractionAdapter(engine).beginBoxSelect(1, { x: 0, y: 0 })
    getBoardInteractionAdapter(engine).updatePointer(1, { x: 200, y: 160 })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'box-select',
      selectionMode: 'window',
    })
    getBoardInteractionAdapter(engine).endInteraction(1)

    expect(engine.getSelection()).toEqual([contained.id])

    getBoardInteractionAdapter(engine).beginBoxSelect(2, { x: 200, y: 160 })
    getBoardInteractionAdapter(engine).updatePointer(2, { x: 0, y: 0 })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'box-select',
      selectionMode: 'crossing',
    })
    getBoardInteractionAdapter(engine).endInteraction(2)

    expect(engine.getSelection()).toEqual([contained.id, crossing.id])
  })

  it('restores the previous selection when box selection is cancelled', () => {
    const engine = createBoardEngine()
    const previous = engine.createNode({
      type: 'text',
      x: 400,
      y: 400,
      width: 80,
      height: 60,
    })
    const previewed = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 80,
      height: 60,
    })
    engine.select(previous.id)
    const interaction = getBoardInteractionAdapter(engine)

    interaction.beginBoxSelect(1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 200, y: 160 })
    expect(engine.getSelection()).toEqual([previewed.id])

    interaction.cancelInteraction(1)
    expect(engine.getSelection()).toEqual([previous.id])
    expect(engine.getState().interaction.mode).toBe('idle')
  })

  it('preserves an active box-selection preview when a command fails', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const previous = engine.createNode({
      type: 'text',
      x: 400,
      y: 400,
      width: 80,
      height: 60,
    })
    const previewed = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 80,
      height: 60,
    })
    engine.select(previous.id)
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginBoxSelect(1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 200, y: 160 })

    expect(() => engine.updateNode(previewed.id, { width: -1 })).toThrow(
      BoardInputError,
    )
    expect(engine.getState().interaction.mode).toBe('box-select')
    expect(engine.getSelection()).toEqual([previewed.id])

    interaction.cancelInteraction(1)
    expect(engine.getSelection()).toEqual([previous.id])
  })

  it('allows forcing contain-only box selection via config', () => {
    const engine = createBoardEngine({
      boxSelect: { behavior: 'contain' },
    })
    const contained = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 180,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })

    getBoardInteractionAdapter(engine).beginBoxSelect(1, { x: 200, y: 160 })
    getBoardInteractionAdapter(engine).updatePointer(1, { x: 0, y: 0 })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'box-select',
      selectionMode: 'window',
    })
    getBoardInteractionAdapter(engine).endInteraction(1)

    expect(engine.getSelection()).toEqual([contained.id])
  })

  it('allows forcing intersecting box selection via config', () => {
    const engine = createBoardEngine({
      boxSelect: { behavior: 'intersect' },
    })
    const contained = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })
    const crossing = engine.createNode({
      type: 'text',
      x: 180,
      y: 20,
      width: 80,
      height: 60,
      text: 'Node',
    })

    getBoardInteractionAdapter(engine).beginBoxSelect(1, { x: 0, y: 0 })
    getBoardInteractionAdapter(engine).updatePointer(1, { x: 200, y: 160 })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'box-select',
      selectionMode: 'crossing',
    })
    getBoardInteractionAdapter(engine).endInteraction(1)

    expect(engine.getSelection()).toEqual([contained.id, crossing.id])
  })

  it('prevents locked nodes from moving, resizing, and deleting', () => {
    const engine = createBoardEngine()
    const locked = engine.createNode({
      type: 'text',
      x: 20,
      y: 20,
      width: 120,
      height: 100,
      locked: true,
      text: 'Node',
    })

    expect(engine.moveNode(locked.id, 40, 20)).toMatchObject({ x: 20, y: 20 })
    expect(engine.resizeNode(locked.id, 'se', 80, 40)).toMatchObject({
      width: 120,
      height: 100,
    })

    engine.select(locked.id)
    engine.deleteSelected()

    expect(engine.getState().nodes.size).toBe(1)
  })

  it('fires command hooks and rejects duplicate feature names', () => {
    const events: string[] = []
    let installs = 0
    const feature: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'audit',
      install(engine) {
        installs += 1
        const before = engine.on('command:before', (name) => {
          events.push(`before:${name}`)
        })
        const after = engine.on('command:after', (name) => {
          events.push(`after:${name}`)
        })
        return () => {
          before()
          after()
        }
      },
    })

    expect(() => createBoardEngine({ plugins: [feature, feature] })).toThrow(
      BoardInputError,
    )

    const engine = createBoardEngine({ plugins: [feature] })
    engine.createNode({ type: 'text', x: 0, y: 0, text: 'Hello' })

    expect(installs).toBe(1)
    expect(events).toContain('before:createNode')
    expect(events).toContain('after:createNode')
  })

  it('fits nodes into the viewport', async () => {
    const engine = createBoardEngine()
    engine.setViewportSize({ x: 640, y: 480 })
    const first = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Node',
    })
    const second = engine.createNode({
      type: 'text',
      x: 1200,
      y: 900,
      width: 120,
      height: 80,
      text: 'Node',
    })

    await engine.zoomToFit(40, false)

    const visible = engine.getVisibleBounds(640, 480)
    expect(visible.minX).toBeLessThanOrEqual(first.x)
    expect(visible.maxX).toBeGreaterThanOrEqual(second.x + second.width)
    expect(visible.minY).toBeLessThanOrEqual(first.y)
    expect(visible.maxY).toBeGreaterThanOrEqual(second.y + second.height)
  })

  it('resizes from the nw handle, moving origin while shrinking', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      text: '',
    })

    const result = engine.resizeNode(node.id, 'nw', 30, 40)

    expect(result.x).toBe(130)
    expect(result.y).toBe(140)
    expect(result.width).toBe(170)
    expect(result.height).toBe(160)
  })

  it('deletes a node while it is being dragged without throwing', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })

    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 40, y: 20 })
    expect(engine.$nodes.get().get(node.id)).toMatchObject({ x: 40, y: 20 })

    engine.deleteNode(node.id)

    const snapshot = engine.getState()
    expect(snapshot.nodes).toHaveLength(0)
    expect(engine.$nodes.get().has(node.id)).toBe(false)
    expect(engine.getState().interaction.mode).toBe('idle')
    interaction.endInteraction(1)
    expect(engine.hasNode(node.id)).toBe(false)
  })

  it('cancels transient geometry before a concurrent document command', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Before',
    })
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 40, y: 20 })

    engine.updateNode(node.id, { text: 'After' })

    expect(engine.getState().interaction.mode).toBe('idle')
    expect(engine.$nodes.get().get(node.id)).toMatchObject({
      x: 0,
      y: 0,
      text: 'After',
    })
    interaction.endInteraction(1)
    expect(engine.getNode(node.id)).toMatchObject({
      x: 0,
      y: 0,
      text: 'After',
    })
  })

  it('discards the previous preview before starting another interaction', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    })
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 40, y: 20 })

    interaction.beginResize(node.id, 'se', 2, { x: 200, y: 100 })

    expect(engine.$nodes.get().get(node.id)).toMatchObject({ x: 0, y: 0 })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'resizing-node',
      pointerId: 2,
      startNodeBounds: { x: 0, y: 0, width: 200, height: 100 },
    })
  })

  it('preserves the current preview when a replacement interaction fails', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0 })
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 40, y: 20 })

    expect(() =>
      interaction.beginResize(asNodeId('missing'), 'se', 2, {
        x: 200,
        y: 100,
      }),
    ).toThrow('Node "missing" does not exist.')

    expect(engine.$nodes.get().get(node.id)).toMatchObject({ x: 40, y: 20 })
    expect(engine.getState().interaction).toMatchObject({
      mode: 'dragging-nodes',
      pointerId: 1,
    })
  })

  it('cancels an active gesture before changing selection explicitly', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const dragged = engine.createNode({ type: 'text', x: 0, y: 0 })
    const selected = engine.createNode({ type: 'text', x: 300, y: 0 })
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(dragged.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 40, y: 20 })

    engine.select(selected.id)

    expect(engine.getState().interaction.mode).toBe('idle')
    expect(engine.$nodes.get().get(dragged.id)).toMatchObject({ x: 0, y: 0 })
    expect(engine.getSelection()).toEqual([selected.id])
  })

  it('returns detached public nodes from snapshots', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({
      type: 'text',
      x: 10,
      y: 20,
      text: 'Node',
    })
    const snapshot = engine.getState()
    const fromSnapshot = snapshot.nodes.get(node.id)!

    expect(() => {
      ;(fromSnapshot as unknown as { x: number }).x = 999
    }).toThrow()
    expect(engine.getNode(node.id).x).toBe(10)
  })

  it('does not expose mutation methods on reactive collection values', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text' })
    engine.select(node.id)

    const nodes = engine.$nodes.get() as unknown as Map<unknown, unknown>
    const selection = engine.$selection.get() as unknown as Set<unknown>

    expect(nodes.set).toBeUndefined()
    expect(nodes.delete).toBeUndefined()
    expect(selection.add).toBeUndefined()
    expect(selection.clear).toBeUndefined()
    expect(engine.getNode(node.id)).toBeDefined()
  })

  it('emits paired batch command hooks', () => {
    const engine = createBoardEngine()
    const events: string[] = []
    engine.on('command:before', (name) => events.push(`before:${name}`))
    engine.on('command:after', (name) => events.push(`after:${name}`))

    engine.batch(() => {
      engine.createNode({ type: 'text', x: 0, y: 0, text: 'A' })
      engine.createNode({ type: 'text', x: 100, y: 0, text: 'B' })
    })

    expect(events).toEqual(['before:batch', 'after:batch'])
  })

  it('publishes a successful batch once with the pre-batch value', () => {
    const engine = createBoardEngine()
    const notifications: Array<[number, number]> = []
    engine.$nodes.subscribe((nodes, previousNodes) => {
      notifications.push([nodes.size, previousNodes.size])
    })

    engine.batch(() => {
      engine.createNode({ type: 'text', text: 'A' })
      engine.createNode({ type: 'text', text: 'B' })
    })

    expect(notifications).toEqual([[2, 0]])
  })

  it('rolls back a failed batch without publishing partial effects', () => {
    const commits: string[] = []
    const actionProbe: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'failed-batch-action-probe',
      install(featureEngine) {
        return featureEngine.projectCommit(
          (commit) => () => commits.push(commit.label),
        )
      },
    })
    const engine = createBoardEngine({ plugins: [actionProbe] })
    const before = engine.getState()
    const events: string[] = []
    const notifications: Array<[number, number]> = []
    engine.on('node:created', () => events.push('node:created'))
    engine.$nodes.subscribe((nodes, previousNodes) => {
      notifications.push([nodes.size, previousNodes.size])
    })

    expect(() =>
      engine.batch(() => {
        engine.createNode({ id: asNodeId('duplicate'), type: 'text' })
        engine.createNode({ id: asNodeId('duplicate'), type: 'text' })
      }),
    ).toThrow(BoardConflictError)

    expect(engine.getState()).toEqual(before)
    expect(commits).toEqual([])
    expect(events).toEqual([])
    expect(notifications).toEqual([])
  })

  it('merges imported nodes without overwriting existing ones', () => {
    const engine = createBoardEngine()
    const existing = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'original',
    })

    const importData = {
      nodes: [
        {
          id: existing.id,
          type: 'text',
          x: 500,
          y: 500,
          width: 240,
          height: 160,
          text: 'imported',
        },
      ],
      'x-vue-board': {
        camera: { x: 0, y: 0, z: 1 },
        grid: { size: 10, majorEvery: 5, snap: true, pattern: 'line' },
      },
    }

    engine.loadDocument(importData, { mode: 'merge' })

    const snapshot = engine.getState()
    expect(snapshot.nodes).toHaveLength(2)
    expect(snapshot.nodes.get(existing.id)?.text).toBe('original')
  })

  it('selectAll skips hidden nodes', () => {
    const engine = createBoardEngine()
    const visible = engine.createNode({
      type: 'text',
      x: 0,
      y: 0,
      text: 'Node',
    })
    engine.createNode({
      type: 'text',
      x: 100,
      y: 100,
      visible: false,
      text: 'Node',
    })

    engine.selectAll()

    expect(engine.getSelection()).toEqual([visible.id])
  })

  it('once handler fires exactly once then unsubscribes', () => {
    const engine = createBoardEngine()
    const handler = vi.fn()

    engine.once('node:created', handler)
    engine.createNode({ type: 'text', x: 0, y: 0, text: 'first' })
    engine.createNode({
      type: 'text',
      x: 100,
      y: 0,
      text: 'Node',
    })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emit catches handler exceptions without breaking other listeners', () => {
    const engine = createBoardEngine()
    const second = vi.fn()

    engine.on('node:created', () => {
      throw new Error('bad handler')
    })
    engine.on('node:created', second)

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    engine.createNode({ type: 'text', x: 0, y: 0, text: 'test' })
    spy.mockRestore()

    expect(second).toHaveBeenCalledTimes(1)
  })

  describe('groups', () => {
    it('moves all descendants when dragging a group', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 400,
        height: 400,
        select: false,
      })
      const child = engine.createNode({
        type: 'text',
        x: 40,
        y: 50,
        width: 100,
        height: 80,
        parentId: group.id,
        select: false,
        text: 'p',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.select([group.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(group.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 30, y: 20 })
      getBoardInteractionAdapter(engine).endInteraction(1)
      const snap = engine.getState()
      expect(snap.nodes.get(group.id)).toMatchObject({
        x: 30,
        y: 20,
      })
      expect(snap.nodes.get(child.id)).toMatchObject({
        x: 70,
        y: 70,
      })
    })

    it('keeps every descendant z-index above the group after bringToFront / drag bump', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        select: false,
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 20,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        text: 'p',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.bringToFront(group.id)
      const snap = engine.getState()
      const gz = snap.nodes.get(group.id)!.zIndex
      const cz = snap.nodes.get(child.id)!.zIndex
      expect(cz).toBeGreaterThan(gz)
    })

    it('keeps imported descendants above their group after hierarchy changes', () => {
      const engine = createBoardEngine({ grid: { snap: false } })

      engine.loadDocument(
        {
          nodes: [
            {
              id: 'group',
              type: 'group',
              x: 0,
              y: 0,
              width: 300,
              height: 300,
            },
            {
              id: 'child',
              type: 'text',
              x: 40,
              y: 40,
              width: 80,
              height: 60,
              text: 'Child',
            },
          ],
          'x-vue-board': {
            nodes: {
              group: { zIndex: 10, visible: true },
              child: { zIndex: 4, visible: true, parentId: 'group' },
            },
          },
        },
        { mode: 'replace' },
      )

      getBoardInteractionAdapter(engine).syncGroupZOrder(asNodeId('group'))
      engine.sendToBack(asNodeId('group'))

      const group = engine.getNode(asNodeId('group'))
      const child = engine.getNode(asNodeId('child'))
      expect(child.parentId).toBe(group.id)
      expect(child.zIndex).toBeGreaterThan(group.zIndex)
    })

    it('rejects parent links to non-groups and parent cycles before mutating', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const nonGroup = engine.createNode({
        type: 'text',
        x: 0,
        y: 0,
        text: 'Not a group',
      })
      const child = engine.createNode({
        type: 'text',
        x: 120,
        y: 0,
        text: 'Child',
      })
      const before = engine.getState()

      expect(() =>
        engine.updateNode(child.id, { parentId: nonGroup.id }),
      ).toThrow(/must be a group/)
      expect(engine.getState()).toEqual(before)

      const parentGroup = engine.createNode({
        type: 'group',
        x: 0,
        y: 120,
        width: 200,
        height: 200,
        select: false,
      })
      const childGroup = engine.createNode({
        type: 'group',
        x: 40,
        y: 160,
        width: 100,
        height: 100,
        parentId: parentGroup.id,
        select: false,
      })
      const beforeCycle = engine.getState()

      expect(() =>
        engine.updateNode(parentGroup.id, { parentId: childGroup.id }),
      ).toThrow(/parent cycle/)
      expect(engine.getState()).toEqual(beforeCycle)
    })

    it('does not move the group when dragging a child alone', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 100,
        y: 100,
        width: 400,
        height: 400,
        select: false,
      })
      const child = engine.createNode({
        type: 'text',
        x: 120,
        y: 130,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        text: 'p',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.select([child.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(child.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 10, y: 5 })
      getBoardInteractionAdapter(engine).endInteraction(1)
      const snap = engine.getState()
      expect(snap.nodes.get(group.id)).toMatchObject({
        x: 100,
        y: 100,
      })
      expect(snap.nodes.get(child.id)).toMatchObject({
        x: 130,
        y: 135,
      })
    })

    it('nudges a group and its children exactly once via translateSelectedNodes', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        select: false,
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 30,
        width: 60,
        height: 50,
        parentId: group.id,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.select([group.id, child.id])
      engine.translateSelectedNodes(10, 0)
      const snap = engine.getState()
      expect(snap.nodes.get(group.id)).toMatchObject({
        x: 10,
        y: 0,
      })
      expect(snap.nodes.get(child.id)).toMatchObject({
        x: 30,
        y: 30,
      })
    })

    it('reparents when a node moves fully into a group and clears parent when moving out', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        select: false,
      })
      const loose = engine.createNode({
        type: 'text',
        x: 300,
        y: 80,
        width: 40,
        height: 40,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.select([loose.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(loose.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: -200, y: 0 })
      getBoardInteractionAdapter(engine).endInteraction(1)
      expect(engine.getState().nodes.get(loose.id)?.parentId).toBe(group.id)

      getBoardInteractionAdapter(engine).beginNodeDrag(loose.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 250, y: 0 })
      getBoardInteractionAdapter(engine).endInteraction(1)
      expect(engine.getState().nodes.get(loose.id)?.parentId).toBeUndefined()
    })

    it('does not reparent a dragged node that is only partially inside a group', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        select: false,
      })
      const loose = engine.createNode({
        type: 'text',
        x: 300,
        y: 80,
        width: 80,
        height: 60,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)

      engine.select([loose.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(loose.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: -140, y: 0 })
      getBoardInteractionAdapter(engine).endInteraction(1)

      expect(engine.getState().nodes.get(loose.id)?.parentId).toBeUndefined()
    })

    it('captures stationary nodes when a group is dragged over them', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 220,
        height: 180,
        select: false,
      })
      const card = engine.createNode({
        type: 'text',
        x: 340,
        y: 40,
        width: 80,
        height: 60,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)

      engine.select([group.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(group.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 260, y: 0 })
      getBoardInteractionAdapter(engine).endInteraction(1)

      const snapshot = engine.getState()
      expect(snapshot.nodes.get(group.id)).toMatchObject({
        x: 260,
        y: 0,
      })
      expect(snapshot.nodes.get(card.id)?.parentId).toBe(group.id)
    })

    it('captures every fully contained stationary node when a group is dragged over a set', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 360,
        height: 260,
        select: false,
      })
      const cards = [
        engine.createNode({
          type: 'text',
          x: 460,
          y: 40,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
        engine.createNode({
          type: 'text',
          x: 640,
          y: 40,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
        engine.createNode({
          type: 'text',
          x: 460,
          y: 150,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
        engine.createNode({
          type: 'text',
          x: 640,
          y: 150,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
      ]
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)

      engine.select([group.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(group.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 420, y: 0 })
      getBoardInteractionAdapter(engine).endInteraction(1)

      const snapshot = engine.getState()
      expect(
        cards.map((card) => snapshot.nodes.get(card.id)?.parentId),
      ).toEqual([group.id, group.id, group.id, group.id])
    })

    it('captures every fully contained stationary node when a group is resized around a set', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 220,
        height: 180,
        select: false,
      })
      const cards = [
        engine.createNode({
          type: 'text',
          x: 260,
          y: 40,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
        engine.createNode({
          type: 'text',
          x: 420,
          y: 40,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
        engine.createNode({
          type: 'text',
          x: 260,
          y: 170,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
        engine.createNode({
          type: 'text',
          x: 420,
          y: 170,
          width: 100,
          height: 70,
          select: false,
          text: 'Node',
        }),
      ]
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)

      getBoardInteractionAdapter(engine).beginResize(group.id, 'se', 1, {
        x: 220,
        y: 180,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 560, y: 280 })
      getBoardInteractionAdapter(engine).endInteraction(1)

      const snapshot = engine.getState()
      expect(
        cards.map((card) => snapshot.nodes.get(card.id)?.parentId),
      ).toEqual([group.id, group.id, group.id, group.id])
    })

    it('does not capture stationary nodes that are only partially inside a moved group', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 220,
        height: 180,
        select: false,
      })
      const card = engine.createNode({
        type: 'text',
        x: 430,
        y: 40,
        width: 80,
        height: 60,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)

      engine.select([group.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(group.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 260, y: 0 })
      getBoardInteractionAdapter(engine).endInteraction(1)

      expect(engine.getState().nodes.get(card.id)?.parentId).toBeUndefined()
    })

    it('picks the smallest containing group when nested', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const outer = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 400,
        height: 400,
        select: false,
      })
      const inner = engine.createNode({
        type: 'group',
        x: 50,
        y: 50,
        width: 120,
        height: 120,
        parentId: outer.id,
        select: false,
      })
      const card = engine.createNode({
        type: 'text',
        x: 80,
        y: 80,
        width: 30,
        height: 30,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(outer.id)
      engine.select([card.id])
      getBoardInteractionAdapter(engine).beginNodeDrag(card.id, 1, {
        x: 0,
        y: 0,
      })
      getBoardInteractionAdapter(engine).updatePointer(1, { x: 0, y: 0 })
      getBoardInteractionAdapter(engine).endInteraction(1)
      expect(engine.getState().nodes.get(card.id)?.parentId).toBe(inner.id)
    })

    it('deleteSelected removes a group and all descendants and emits node:deleted for each', () => {
      const engine = createBoardEngine()
      const deleted: string[] = []
      engine.on('node:deleted', (id) => {
        deleted.push(id)
      })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        select: false,
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 20,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.select([group.id])
      engine.deleteSelected()
      expect(engine.getState().nodes.size).toBe(0)
      expect(deleted.sort()).toEqual([child.id, group.id].sort())
    })

    it('sendToBack on a group keeps descendants above the group', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      engine.createNode({
        type: 'text',
        x: 500,
        y: 0,
        width: 80,
        height: 60,
        select: false,
        text: 'Node',
      })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        select: false,
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 20,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        text: 'Node',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.sendToBack(group.id)
      const snap = engine.getState()
      const gz = snap.nodes.get(group.id)!.zIndex
      const cz = snap.nodes.get(child.id)!.zIndex
      expect(cz).toBeGreaterThan(gz)
    })

    it('copy and paste preserve parentId within the pasted forest', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        select: false,
      })
      const child = engine.createNode({
        type: 'text',
        x: 30,
        y: 40,
        width: 60,
        height: 50,
        parentId: group.id,
        select: false,
        text: 'p',
      })
      getBoardInteractionAdapter(engine).syncGroupZOrder(group.id)
      engine.select([group.id])
      engine.copySelected()
      engine.pasteClipboard({ x: 300, y: 0 })
      const snap = engine.getState()
      const pastedChild = Array.from(snap.nodes.values()).find(
        (n) => n.id !== child.id && n.type === 'text' && n.text === 'p',
      )
      const pastedGroup = Array.from(snap.nodes.values()).find(
        (n) =>
          n.id !== group.id &&
          n.type === 'group' &&
          pastedChild &&
          n.id === pastedChild.parentId,
      )
      expect(pastedGroup).toBeDefined()
      expect(pastedChild?.parentId).toBe(pastedGroup?.id)
    })
  })
})

describe('transaction isolation regressions', () => {
  it('rolls back when commit projection fails before public publication', () => {
    const plugin: InternalBoardPlugin = defineInternalBoardPlugin({
      name: 'failing-projector',
      install(engine) {
        return engine.projectCommit(() => {
          throw new Error('projection failed')
        })
      },
    })
    const engine = createBoardEngine({ plugins: [plugin] })
    const events: string[] = []
    engine.on('node:created', () => events.push('created'))

    expect(() => engine.createNode({ type: 'text' })).toThrow(
      'projection failed',
    )
    expect(engine.getState().nodes.size).toBe(0)
    expect(events).toEqual([])
  })

  it('aborts an outer batch when a failed inner batch is caught', () => {
    const engine = createBoardEngine()
    const events: string[] = []
    const notifications: number[] = []
    engine.on('node:created', (node) => events.push(node.id))
    engine.$nodes.subscribe((nodes) => notifications.push(nodes.size))

    expect(() =>
      engine.batch(() => {
        engine.createNode({ id: asNodeId('outer'), type: 'text' })
        try {
          engine.batch(() => {
            engine.createNode({ id: asNodeId('inner'), type: 'text' })
            engine.createNode({ id: asNodeId('inner'), type: 'text' })
          })
        } catch {
          // The outer transaction remains poisoned even when this is caught.
        }
      }),
    ).toThrow(BoardConflictError)

    expect(engine.getState().nodes.size).toBe(0)
    expect(engine.$nodes.get().size).toBe(0)
    expect(events).toEqual([])
    expect(notifications).toEqual([])
  })

  it('restores an active preview when an interrupting batch fails', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0 })
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 40, y: 20 })

    expect(() =>
      engine.batch(() => {
        engine.createNode({ id: asNodeId('duplicate'), type: 'text' })
        engine.createNode({ id: asNodeId('duplicate'), type: 'text' })
      }),
    ).toThrow(BoardConflictError)

    expect(engine.getState().interaction.mode).toBe('dragging-nodes')
    expect(engine.$nodes.get().get(node.id)).toMatchObject({ x: 40, y: 20 })
    interaction.cancelInteraction(1)
    expect(engine.getNode(node.id)).toMatchObject({ x: 0, y: 0 })
  })

  it('rolls the clipboard back with a failed batch', () => {
    const engine = createBoardEngine()
    engine.createNode({ id: asNodeId('keep'), type: 'text', text: 'keep' })
    engine.copySelected()

    expect(() =>
      engine.batch(() => {
        engine.createNode({
          id: asNodeId('candidate'),
          type: 'text',
          text: 'leak',
        })
        engine.copySelected()
        engine.createNode({ id: asNodeId('candidate'), type: 'text' })
      }),
    ).toThrow(BoardConflictError)

    engine.clearSelection()
    expect(engine.pasteClipboard().map((node) => node.text)).toEqual(['keep'])
  })

  it('preserves transient gesture geometry when document validation fails', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0 })
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 100, y: 0 })

    expect(() => engine.loadDocument({ invalid: true })).toThrow(
      BoardInputError,
    )
    expect(engine.getState().nodes.get(node.id)?.x).toBe(100)
    expect(engine.getState().interaction.mode).toBe('dragging-nodes')
  })

  it('discards transient geometry when an interaction is cancelled', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 0, y: 0 })
    const interaction = getBoardInteractionAdapter(engine)
    interaction.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    interaction.updatePointer(1, { x: 100, y: 0 })

    interaction.cancelInteraction(1)

    expect(engine.getNode(node.id).x).toBe(0)
    expect(engine.getState().interaction.mode).toBe('idle')
  })
})
