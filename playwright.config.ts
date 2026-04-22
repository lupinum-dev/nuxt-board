import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: [
    {
      command:
        'pnpm --filter @lupinum/board-playground dev --host 127.0.0.1 --port 4173',
      port: 4173,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        'pnpm docs:api && pnpm --filter docs dev --host 127.0.0.1 --port 4174',
      port: 4174,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
