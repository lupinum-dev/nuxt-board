import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const rootDir = resolve(new URL('..', import.meta.url).pathname)
const outputDir = join(rootDir, '.pack-check')
const packageDirs = [
  'packages/board-core',
  'packages/vue-board',
  'packages/board-history',
  'packages/board-selection',
  'packages/board-connections',
  'packages/board-minimap',
  'packages/board-serializer',
  'packages/nuxt-board',
]

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })

for (const packageDir of packageDirs) {
  execFileSync('pnpm', ['pack', '--pack-destination', outputDir], {
    cwd: join(rootDir, packageDir),
    stdio: 'inherit',
    env: process.env,
  })
}

const tarballs = readdirSync(outputDir).filter((entry) =>
  entry.endsWith('.tgz'),
)
if (tarballs.length !== packageDirs.length) {
  throw new Error(
    `Expected ${packageDirs.length} tarballs, found ${tarballs.length}.`,
  )
}

rmSync(outputDir, { recursive: true, force: true })
