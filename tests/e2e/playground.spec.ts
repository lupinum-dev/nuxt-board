import { expect, test } from '@playwright/test'

test('creates, edits, duplicates, and deletes nodes', async ({ page }) => {
  await page.goto('/')

  const totalNodes = async () =>
    page.evaluate(() => {
      const api = (window as unknown as {
        __canvasPlayground: { engine: { getSnapshot: () => { nodes: unknown[] } } }
      }).__canvasPlayground
      return api.engine.getSnapshot().nodes.length
    })

  const created = await page.evaluate(() => {
    const api = (window as unknown as {
      __canvasPlayground: {
        engine: {
          createNode: (input: Record<string, unknown>) => { id: string }
          commitTextEdit: (id: string, text: string) => void
          getSnapshot: () => { nodes: unknown[] }
        }
      }
    }).__canvasPlayground
    const node = api.engine.createNode({
      type: 'text',
      x: 420,
      y: 220,
      data: { content: 'Bench note' }
    })
    api.engine.commitTextEdit(node.id, 'Bench note')
    return { id: node.id, count: api.engine.getSnapshot().nodes.length }
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

test('renders connections, minimap, and serializer helpers', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.canvas-connection-layer')).toBeVisible()
  await expect(page.locator('.canvas-connection-layer path')).toHaveCount(2)
  await expect(page.locator('.canvas-minimap')).toBeVisible()

  const before = await page.getByTestId('camera-value').textContent()
  await page.locator('.canvas-root').evaluate((element) => {
    element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        clientX: 300,
        clientY: 240,
        deltaY: -120
      })
    )
  })
  const after = await page.getByTestId('camera-value').textContent()
  expect(before).not.toBe(after)

  const exportedLength = await page.evaluate(() => {
    const api = (window as unknown as {
      __canvasPlayground: { exportJsonCanvas: () => string }
    }).__canvasPlayground
    return api.exportJsonCanvas().length
  })
  expect(exportedLength).toBeGreaterThan(10)
})
