import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 120_000 })

const pageConsoleErrors = new WeakMap<Page, string[]>()

function collectConsoleErrors(page: Page): string[] {
  const existing = pageConsoleErrors.get(page)
  if (existing) return existing

  const errors: string[] = []
  pageConsoleErrors.set(page, errors)
  page.on('console', (message) => {
    const text = message.text()
    if (
      text.includes('wasm streaming compile failed') ||
      text.includes('falling back to ArrayBuffer instantiation')
    )
      return
    if (
      message.type() === 'error' ||
      text.includes('[Icon] failed to load icon')
    ) {
      errors.push(text)
    }
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function openDocs(page: Page, path = '/') {
  const errors = collectConsoleErrors(page)
  await page.goto(`http://127.0.0.1:4174${path}`, { waitUntil: 'commit' })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).toBeVisible()
  return errors
}

test('renders the documentation landing page and primary navigation', async ({
  page,
}) => {
  const errors = await openDocs(page)
  await expect(page).toHaveTitle(/Vue Board/i)
  await expect(page.getByRole('link', { name: /first board/i })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /understand the system/i }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('navigates through solutions and reference', async ({ page }) => {
  const errors = await openDocs(page, '/docs/solutions/planning-board')
  await expect(
    page.getByRole('heading', { name: 'Planning Board' }),
  ).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()

  await openDocs(page, '/docs/reference/board-core')
  await expect(
    page.getByRole('heading', { name: '@lupinum/board-core' }),
  ).toBeVisible()
  await expect(page.locator('#createboardengine')).toBeVisible()
  expect(errors).toEqual([])
})

test('exposes command state and publication order', async ({ page }) => {
  const errors = await openDocs(page, '/docs/evaluate/how-vue-board-works')
  await page.getByRole('button', { name: 'Rename card' }).click()
  await expect(page.getByText('command:after', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Review onboarding · approved, selected' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('shows atomic failure without changing the document', async ({ page }) => {
  const errors = await openDocs(
    page,
    '/docs/understand-the-system/commands-and-transactions',
  )
  await page.getByRole('button', { name: 'Run failing batch' }).click()
  await expect(page.getByText(/BoardConflictError/)).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Committed document, selected' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('switches renderers without changing the node record', async ({
  page,
}) => {
  const errors = await openDocs(
    page,
    '/docs/start-building/customize-your-first-node',
  )
  await page.getByRole('button', { name: 'Task card' }).click()
  await expect(
    page.getByLabel('Live inspector').getByText(/"type": "text"/),
  ).toBeVisible()
  await expect(
    page.getByRole('group', {
      name: /Approve documentation structure, selected/,
    }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('reports invalid persistence input without an uncaught error', async ({
  page,
}) => {
  const errors = await openDocs(
    page,
    '/docs/understand-the-system/persistence-and-json-canvas',
  )
  await page.getByRole('button', { name: 'Load invalid JSON' }).click()
  await page.getByRole('button', { name: 'Validate and import' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('.board-root').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('stacks lab inspectors below the stage on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = await openDocs(
    page,
    '/docs/understand-the-system/document-and-session-state',
  )
  const workspace = page.locator('.docs-lab__workspace')
  const columns = await workspace.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' '),
  )
  expect(columns).toHaveLength(1)
  await expect(page.getByLabel('Live inspector')).toBeVisible()
  expect(errors).toEqual([])
})
