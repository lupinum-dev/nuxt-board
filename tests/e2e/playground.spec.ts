import { expect, test } from '@playwright/test'

test('creates, edits, duplicates, and deletes nodes', async ({ page }) => {
  await page.goto('/')

  const totalNodes = async () =>
    page.evaluate(() => {
      const api = (
        window as unknown as {
          __boardPlayground: {
            engine: { getState: () => { nodes: Map<string, unknown> } }
          }
        }
      ).__boardPlayground
      return api.engine.getState().nodes.size
    })

  const created = await page.evaluate(() => {
    const api = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            createNode: (input: Record<string, unknown>) => { id: string }
            commitTextEdit: (id: string, text: string) => void
            getState: () => { nodes: Map<string, unknown> }
          }
        }
      }
    ).__boardPlayground
    const node = api.engine.createNode({
      type: 'text',
      x: 420,
      y: 220,
      text: 'Node',
    })
    api.engine.commitTextEdit(node.id, 'Bench note')
    return { id: node.id, count: api.engine.getState().nodes.size }
  })

  await expect.poll(totalNodes).toBe(created.count)
  const createdNode = page.locator(`[data-node-id="${created.id}"]`)
  await expect(createdNode).toContainText('Bench note')

  await createdNode.click()
  await page.keyboard.press('Control+D')
  await expect.poll(totalNodes).toBe(created.count + 1)

  await page.keyboard.press('Delete')
  await expect.poll(totalNodes).toBe(created.count)
})

test('supports multiline text editing inside a node', async ({ page }) => {
  await page.goto('/')

  const created = await page.evaluate(() => {
    const api = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            createNode: (input: Record<string, unknown>) => { id: string }
            getState: () => { nodes: Map<string, unknown> }
          }
        }
      }
    ).__boardPlayground
    const node = api.engine.createNode({
      type: 'text',
      x: 420,
      y: 220,
      text: 'Node',
    })
    return { id: node.id, count: api.engine.getState().nodes.size }
  })

  const createdNode = page.locator(`[data-node-id="${created.id}"]`)
  await createdNode.dblclick()

  const editor = page.locator('textarea[data-editor="true"]')
  await expect(editor).toBeFocused()
  await editor.fill('First line')
  await editor.press('End')
  await editor.press('Enter')
  await editor.type('Second line')
  await expect(editor).toHaveValue('First line\nSecond line')

  await editor.press(
    process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter',
  )
  await expect(createdNode).toContainText('First line')
  await expect(createdNode).toContainText('Second line')
})

test('supports alt-drag duplication and benchmark reporting', async ({
  page,
}) => {
  await page.goto('/')

  const totalNodes = async () =>
    page.evaluate(() => {
      const api = (
        window as unknown as {
          __boardPlayground: {
            engine: { getState: () => { nodes: Map<string, unknown> } }
          }
        }
      ).__boardPlayground
      return api.engine.getState().nodes.size
    })

  const firstNode = page.locator('[data-node-id]').first()
  const box = await firstNode.boundingBox()
  if (!box) {
    throw new Error('Missing node bounds')
  }

  const before = await totalNodes()
  await page.keyboard.down('Alt')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width / 2 + 44,
    box.y + box.height / 2 + 32,
    { steps: 8 },
  )
  await page.mouse.up()
  await page.keyboard.up('Alt')

  await expect.poll(totalNodes).toBe(before + 1)

  await page.getByRole('button', { name: 'Benchmark' }).click()
  await expect(page.getByText(/total .* avg .* max/i)).toBeVisible()
})

