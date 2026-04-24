import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60_000 })

async function seedConnectionScene(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() =>
    Boolean(
      (
        window as unknown as {
          __boardPlayground?: { engine?: unknown }
        }
      ).__boardPlayground?.engine,
    ),
  )
  await page.evaluate(() => {
    const api = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            importJSON: (snapshot: string, mode: 'replace' | 'merge') => void
            zoomTo: (level: number, animated?: boolean) => Promise<void>
            ext: {
              connections: {
                getEdges: () => Array<{ id: string }>
                deleteEdge: (id: string) => void
                createEdge: (input: Record<string, unknown>) => void
              }
            }
          }
        }
      }
    ).__boardPlayground

    api.engine.importJSON(
      JSON.stringify({
        camera: { x: -80, y: -40, z: 1 },
        grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
        nodes: [
          {
            id: 'input',
            type: 'text',
            x: 80,
            y: 150,
            width: 180,
            height: 96,
            data: { content: 'Input' },
            zIndex: 1,
            locked: false,
            visible: true,
          },
          {
            id: 'parse',
            type: 'text',
            x: 340,
            y: 80,
            width: 200,
            height: 96,
            data: { content: 'Parse' },
            zIndex: 2,
            locked: false,
            visible: true,
          },
          {
            id: 'score',
            type: 'text',
            x: 340,
            y: 240,
            width: 200,
            height: 96,
            data: { content: 'Score' },
            zIndex: 3,
            locked: false,
            visible: true,
          },
          {
            id: 'output',
            type: 'text',
            x: 650,
            y: 150,
            width: 180,
            height: 96,
            data: { content: 'Output' },
            zIndex: 4,
            locked: false,
            visible: true,
          },
        ],
        selection: [],
        interaction: { mode: 'idle' },
        snapGuides: [],
        nextZIndex: 5,
      }),
      'replace',
    )

    const connections = api.engine.ext.connections
    for (const edge of connections.getEdges()) {
      connections.deleteEdge(edge.id)
    }
    connections.createEdge({
      from: 'input',
      to: 'parse',
      label: 'clean',
      data: {},
    })
    connections.createEdge({
      from: 'input',
      to: 'score',
      label: 'rank',
      data: {},
    })
    connections.createEdge({
      from: 'parse',
      to: 'output',
      label: 'emit',
      data: {},
    })
    connections.createEdge({
      from: 'score',
      to: 'output',
      label: 'merge',
      data: {},
    })
  })
}

test('renders stable screenshots for connection routing styles', async ({
  page,
}) => {
  await seedConnectionScene(page)

  const routingSelect = page
    .locator('section')
    .filter({ hasText: 'Connections' })
    .locator('select')
  const board = page.locator('.board-root').first()

  await routingSelect.selectOption('bezier')
  await expect(board).toHaveScreenshot('connections-bezier.png')

  await routingSelect.selectOption('smooth-step')
  await expect(board).toHaveScreenshot('connections-smooth-step.png')

  await routingSelect.selectOption('step')
  await expect(board).toHaveScreenshot('connections-step.png')
})

test('keeps connection labels readable at low zoom', async ({ page }) => {
  await seedConnectionScene(page)

  await page.evaluate(async () => {
    const api = (
      window as unknown as {
        __boardPlayground: {
          engine: {
            zoomTo: (level: number, animated?: boolean) => Promise<void>
          }
        }
      }
    ).__boardPlayground
    await api.engine.zoomTo(0.12, false)
  })

  const labels = page.locator('[data-connection-label]')
  await expect(labels).toHaveCount(4)
  await expect(labels.filter({ hasText: 'clean' })).toBeVisible()
  await expect(labels.filter({ hasText: 'rank' })).toBeVisible()
  await expect(labels.filter({ hasText: 'emit' })).toBeVisible()
  await expect(labels.filter({ hasText: 'merge' })).toBeVisible()
})

