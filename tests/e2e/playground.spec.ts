import { expect, test } from '@playwright/test'

test('creates, edits, drags, resizes, and deletes cards', async ({ page }) => {
  await page.goto('/')

  const totalNodes = async () =>
    page.evaluate(() => {
      return (window as Window & { __canvasPlayground: { engine: { getSnapshot: () => { nodes: unknown[] } } } })
        .__canvasPlayground.engine.getSnapshot().nodes.length
    })

  const canvas = page.locator('.canvas-root')
  await canvas.dblclick({ position: { x: 420, y: 220 } })
  await expect.poll(totalNodes).toBe(101)
  await expect(page.locator('[data-node-id]')).toHaveCount(21)

  const latestCard = page.locator('[data-node-id]').last()
  const editor = page.locator('textarea').last()
  await editor.fill('Bench note')
  await editor.blur()
  await expect(latestCard).toContainText('Bench note')

  const before = await latestCard.boundingBox()
  await latestCard.dragTo(canvas, {
    targetPosition: { x: 560, y: 360 }
  })
  const after = await latestCard.boundingBox()
  expect(before?.x).not.toBe(after?.x)

  const handle = latestCard.locator('[data-resize="se"]')
  const handleBox = await handle.boundingBox()
  if (!handleBox) {
    throw new Error('Resize handle is not visible.')
  }
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 80, handleBox.y + 60)
  await page.mouse.up()
  const resized = await latestCard.boundingBox()
  expect(resized?.width).toBeGreaterThan(before?.width ?? 0)

  await latestCard.click()
  await page.keyboard.press('Delete')
  await expect.poll(totalNodes).toBe(100)
})

test('zooms to the cursor and updates diagnostics', async ({ page }) => {
  await page.goto('/')
  const cameraBefore = await page.locator('.debug-overlay dd').nth(0).textContent()

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

  const cameraAfter = await page.locator('.debug-overlay dd').nth(0).textContent()
  expect(cameraBefore).not.toBe(cameraAfter)
  await expect(page.locator('.debug-overlay')).toContainText('zoomAtScreenPoint')
})