test('renders connections, minimap, and import/export helpers', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.locator('.board-connection-layer')).toBeVisible()
  await expect(
    page.locator('.board-connection-layer [data-connection-hit="true"]'),
  ).toHaveCount(2)
  await expect(page.locator('.board-minimap')).toBeVisible()

  const before = await page.getByTestId('camera-value').textContent()
  await page.locator('.board-root').evaluate((element) => {
    element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        clientX: 300,
        clientY: 240,
        deltaY: -120,
      }),
    )
  })
  const after = await page.getByTestId('camera-value').textContent()
  expect(before).not.toBe(after)

  const exportedLength = await page.evaluate(() => {
    const api = (
      window as unknown as {
        __boardPlayground: { exportJsonCanvas: () => string }
      }
    ).__boardPlayground
    return api.exportJsonCanvas().length
  })
  expect(exportedLength).toBeGreaterThan(10)
})

test('colors selected cards and groups through the selection toolbar', async ({
  page,
}) => {
  await page.goto('/')

  const setup = await page.evaluate(() => {
    const api = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            createNode: (input: Record<string, unknown>) => { id: string }
            select: (ids: string[]) => void
          }
        }
      }
    ).__boardPlayground
    const card = api.engine.createNode({
      type: 'text',
      x: 420,
      y: 240,
      width: 220,
      height: 120,
      text: 'Node',
    })
    const group = api.engine.createNode({
      type: 'group',
      x: 380,
      y: 200,
      width: 320,
      height: 220,
      label: 'Group',
    })
    api.engine.select([card.id, group.id])
    return { cardId: card.id, groupId: group.id }
  })

  await page.locator('[data-node-color-menu-button="true"]').click()
  await page.locator('[data-node-color-option="6"]').click()

  const result = await page.evaluate(({ cardId, groupId }) => {
    const api = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            getState: () => {
              nodes: Map<string, { id: string; color?: string }>
            }
          }
          exportJsonCanvas: () => string
        }
      }
    ).__boardPlayground
    const snapshot = api.engine.getState()
    const exported = JSON.parse(api.exportJsonCanvas()) as {
      nodes: Array<{ id: string; color?: string }>
    }
    return {
      card: snapshot.nodes.get(cardId),
      group: snapshot.nodes.get(groupId),
      exportedCard: exported.nodes.find((node) => node.id === cardId),
      exportedGroup: exported.nodes.find((node) => node.id === groupId),
    }
  }, setup)

  expect(result.card?.color).toBe('6')
  expect(result.group?.color).toBe('6')
  expect(result.exportedCard?.color).toBe('6')
  expect(result.exportedGroup?.color).toBe('6')
  await expect(page.locator(`[data-node-id="${setup.cardId}"]`)).toHaveClass(
    /is-colored/,
  )
})

test('dragging a group over cards captures them as children', async ({
  page,
}) => {
  await page.goto('/')

  const setup = await page.evaluate(() => {
    const api = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            createNode: (input: Record<string, unknown>) => { id: string }
            select: (ids: string[]) => void
          }
        }
      }
    ).__boardPlayground
    const group = api.engine.createNode({
      type: 'group',
      x: 320,
      y: 220,
      width: 220,
      height: 180,
      label: 'Group',
    })
    const card = api.engine.createNode({
      type: 'text',
      x: 720,
      y: 260,
      width: 120,
      height: 80,
      text: 'Node',
    })
    api.engine.select([group.id])
    return { groupId: group.id, cardId: card.id }
  })

  const group = page.locator(`[data-node-id="${setup.groupId}"]`)
  const card = page.locator(`[data-node-id="${setup.cardId}"]`)
  const groupBox = await group.boundingBox()
  const cardBox = await card.boundingBox()
  if (!groupBox || !cardBox) {
    throw new Error('Missing group or card bounds')
  }

  await page.mouse.move(
    groupBox.x + groupBox.width / 2,
    groupBox.y + groupBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2,
    { steps: 10 },
  )
  await page.mouse.up()

  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const api = (
            window as unknown as {
              __boardPlayground: {
                engine: {
                  getState: () => {
                    nodes: Map<string, { id: string; parentId?: string }>
                  }
                }
              }
            }
          ).__boardPlayground
          return api.engine.getState().nodes.get(id)?.parentId
        }, setup.cardId),
      { message: 'card should be parented to the moved group' },
    )
    .toBe(setup.groupId)
})
