#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(import.meta.dirname, '..')

export function isConsumedPrereleaseVersion({
  tag,
  versions,
  baseVersions,
  consumedChangesets,
  changesetIds,
  changedPaths,
  packagePaths,
  changelog,
}) {
  if (!tag || versions.length === 0) return false

  const version = versions[0]
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const prereleasePattern = new RegExp(
    `^\\d+\\.\\d+\\.\\d+-${escapedTag}\\.\\d+$`,
  )
  const allowedPaths = new Set([
    '.changeset/pre.json',
    'CHANGELOG.md',
    'pnpm-lock.yaml',
    ...packagePaths,
  ])

  return (
    prereleasePattern.test(version) &&
    versions.every((candidate) => candidate === version) &&
    baseVersions.every(
      (candidate, index) => candidate && candidate !== versions[index],
    ) &&
    consumedChangesets.length > 0 &&
    changesetIds.length === consumedChangesets.length &&
    changesetIds.every((id) => consumedChangesets.includes(id)) &&
    changedPaths.every((path) => allowedPaths.has(path)) &&
    packagePaths.every((path) => changedPaths.includes(path)) &&
    changedPaths.includes('.changeset/pre.json') &&
    changedPaths.includes('CHANGELOG.md') &&
    changelog.includes(`## v${version}`)
  )
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'))
}

function git(args) {
  return spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  })
}

function acceptsGeneratedPrerelease() {
  const config = readJson('.changeset/config.json')
  const pre = readJson('.changeset/pre.json')
  const fixedPackages = new Set(config.fixed.flat())
  const packagePaths = readdirSync(resolve(root, 'packages'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/package.json`)
    .filter((path) => fixedPackages.has(readJson(path).name))
    .sort()

  if (packagePaths.length !== fixedPackages.size) return false

  const versions = packagePaths.map((path) => readJson(path).version)
  const baseVersions = packagePaths.map((path) => {
    const result = git(['show', `origin/main:${path}`])
    return result.status === 0 ? JSON.parse(result.stdout).version : null
  })
  const changesetIds = readdirSync(resolve(root, '.changeset'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => basename(name, '.md'))
    .sort()
  const diff = git(['diff', '--name-only', 'origin/main...HEAD'])

  if (diff.status !== 0) return false

  return isConsumedPrereleaseVersion({
    tag: pre.tag,
    versions,
    baseVersions,
    consumedChangesets: pre.changesets,
    changesetIds,
    changedPaths: diff.stdout.trim().split('\n').filter(Boolean),
    packagePaths,
    changelog: readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8'),
  })
}

function main() {
  const changeset = spawnSync(
    'pnpm',
    ['changeset', 'status', '--since=origin/main'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )

  if (changeset.status === 0) return

  if (acceptsGeneratedPrerelease()) {
    process.stdout.write('Consumed prerelease version notes verified.\n')
    return
  }

  process.stderr.write(changeset.stdout)
  process.stderr.write(changeset.stderr)
  process.exitCode = changeset.status ?? 1
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
