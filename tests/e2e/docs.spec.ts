import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 120_000 })

async function openDocs(page: Page, path = '/') {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'commit' })
  await page.goto(`http://127.0.0.1:4174${path}`, { waitUntil: 'commit' })
  await expect(page.locator('body')).toBeVisible()
  return consoleErrors
}

test('renders the docs landing page and embedded board demo', async ({
  page,
}) => {
  await openDocs(page)

  await expect(
    page.getByRole('heading', { name: /build spatial tools with vue board/i }),
  ).toBeVisible()
  await expect(
    page.getByText(/the docs use the real workspace packages/i),
  ).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
})

test('navigates to examples and api reference pages', async ({ page }) => {
  const consoleErrors = await openDocs(page, '/examples/basic-board')

  await expect(page.getByRole('heading', { name: 'Basic Board' })).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
  const demo = page.getByTestId('basic-board-demo')
  await expect(demo).toHaveAttribute('data-node-count', '4')
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(demo).toHaveAttribute('data-node-count', '5')
  expect(consoleErrors).toEqual([])

  await openDocs(page, '/api/board-core')

  await expect(
    page.getByRole('heading', { name: '@lupinum/board-core' }),
  ).toBeVisible()
  await expect(
    page.locator('#createboardengine').getByRole('link', {
      name: 'createBoardEngine',
    }),
  ).toBeVisible()
})

test('links the docs introduction to the examples section', async ({
  page,
}) => {
  await openDocs(page, '/getting-started/introduction')

  const examplesLink = page
    .getByRole('main')
    .getByRole('link', { name: 'Examples', exact: true })
  await expect(examplesLink).toBeVisible()
  await expect(examplesLink).toHaveAttribute('href', '/examples/basic-board')
})
