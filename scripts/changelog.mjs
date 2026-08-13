#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageManifests = [
  'packages/board-core/package.json',
  'packages/vue-board/package.json',
  'packages/board-history/package.json',
  'packages/board-connections/package.json',
  'packages/nuxt-board/package.json',
]
const versions = new Set(
  packageManifests.map(
    (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8')).version,
  ),
)
if (versions.size !== 1) {
  throw new Error(
    'All public packages must have one version before changelog generation.',
  )
}
const [version] = versions
const result = spawnSync(
  'pnpm',
  ['exec', 'changelogen', '--no-output', '--hideAuthorEmail'],
  { cwd: root, encoding: 'utf8' },
)
if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const generated = result.stdout
  .replace(/^\s*##\s+[^\n]+/u, `## v${version}`)
  .trim()
if (!generated.startsWith(`## v${version}\n`)) {
  throw new Error('Changelogen did not produce a release section.')
}

const changelogPath = resolve(root, 'CHANGELOG.md')
const current = existsSync(changelogPath)
  ? readFileSync(changelogPath, 'utf8')
  : '# Changelog\n'
const marker = `## v${version}`
const normalizedCurrent = current.replaceAll('\r\n', '\n').trimEnd()
const markerAt = normalizedCurrent.startsWith(marker)
  ? 0
  : normalizedCurrent.indexOf(`\n${marker}`) + 1

let next
if (markerAt > 0 || normalizedCurrent.startsWith(marker)) {
  const nextSectionAt = normalizedCurrent.indexOf(
    '\n## ',
    markerAt + marker.length,
  )
  const before = normalizedCurrent.slice(0, markerAt).trimEnd()
  const after =
    nextSectionAt === -1
      ? ''
      : normalizedCurrent.slice(nextSectionAt + 1).trim()
  next = [before, generated, after].filter(Boolean).join('\n\n') + '\n'
} else {
  next = `${normalizedCurrent}\n\n${generated}\n`
}

writeFileSync(changelogPath, next)
