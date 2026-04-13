import { describe, expect, it, vi } from 'vitest'
import { createBoardEngine, type BoardPlugin } from '../src'

describe('board engine', () => {
  it('keeps zoom anchored to the cursor', () => {
    const engine = createBoardEngine()
    const point = { x: 320, y: 240 }
    const before = engine.screenToWorld(point)

    engine.zoomAt(point, -6)

    expect(engine.screenToWorld(point)).toEqual(before)
  })

  it('moves all selected nodes during a drag', () => {
    const engine = createBoardEngine()
    const first = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 100, y: 50, data: { content: 'B' } })
    engine.select([first.id, second.id])

    engine.beginNodeDrag(first.id, 1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 50, y: 20 })
    engine.endInteraction(1)

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodes.find((node) => node.id === first.id)).toMatchObject({ x: 50, y: 20 })
    expect(snapshot.nodes.find((node) => node.id === second.id)).toMatchObject({ x: 150, y: 70 })
  })

  it('supports box selection in screen space', () => {
    const engine = createBoardEngine()
    const first = engine.createNode({ type: 'text', x: 20, y: 20, width: 80, height: 60, data: { content: 'A' } })
    engine.createNode({ type: 'text', x: 420, y: 320, width: 80, height: 60, data: { content: 'B' } })

    engine.beginBoxSelect(1, { x: 0, y: 0 })
    engine.updatePointer(1, { x: 200, y: 160 })
    engine.endInteraction(1)

    expect(engine.getSelection()).toEqual([first.id])
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
      data: { content: 'Locked' }
    })

    expect(engine.moveNode(locked.id, 40, 20)).toMatchObject({ x: 20, y: 20 })
    expect(engine.resizeNode(locked.id, 'se', 80, 40)).toMatchObject({ width: 120, height: 100 })

    engine.select(locked.id)
    engine.deleteSelected()

    expect(engine.getSnapshot().nodes).toHaveLength(1)
  })

  it('fires command hooks and installs plugins only once per name', () => {
    const events: string[] = []
    let installs = 0
    const plugin: BoardPlugin = {
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
      }
    }

    const engine = createBoardEngine({ plugins: [plugin] })
    engine.use(plugin)
    engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'Hello' } })

    expect(installs).toBe(1)
    expect(events).toContain('before:createNode')
    expect(events).toContain('after:createNode')
  })

  it('fits nodes into the viewport', async () => {
    const engine = createBoardEngine()
    engine.setViewportSize({ x: 640, y: 480 })
    const first = engine.createNode({ type: 'text', x: 0, y: 0, width: 120, height: 80, data: { content: 'A' } })
    const second = engine.createNode({ type: 'text', x: 1200, y: 900, width: 120, height: 80, data: { content: 'B' } })

    await engine.zoomToFit(40, false)

    const visible = engine.getVisibleBounds(640, 480)
    expect(visible.minX).toBeLessThanOrEqual(first.x)
    expect(visible.maxX).toBeGreaterThanOrEqual(second.x + second.width)
    expect(visible.minY).toBeLessThanOrEqual(first.y)
    expect(visible.maxY).toBeGreaterThanOrEqual(second.y + second.height)
  })

  it('resizes from the nw handle, moving origin while shrinking', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({ type: 'text', x: 100, y: 100, width: 200, height: 200, data: {} })

    const result = engine.resizeNode(node.id, 'nw', 30, 40)

    expect(result.x).toBe(130)
    expect(result.y).toBe(140)
    expect(result.width).toBe(170)
    expect(result.height).toBe(160)
  })

  it('deletes a node while it is being dragged without throwing', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'temp' } })

    engine.beginNodeDrag(node.id, 1, { x: 0, y: 0 })
    engine.deleteNode(node.id)

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodes).toHaveLength(0)
    expect(snapshot.interaction.mode).toBe('idle')
  })

  it('returns detached public nodes from snapshots', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 10, y: 20, data: { content: 'immutable' } })
    const snapshot = engine.getSnapshot()
    const fromSnapshot = snapshot.nodes.find((entry) => entry.id === node.id)!

    expect(() => {
      ;(fromSnapshot as unknown as { x: number }).x = 999
    }).toThrow()
    expect(engine.getNode(node.id).x).toBe(10)
  })

  it('emits paired batch command hooks', () => {
    const engine = createBoardEngine()
    const events: string[] = []
    engine.on('command:before', (name) => events.push(`before:${name}`))
    engine.on('command:after', (name) => events.push(`after:${name}`))

    engine.batch(() => {
      engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
      engine.createNode({ type: 'text', x: 100, y: 0, data: { content: 'B' } })
    })

    expect(events).toEqual(['before:batch', 'after:batch'])
  })

  it('merges imported nodes without overwriting existing ones', () => {
    const engine = createBoardEngine()
    const existing = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'original' } })

    const importData = {
      camera: { x: 0, y: 0, z: 1 },
      grid: { size: 10, majorEvery: 5, snap: true, pattern: 'line' },
      nodes: [
        { id: existing.id, type: 'text', x: 500, y: 500, width: 240, height: 160, data: { content: 'imported' }, zIndex: 1, locked: false, visible: true }
      ],
      selection: [],
      interaction: { mode: 'idle' },
      nextZIndex: 2
    }

    engine.importJSON(JSON.stringify(importData), 'merge')

    const snapshot = engine.getSnapshot()
    expect(snapshot.nodes).toHaveLength(2)
    expect(snapshot.nodes.find((n) => n.id === existing.id)?.data).toEqual({ content: 'original' })
  })

  it('selectAll skips hidden nodes', () => {
    const engine = createBoardEngine()
    const visible = engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'A' } })
    engine.createNode({ type: 'text', x: 100, y: 100, visible: false, data: { content: 'B' } })

    engine.selectAll()

    expect(engine.getSelection()).toEqual([visible.id])
  })

  it('once handler fires exactly once then unsubscribes', () => {
    const engine = createBoardEngine()
    const handler = vi.fn()

    engine.once('node:created', handler)
    engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'first' } })
    engine.createNode({ type: 'text', x: 100, y: 0, data: { content: 'second' } })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emit catches handler exceptions without breaking other listeners', () => {
    const engine = createBoardEngine()
    const second = vi.fn()

    engine.on('node:created', () => { throw new Error('bad handler') })
    engine.on('node:created', second)

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    engine.createNode({ type: 'text', x: 0, y: 0, data: { content: 'test' } })
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
        select: false
      })
      const child = engine.createNode({
        type: 'text',
        x: 40,
        y: 50,
        width: 100,
        height: 80,
        parentId: group.id,
        select: false,
        data: { content: 'in' }
      })
      engine.syncGroupZOrder(group.id)
      engine.select([group.id])
      engine.beginNodeDrag(group.id, 1, { x: 0, y: 0 })
      engine.updatePointer(1, { x: 30, y: 20 })
      engine.endInteraction(1)
      const snap = engine.getSnapshot()
      expect(snap.nodes.find((n) => n.id === group.id)).toMatchObject({ x: 30, y: 20 })
      expect(snap.nodes.find((n) => n.id === child.id)).toMatchObject({ x: 70, y: 70 })
    })

    it('keeps every descendant z-index above the group after bringToFront / drag bump', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        select: false
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 20,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        data: { content: 'c' }
      })
      engine.syncGroupZOrder(group.id)
      engine.bringToFront(group.id)
      const snap = engine.getSnapshot()
      const gz = snap.nodes.find((n) => n.id === group.id)!.zIndex
      const cz = snap.nodes.find((n) => n.id === child.id)!.zIndex
      expect(cz).toBeGreaterThan(gz)
    })

    it('does not move the group when dragging a child alone', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 100,
        y: 100,
        width: 400,
        height: 400,
        select: false
      })
      const child = engine.createNode({
        type: 'text',
        x: 120,
        y: 130,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        data: { content: 'c' }
      })
      engine.syncGroupZOrder(group.id)
      engine.select([child.id])
      engine.beginNodeDrag(child.id, 1, { x: 0, y: 0 })
      engine.updatePointer(1, { x: 10, y: 5 })
      engine.endInteraction(1)
      const snap = engine.getSnapshot()
      expect(snap.nodes.find((n) => n.id === group.id)).toMatchObject({ x: 100, y: 100 })
      expect(snap.nodes.find((n) => n.id === child.id)).toMatchObject({ x: 130, y: 135 })
    })

    it('nudges a group and its children exactly once via translateSelectedNodes', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        select: false
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 30,
        width: 60,
        height: 50,
        parentId: group.id,
        select: false,
        data: { content: 'x' }
      })
      engine.syncGroupZOrder(group.id)
      engine.select([group.id, child.id])
      engine.translateSelectedNodes(10, 0)
      const snap = engine.getSnapshot()
      expect(snap.nodes.find((n) => n.id === group.id)).toMatchObject({ x: 10, y: 0 })
      expect(snap.nodes.find((n) => n.id === child.id)).toMatchObject({ x: 30, y: 30 })
    })

    it('reparents when a node center moves into a group and clears parent when moving out', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        select: false
      })
      const loose = engine.createNode({
        type: 'text',
        x: 300,
        y: 80,
        width: 40,
        height: 40,
        select: false,
        data: { content: 'free' }
      })
      engine.syncGroupZOrder(group.id)
      engine.select([loose.id])
      engine.beginNodeDrag(loose.id, 1, { x: 0, y: 0 })
      engine.updatePointer(1, { x: -200, y: 0 })
      engine.endInteraction(1)
      expect(engine.getSnapshot().nodes.find((n) => n.id === loose.id)?.parentId).toBe(group.id)

      engine.beginNodeDrag(loose.id, 1, { x: 0, y: 0 })
      engine.updatePointer(1, { x: 250, y: 0 })
      engine.endInteraction(1)
      expect(engine.getSnapshot().nodes.find((n) => n.id === loose.id)?.parentId).toBeUndefined()
    })

    it('picks the smallest containing group when nested', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      const outer = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 400,
        height: 400,
        select: false
      })
      const inner = engine.createNode({
        type: 'group',
        x: 50,
        y: 50,
        width: 120,
        height: 120,
        parentId: outer.id,
        select: false
      })
      const card = engine.createNode({
        type: 'text',
        x: 80,
        y: 80,
        width: 30,
        height: 30,
        select: false,
        data: { content: 'n' }
      })
      engine.syncGroupZOrder(outer.id)
      engine.select([card.id])
      engine.beginNodeDrag(card.id, 1, { x: 0, y: 0 })
      engine.updatePointer(1, { x: 0, y: 0 })
      engine.endInteraction(1)
      expect(engine.getSnapshot().nodes.find((n) => n.id === card.id)?.parentId).toBe(inner.id)
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
        select: false
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 20,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        data: { content: 'c' }
      })
      engine.syncGroupZOrder(group.id)
      engine.select([group.id])
      engine.deleteSelected()
      expect(engine.getSnapshot().nodes).toHaveLength(0)
      expect(deleted.sort()).toEqual([child.id, group.id].sort())
    })

    it('sendToBack on a group keeps descendants above the group', () => {
      const engine = createBoardEngine({ grid: { snap: false } })
      engine.createNode({ type: 'text', x: 500, y: 0, width: 80, height: 60, select: false, data: { content: 'other' } })
      const group = engine.createNode({
        type: 'group',
        x: 0,
        y: 0,
        width: 300,
        height: 300,
        select: false
      })
      const child = engine.createNode({
        type: 'text',
        x: 20,
        y: 20,
        width: 80,
        height: 60,
        parentId: group.id,
        select: false,
        data: { content: 'c' }
      })
      engine.syncGroupZOrder(group.id)
      engine.sendToBack(group.id)
      const snap = engine.getSnapshot()
      const gz = snap.nodes.find((n) => n.id === group.id)!.zIndex
      const cz = snap.nodes.find((n) => n.id === child.id)!.zIndex
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
        select: false
      })
      const child = engine.createNode({
        type: 'text',
        x: 30,
        y: 40,
        width: 60,
        height: 50,
        parentId: group.id,
        select: false,
        data: { content: 'p' }
      })
      engine.syncGroupZOrder(group.id)
      engine.select([group.id])
      engine.copySelected()
      engine.pasteClipboard({ x: 300, y: 0 })
      const snap = engine.getSnapshot()
      const pastedChild = snap.nodes.find(
        (n) => n.id !== child.id && n.type === 'text' && (n.data as { content?: string }).content === 'p'
      )
      const pastedGroup = snap.nodes.find(
        (n) => n.id !== group.id && n.type === 'group' && pastedChild && n.id === pastedChild.parentId
      )
      expect(pastedGroup).toBeDefined()
      expect(pastedChild?.parentId).toBe(pastedGroup?.id)
    })
  })
})
