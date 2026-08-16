#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
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

process.stderr.write(changeset.stdout)
process.stderr.write(changeset.stderr)
process.exit(changeset.status ?? 1)
