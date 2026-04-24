import { expect, test, type Page } from '@playwright/test'

type PlaygroundEngine = {
  getSnapshot: () => {
    nodes: Array<{
      id: string
      x: number
      y: number
      width: number
      height: number
    }>
    selection: string[]
  }
  getNode: (id: string) => {
    id: string
    x: number
    y: number
    width: number
    height: number
  }
  beginNodeDrag: (
    id: string,
    pointerId: number,
    screenPoint: { x: number; y: number },
  ) => void
  beginBoxSelect: (
    pointerId: number,
    screenPoint: { x: number; y: number },
  ) => void
  updatePointer: (
    pointerId: number,
    screenPoint: { x: number; y: number },
  ) => void
  endInteraction: (pointerId?: number) => void
  createNode: (input: Record<string, unknown>) => {
    id: string
    x: number
    y: number
    width: number
    height: number
  }
  select: (ids: string | string[]) => void
  clearSelection: () => void
  getSelection: () => string[]
  ext: {
    history?: {
      undo: () => void
      redo: () => void
      canUndo: () => boolean
      canRedo: () => boolean
    }
    connections?: {
      getEdges: () => Array<{ id: string; from: string; to: string }>
      createEdge: (input: Record<string, unknown>) => { id: string }
      deleteEdge: (id: string) => void
    }
  }
}

const getEngine = async (page: Page): Promise<PlaygroundEngine> => {
  // returned via page.evaluate in each call — this is a typed shim only
  throw new Error('use page.evaluate to access engine')
}

void getEngine

