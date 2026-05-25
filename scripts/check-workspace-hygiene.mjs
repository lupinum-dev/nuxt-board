import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))

const forbiddenPaths = [
  '.fallow',
  '.fallowrc.json',
  'packages/board-selection',
  'packages/docs',
  'packages/nuxt-board/packages',
  'packages/nuxt-board/playground/--host',
  'apps/docs/server/mcp',
]

const found = forbiddenPaths.filter((path) =>
  existsSync(resolve(rootDir, path)),
)

if (found.length > 0) {
  throw new Error(
    `Unexpected generated or zombie workspace paths found:\n${found
      .map((path) => `- ${path}`)
      .join('\n')}`,
  )
}
