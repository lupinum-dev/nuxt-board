#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const changeset = spawnSync(
  'pnpm',
  ['changeset', 'status', '--since=origin/main'],
  {
    cwd: root,
    encoding: 'utf8',
  },
)

if (changeset.status === 0) process.exit(0)

const packageDirectories = [
  'packages/board-core',
  'packages/vue-board',
  'packages/board-history',
  'packages/board-connections',
  'packages/nuxt-board',
]
const packages = packageDirectories.map((directory) =>
  JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8')),
)
const versions = new Set(packages.map(({ version }) => version))
const tags = execFileSync('git', ['tag', '--list'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8')

if (
  tags === '' &&
  versions.size === 1 &&
  versions.has('0.1.0') &&
  changelog.includes('## v0.1.0')
) {
  process.stdout.write(
    'Accepted the documented one-time 0.1.0 release without a pending Changeset.\n',
  )
  process.exit(0)
}

process.stderr.write(changeset.stdout)
process.stderr.write(changeset.stderr)
process.exit(changeset.status ?? 1)