test.describe('drag, resize, box-select, undo/redo, edge-create — refactor pins', () => {
  test('pointer drag through DOM moves a node by the cursor delta', async ({
    page,
  }) => {
    await page.goto('/')

    const target = page.locator('[data-node-id]').first()
    const id = await target.getAttribute('data-node-id')
    if (!id) throw new Error('no node id on target')

    const before = await page.evaluate(
      (nodeId) =>
        (
          window as unknown as {
            __boardPlayground: { engine: PlaygroundEngine }
          }
        ).__boardPlayground.engine.getNode(nodeId),
      id,
    )

    const box = await target.boundingBox()
    if (!box) throw new Error('no bounding box for target')

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    const dx = 80
    const dy = 40
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // Move in many small steps to clear any drag threshold and trigger the
    // pointer interaction state machine in BoardRoot.
    await page.mouse.move(startX + dx, startY + dy, { steps: 20 })
    await page.mouse.up()

    const after = await page.evaluate(
      (nodeId) =>
        (
          window as unknown as {
            __boardPlayground: { engine: PlaygroundEngine }
          }
        ).__boardPlayground.engine.getNode(nodeId),
      id,
    )

    // Behavior pin: a DOM mouse drag must result in the node moving.
    // We don't assert the exact delta — grid snap, camera zoom, or future
    // refactors can shift the relationship between screen pixels and world
    // units. We only require motion of the same sign as the cursor delta.
    expect(after.x).not.toBe(before.x)
    expect(after.y).not.toBe(before.y)
    expect(Math.sign(after.x - before.x)).toBe(Math.sign(dx))
    expect(Math.sign(after.y - before.y)).toBe(Math.sign(dy))
  })

  test('dragging a selected node preserves and moves the full selection', async ({
    page,
  }) => {
    await page.goto('/')

    const setup = await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      const a = engine.createNode({
        type: 'text',
        x: 360,
        y: 260,
        width: 120,
        height: 72,
        data: { content: 'Multi A' },
      })
      const b = engine.createNode({
        type: 'text',
        x: 520,
        y: 260,
        width: 120,
        height: 72,
        data: { content: 'Multi B' },
      })
      engine.select([a.id, b.id])
      return {
        aId: a.id,
        bId: b.id,
        beforeA: engine.getNode(a.id),
        beforeB: engine.getNode(b.id),
        selection: engine.getSelection(),
      }
    })

    expect(setup.selection).toEqual([setup.aId, setup.bId])

    const dragSource = page.locator(`[data-node-id="${setup.aId}"]`)
    const sourceBox = await dragSource.boundingBox()
    if (!sourceBox) throw new Error('no bounding box for drag source')

    const startX = sourceBox.x + sourceBox.width / 2
    const startY = sourceBox.y + sourceBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 96, startY + 48, { steps: 16 })
    await page.mouse.up()

    const result = await page.evaluate(
      ({ aId, bId }) => {
        const engine = (
          window as unknown as {
            __boardPlayground: { engine: PlaygroundEngine }
          }
        ).__boardPlayground.engine
        return {
          afterA: engine.getNode(aId),
          afterB: engine.getNode(bId),
          selection: engine.getSelection(),
        }
      },
      { aId: setup.aId, bId: setup.bId },
    )

    expect(result.selection).toEqual([setup.aId, setup.bId])
    expect(result.afterA.x).not.toBe(setup.beforeA.x)
    expect(result.afterB.x).not.toBe(setup.beforeB.x)
    expect(Math.sign(result.afterA.x - setup.beforeA.x)).toBe(1)
    expect(Math.sign(result.afterB.x - setup.beforeB.x)).toBe(1)
    expect(result.afterB.x - setup.beforeB.x).toBeCloseTo(
      result.afterA.x - setup.beforeA.x,
      5,
    )
    expect(result.afterB.y - setup.beforeB.y).toBeCloseTo(
      result.afterA.y - setup.beforeA.y,
      5,
    )
  })

  test('box-select selects nodes within the rectangle', async ({ page }) => {
    await page.goto('/')

    const result = await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      engine.clearSelection()
      const a = engine.createNode({
        type: 'text',
        x: 1000,
        y: 1000,
        width: 60,
        height: 40,
        data: { content: 'A' },
      })
      const b = engine.createNode({
        type: 'text',
        x: 1100,
        y: 1010,
        width: 60,
        height: 40,
        data: { content: 'B' },
      })
      const c = engine.createNode({
        type: 'text',
        x: 2000,
        y: 2000,
        width: 60,
        height: 40,
        data: { content: 'C' },
      })

      // Drive box-select at the engine layer using world coordinates that
      // translate through whatever camera is active.
      engine.beginBoxSelect(99, { x: -10000, y: -10000 })
      engine.updatePointer(99, { x: 10000, y: 10000 })
      engine.endInteraction(99)

      const sel = engine.getSelection()
      return { aId: a.id, bId: b.id, cId: c.id, selection: sel }
    })

    // The selection should contain A, B, C (and possibly other seeded nodes).
    expect(result.selection).toEqual(
      expect.arrayContaining([result.aId, result.bId, result.cId]),
    )
  })

  test('undo restores a deleted node and redo re-deletes it', async ({
    page,
  }) => {
    await page.goto('/')

    const created = await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      const node = engine.createNode({
        type: 'text',
        x: 500,
        y: 500,
        data: { content: 'Undo target' },
      })
      return { id: node.id }
    })

    const node = page.locator(`[data-node-id="${created.id}"]`)
    await expect(node).toBeVisible()

    // Allow createNode to settle past history's debounce window before issuing
    // the next *different-named* command. (The current snapshot-based history
    // plugin only commits a pending entry when the next command of a
    // different name fires — see board-history/src/index.ts queuePush — so
    // back-to-back commands inside the same event loop tick mis-snapshot
    // the "before" state. Step 7 rewrites this on top of inverse actions.)
    await page.waitForTimeout(450)

    await page.evaluate((nodeId) => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      ;(engine as unknown as { deleteNode: (id: string) => void }).deleteNode(
        nodeId,
      )
    }, created.id)
    await expect(node).toHaveCount(0)

    await page.waitForTimeout(450)
    await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      engine.ext.history?.undo()
    })
    await expect(node).toHaveCount(1)

    await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      engine.ext.history?.redo()
    })
    await expect(node).toHaveCount(0)
  })

  test('undo restores a moved node to its prior position', async ({ page }) => {
    await page.goto('/')

    const setup = await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      const node = engine.createNode({
        type: 'text',
        x: 700,
        y: 300,
        data: { content: 'Moveable' },
      })
      return { id: node.id, x: node.x, y: node.y }
    })

    // Allow the create command to settle in history before issuing the move.
    await page.waitForTimeout(450)

    await page.evaluate((nodeId) => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      ;(
        engine as unknown as {
          moveNode: (id: string, dx: number, dy: number) => void
        }
      ).moveNode(nodeId, 80, 60)
    }, setup.id)

    const moved = await page.evaluate(
      (nodeId) =>
        (
          window as unknown as {
            __boardPlayground: { engine: PlaygroundEngine }
          }
        ).__boardPlayground.engine.getNode(nodeId),
      setup.id,
    )
    expect(moved.x).not.toBe(setup.x)

    // Wait for the move command to settle in history's debounce window.
    await page.waitForTimeout(450)

    const board = page.locator('.board-root').first()
    await board.focus()
    await page.keyboard.press('Control+Z')

    // Poll until undo restores the position (history applies asynchronously).
    await expect
      .poll(async () =>
        page.evaluate(
          (nodeId) =>
            (
              window as unknown as {
                __boardPlayground: { engine: PlaygroundEngine }
              }
            ).__boardPlayground.engine.getNode(nodeId).x,
          setup.id,
        ),
      )
      .toBe(setup.x)

    const restored = await page.evaluate(
      (nodeId) =>
        (
          window as unknown as {
            __boardPlayground: { engine: PlaygroundEngine }
          }
        ).__boardPlayground.engine.getNode(nodeId),
      setup.id,
    )
    expect(restored.x).toBe(setup.x)
    expect(restored.y).toBe(setup.y)
  })

  test('createEdge via plugin API persists in the engine state', async ({
    page,
  }) => {
    await page.goto('/')

    const result = await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      const connections = engine.ext.connections
      if (!connections) throw new Error('connections plugin not installed')

      const a = engine.createNode({
        type: 'text',
        x: 1500,
        y: 1500,
        data: { content: 'edge A' },
      })
      const b = engine.createNode({
        type: 'text',
        x: 1700,
        y: 1500,
        data: { content: 'edge B' },
      })
      const before = connections.getEdges().length

      const edge = connections.createEdge({
        from: a.id,
        to: b.id,
        label: 'safety',
        data: {},
      })
      const after = connections.getEdges().length

      return { before, after, edgeId: edge.id, fromId: a.id, toId: b.id }
    })

    expect(result.after).toBe(result.before + 1)
    expect(result.edgeId).toBeTruthy()
  })

  test('cascade-delete removes edges connected to a deleted node', async ({
    page,
  }) => {
    await page.goto('/')

    const result = await page.evaluate(() => {
      const engine = (
        window as unknown as { __boardPlayground: { engine: PlaygroundEngine } }
      ).__boardPlayground.engine
      const connections = engine.ext.connections
      if (!connections) throw new Error('connections plugin not installed')

      const a = engine.createNode({ type: 'text', x: 2200, y: 2200, data: {} })
      const b = engine.createNode({ type: 'text', x: 2400, y: 2200, data: {} })
      connections.createEdge({
        from: a.id,
        to: b.id,
        label: 'cascade',
        data: {},
      })

      engine.select(a.id)
      const before = connections
        .getEdges()
        .filter((e) => e.from === a.id || e.to === a.id).length

      // delete the node — edges referencing it should be removed
      ;(engine as unknown as { deleteNode: (id: string) => void }).deleteNode(
        a.id,
      )
      const after = connections
        .getEdges()
        .filter((e) => e.from === a.id || e.to === a.id).length
      return { before, after }
    })

    expect(result.before).toBeGreaterThan(0)
    expect(result.after).toBe(0)
  })
})
