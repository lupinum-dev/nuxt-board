import { expect, test } from '@playwright/test'

test('server-renders and hydrates the deterministic Nuxt board', async ({
  page,
  request,
}) => {
  const response = await request.get('http://127.0.0.1:4175/')
  const serverHtml = await response.text()
  expect(response.ok()).toBe(true)
  expect(serverHtml).toContain('Clarify scope')

  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle' })
  const nodes = page.locator('[data-node-id]')
  await expect(nodes).toHaveCount(12)
  await expect(page.getByText('Clarify scope', { exact: false })).toBeVisible()
  await page.waitForTimeout(100)

  expect(errors).toEqual([])
})

test('keeps Nuxt history shortcuts scoped to the hydrated board', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle' })

  const board = page.getByRole('application', { name: 'Board canvas' })
  const nodes = page.locator('[data-node-id]')
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

  await page.locator('[data-node-id="brief"]').click()
  await expect(page.locator('[data-node-id].is-selected')).toHaveCount(1)
  await board.press(`${modifier}+d`)
  await expect(nodes).toHaveCount(13)
  await board.press(`${modifier}+z`)
  await expect(nodes).toHaveCount(12)
  await board.press(`${modifier}+Shift+z`)
  await expect(nodes).toHaveCount(13)
})

test('presents an unobstructed board focus on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 })
  await page.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle' })

  const board = page.getByRole('application', { name: 'Board canvas' })
  await expect(board).toBeVisible()
  expect((await board.boundingBox())?.height).toBeGreaterThan(500)
  await expect(page.getByRole('button', { name: 'Minimap' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByRole('button', { name: 'Debug' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(
    page.getByRole('button', { name: 'Inspector', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.demo-diagnostics')).toHaveCount(0)
  await expect(page.locator('.sidebar')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)

  const moodboard = page.getByRole('img', { name: 'Moodboard' })
  await expect(moodboard).toBeVisible()
  await expect
    .poll(() =>
      moodboard.evaluate(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0,
      ),
    )
    .toBe(true)
})
