#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extractGeneratedRelease,
  mergeReleaseSection,
} from './changelog-utils.mjs'

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

const generated = extractGeneratedRelease(result.stdout, version)

const changelogPath = resolve(root, 'CHANGELOG.md')
const current = existsSync(changelogPath)
  ? readFileSync(changelogPath, 'utf8')
  : '# Changelog\n'
writeFileSync(changelogPath, mergeReleaseSection(current, generated, version))