test('keeps connections attached through drag resize and zoom interactions', async ({
  page,
}) => {
  await seedConnectionScene(page)

  const board = page.locator('.board-root').first()
  await expect(board).toBeVisible()

  await page.locator('[data-connection-label]').first().hover()
  await expect(
    page.locator('[data-connection-handle="from"]').first(),
  ).toBeVisible()
  await expect(
    page.locator('[data-connection-handle="to"]').first(),
  ).toBeVisible()

  const targetHandle = page
    .locator('[data-connection-edge-id]')
    .filter({ has: page.locator('[data-connection-handle="to"]') })
    .first()
    .locator('[data-connection-handle="to"]')
    .first()
  const handleBox = await targetHandle.boundingBox()
  if (!handleBox) {
    throw new Error('Missing connection handle bounds')
  }

  const output = page.locator('[data-node-id="output"]')
  const outputBox = await output.boundingBox()
  if (!outputBox) {
    throw new Error('Missing output node bounds')
  }

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(outputBox.x + 6, outputBox.y + outputBox.height / 2, {
    steps: 12,
  })
  await page.mouse.up()

  const parse = page.locator('[data-node-id="parse"]')
  const parseBox = await parse.boundingBox()
  if (!parseBox) {
    throw new Error('Missing parse node bounds')
  }

  await page.mouse.move(
    parseBox.x + parseBox.width / 2,
    parseBox.y + parseBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    parseBox.x + parseBox.width / 2 + 100,
    parseBox.y + parseBox.height / 2 - 40,
    { steps: 12 },
  )
  await page.mouse.up()

  await output.click()
  const resizeHandle = page.locator(
    '[data-node-id="output"] [data-resize="se"]',
  )
  const resizeHandleBox = await resizeHandle.boundingBox()
  if (!resizeHandleBox) {
    throw new Error('Missing output resize handle bounds')
  }

  await page.mouse.move(
    resizeHandleBox.x + resizeHandleBox.width / 2,
    resizeHandleBox.y + resizeHandleBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizeHandleBox.x + resizeHandleBox.width / 2 + 50,
    resizeHandleBox.y + resizeHandleBox.height / 2 + 35,
    { steps: 10 },
  )
  await page.mouse.up()

  await board.evaluate((element) => {
    element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        clientX: 360,
        clientY: 220,
        deltaY: -100,
      }),
    )
  })

  await expect(board).toHaveScreenshot('connections-interaction-zoom.png')
})

test('creates a new connection from a card edge and previews the route cleanly', async ({
  page,
}) => {
  await seedConnectionScene(page)

  const board = page.locator('.board-root').first()
  const countEdges = async () =>
    page.evaluate(() => {
      const api = (
        window as unknown as {
          __boardPlayground: {
            engine: {
              ext: {
                connections: {
                  getEdges: () => Array<{ id: string }>
                }
              }
            }
          }
        }
      ).__boardPlayground
      return api.engine.ext.connections.getEdges().length
    })

  const before = await countEdges()
  const input = page.locator('[data-node-id="input"]')
  const inputBox = await input.boundingBox()
  if (!inputBox) {
    throw new Error('Missing input node bounds')
  }
  const start = {
    x: inputBox.x + inputBox.width - 2,
    y: inputBox.y + inputBox.height / 2,
  }

  await page.mouse.move(start.x, start.y)
  const createHandle = page
    .locator('[data-connection-create-handle="true"]')
    .first()
  await expect(createHandle).toBeVisible()
  const createHandleBox = await createHandle.boundingBox()
  if (!createHandleBox) {
    throw new Error('Missing source create handle bounds')
  }

  await page.mouse.move(
    createHandleBox.x + createHandleBox.width / 2,
    createHandleBox.y + createHandleBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(start.x + 150, start.y - 28, { steps: 10 })
  await expect(board).toHaveScreenshot('connections-create-edge-preview.png')

  const output = page.locator('[data-node-id="output"]')
  const outputBox = await output.boundingBox()
  if (!outputBox) {
    throw new Error('Missing output node bounds')
  }

  await page.mouse.move(outputBox.x + 6, outputBox.y + outputBox.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await expect.poll(countEdges).toBe(before + 1)
})
