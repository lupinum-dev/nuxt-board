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
