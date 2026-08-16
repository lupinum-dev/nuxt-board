import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { basename, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outputDir = join(rootDir, '.pack-check')
const tarballDir = join(outputDir, 'tarballs')
const unpackDir = join(outputDir, 'unpacked')
const consumerDir = join(outputDir, 'consumer')
const headlessConsumerDir = join(outputDir, 'headless-consumer')
const releaseArtifactsDir = join(rootDir, 'release-artifacts')
const retainArtifacts = process.argv.includes('--retain')
const packageDirs = [
  'packages/board-core',
  'packages/vue-board',
  'packages/board-history',
  'packages/board-connections',
  'packages/nuxt-board',
]

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    ...options,
  })
}

function writeConsumerWorkspace(directory, overrides) {
  const overrideLines = Object.entries(overrides).map(
    ([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`,
  )
  writeFileSync(
    join(directory, 'pnpm-workspace.yaml'),
    [
      'allowBuilds:',
      '  esbuild: true',
      'overrides:',
      ...overrideLines,
      '',
    ].join('\n'),
  )
}

async function getAvailablePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not reserve a local port.'))
        return
      }
      server.close((error) => {
        if (error) reject(error)
        else resolvePort(address.port)
      })
    })
  })
}

async function assertNuxtSsr(consumerRoot, expectedText) {
  const port = await getAvailablePort()
  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: consumerRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: 'pipe',
  })
  let output = ''
  const collect = (chunk) => {
    output = `${output}${chunk}`.slice(-8000)
  }
  server.stdout.on('data', collect)
  server.stderr.on('data', collect)

  try {
    let lastError
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`)
        const html = await response.text()
        if (!response.ok) {
          throw new Error(`SSR returned HTTP ${response.status}.`)
        }
        if (!html.includes(expectedText)) {
          throw new Error(`SSR output did not contain ${expectedText}.`)
        }
        return
      } catch (error) {
        lastError = error
        if (server.exitCode !== null) break
        await delay(100)
      }
    }
    throw new Error(`Packed Nuxt SSR smoke failed.\n${output}`, {
      cause: lastError,
    })
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM')
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function assertFile(path, message) {
  if (!existsSync(path)) {
    throw new Error(message)
  }
}

function assertNonEmptyFile(path, message) {
  assertFile(path, message)
  if (readFileSync(path).length === 0) {
    throw new Error(message)
  }
}

function collectExportTargets(exportsField) {
  const targets = []
  const visit = (value) => {
    if (typeof value === 'string') {
      targets.push(value)
      return
    }
    if (value && typeof value === 'object') {
      for (const entry of Object.values(value)) {
        visit(entry)
      }
    }
  }
  visit(exportsField)
  return targets
}

function assertNoLocalPaths(packageRoot) {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
      } else {
        files.push(path)
      }
    }
  }
  walk(packageRoot)

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    if (content.includes('/Users/') || content.includes('file:///Users/')) {
      throw new Error(`Packed file contains an absolute local path: ${file}`)
    }
  }
}

function assertNoWorkspaceProtocols(manifest) {
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const dependencies = manifest[field] ?? {}
    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        throw new Error(
          `${manifest.name} packed package.json contains a workspace: dependency: ${field}.${name}`,
        )
      }
    }
  }
}

function unpackTarball(tarball) {
  const targetDir = join(unpackDir, tarball.replace(/\.tgz$/, ''))
  mkdirSync(targetDir, { recursive: true })
  run('tar', ['-xzf', join(tarballDir, tarball), '-C', targetDir])
  return join(targetDir, 'package')
}

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(tarballDir, { recursive: true })
mkdirSync(unpackDir, { recursive: true })

run('pnpm', ['build:packages'])

for (const packageDir of packageDirs) {
  run('pnpm', ['pack', '--pack-destination', tarballDir], {
    cwd: join(rootDir, packageDir),
  })
}

const tarballs = readdirSync(tarballDir).filter((entry) =>
  entry.endsWith('.tgz'),
)
if (tarballs.length !== packageDirs.length) {
  throw new Error(
    `Expected ${packageDirs.length} tarballs, found ${tarballs.length}.`,
  )
}

const packedPackages = new Map()
for (const tarball of tarballs) {
  const packageRoot = unpackTarball(tarball)
  const manifest = readJson(join(packageRoot, 'package.json'))
  assertNoWorkspaceProtocols(manifest)
  if (
    manifest.author !== 'Lupinum OG <info@lupinum.com> (https://lupinum.com)'
  ) {
    throw new Error(
      `${manifest.name} does not identify Lupinum OG as the package author.`,
    )
  }
  if (manifest.homepage !== 'https://nuxt-board.lupinum.com') {
    throw new Error(
      `${manifest.name} does not link to the canonical documentation site.`,
    )
  }
  packedPackages.set(manifest.name, {
    manifest,
    packageRoot,
    tarball: join(tarballDir, tarball),
  })

  for (const field of ['main', 'module', 'types']) {
    if (manifest[field]) {
      assertFile(
        join(packageRoot, manifest[field]),
        `${manifest.name} declares missing ${field}: ${manifest[field]}`,
      )
    }
  }
  for (const target of collectExportTargets(manifest.exports ?? {})) {
    if (target.startsWith('./')) {
      assertFile(
        join(packageRoot, target),
        `${manifest.name} exports missing target: ${target}`,
      )
    }
  }
  assertFile(
    join(packageRoot, 'LICENSE'),
    `${manifest.name} package is missing LICENSE.`,
  )
  assertNoLocalPaths(packageRoot)
}

const packageVersions = new Set(
  Array.from(packedPackages.values(), ({ manifest }) => manifest.version),
)
if (packageVersions.size !== 1) {
  throw new Error('All public packages must use one fixed release version.')
}
const [fixedReleaseVersion] = packageVersions

const packedVueBoard = packedPackages.get('@lupinum/vue-board')
if (!packedVueBoard) throw new Error('Packed Vue Board package is missing.')
if (packedVueBoard.manifest.dependencies?.['@lupinum/board-core']) {
  throw new Error('Vue Board must not install a second board-core dependency.')
}
if (!packedVueBoard.manifest.peerDependencies?.['@lupinum/board-core']) {
  throw new Error('Vue Board must declare board-core as a peer dependency.')
}
assertNonEmptyFile(
  join(packedVueBoard.packageRoot, 'dist/index.css'),
  'Vue Board package is missing its non-empty stylesheet.',
)

const expectedFirstPartyPeers = [
  ['@lupinum/vue-board', '@lupinum/board-core'],
  ['@lupinum/board-history', '@lupinum/board-core'],
  ['@lupinum/board-connections', '@lupinum/board-core'],
  ['@lupinum/board-connections', '@lupinum/vue-board'],
  ['@lupinum/nuxt-board', '@lupinum/board-core'],
  ['@lupinum/nuxt-board', '@lupinum/vue-board'],
]
for (const [packageName, peerName] of expectedFirstPartyPeers) {
  const range =
    packedPackages.get(packageName)?.manifest.peerDependencies?.[peerName]
  if (range !== fixedReleaseVersion) {
    throw new Error(
      `${packageName} must publish ${peerName} at the same first-party release version; received ${String(range)}.`,
    )
  }
}

const packedCore = packedPackages.get('@lupinum/board-core')
const packedConnections = packedPackages.get('@lupinum/board-connections')
if (!packedCore || !packedConnections) {
  throw new Error('Packed headless packages are missing.')
}
mkdirSync(headlessConsumerDir, { recursive: true })
writeFileSync(
  join(headlessConsumerDir, 'package.json'),
  JSON.stringify(
    {
      private: true,
      type: 'module',
      dependencies: {
        '@lupinum/board-core': `file:${packedCore.tarball}`,
        '@lupinum/board-connections': `file:${packedConnections.tarball}`,
      },
    },
    null,
    2,
  ),
)
run(
  'pnpm',
  [
    'install',
    '--ignore-workspace',
    '--no-frozen-lockfile',
    '--config.auto-install-peers=false',
  ],
  { cwd: headlessConsumerDir },
)
writeFileSync(
  join(headlessConsumerDir, 'import-smoke.mjs'),
  `await import('@lupinum/board-connections')\n`,
)
run('node', ['import-smoke.mjs'], { cwd: headlessConsumerDir })

mkdirSync(consumerDir, { recursive: true })
const rootManifest = readJson(join(rootDir, 'package.json'))
const nuxtManifest = readJson(join(rootDir, 'packages/nuxt-board/package.json'))
const packedDependencies = Object.fromEntries(
  Array.from(packedPackages, ([name, entry]) => [
    name,
    `file:${entry.tarball}`,
  ]),
)
writeFileSync(
  join(consumerDir, 'package.json'),
  JSON.stringify(
    {
      private: true,
      type: 'module',
      dependencies: packedDependencies,
      devDependencies: {
        '@types/node': rootManifest.devDependencies['@types/node'],
        nuxt: nuxtManifest.devDependencies.nuxt,
        typescript: rootManifest.devDependencies.typescript,
        vue: rootManifest.devDependencies.vue,
      },
    },
    null,
    2,
  ),
)
writeConsumerWorkspace(consumerDir, packedDependencies)
run('pnpm', ['install', '--no-frozen-lockfile'], {
  cwd: consumerDir,
})

const importLines = Array.from(packedPackages.keys())
  .map((name) => `await import(${JSON.stringify(name)})`)
  .concat([
    `await import('@lupinum/board-connections/vue')`,
    `await import('@lupinum/vue-board/minimap')`,
  ])
  .join('\n')
writeFileSync(join(consumerDir, 'import-smoke.mjs'), `${importLines}\n`)
run('node', ['import-smoke.mjs'], { cwd: consumerDir })

writeFileSync(
  join(consumerDir, 'runtime-contract.mjs'),
  `import { BoardConflictError, createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'

try {
  createBoardEngine({ plugins: [historyPlugin(), historyPlugin()] })
  throw new Error('duplicate plugin names were accepted')
} catch (error) {
  if (!(error instanceof BoardConflictError)) throw error
}
`,
)
run('node', ['runtime-contract.mjs'], { cwd: consumerDir })

writeFileSync(
  join(consumerDir, 'consumer-board.ts'),
  `import { createBoardEngine } from '@lupinum/board-core'
import { BoardRoot } from '@lupinum/vue-board'
import { historyPlugin } from '@lupinum/board-history'
import { getSelectionBounds } from '@lupinum/board-core'
import { connectionsPlugin } from '@lupinum/board-connections'
import { BoardConnectionLayer } from '@lupinum/board-connections/vue'
import { BoardMinimap } from '@lupinum/vue-board/minimap'

const engine = createBoardEngine({ plugins: [historyPlugin(), connectionsPlugin()] })
engine.plugins.history.canUndo()
engine.plugins.connections.getEdges()
engine.on('history:push', entry => entry.label)
engine.on('edge:created', edge => edge.id)
const node = engine.createNode({ type: 'text', text: 'packed' })
engine.select(node.id)
getSelectionBounds(engine)
engine.exportDocument()
void BoardRoot
void BoardConnectionLayer
void BoardMinimap

const bare = createBoardEngine()
// @ts-expect-error History is absent without its plugin.
bare.plugins.history.canUndo()
// @ts-expect-error Connections are absent without their plugin.
bare.plugins.connections.getEdges()
// @ts-expect-error Pointer sessions are absent from the supported engine API.
bare.beginNodeDrag('node', 1, { x: 0, y: 0 })

declare const enabled: boolean
const conditionalPlugins = enabled ? [historyPlugin()] as const : [] as const
const conditional = createBoardEngine({ plugins: conditionalPlugins })
// @ts-expect-error Conditional plugins are not guaranteed capabilities.
conditional.plugins.history.canUndo()
`,
)
writeFileSync(
  join(consumerDir, 'tsconfig-board.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: false,
        noUncheckedSideEffectImports: true,
      },
      include: ['consumer-board.ts'],
    },
    null,
    2,
  ),
)
run('pnpm', ['exec', 'tsc', '-p', join(consumerDir, 'tsconfig-board.json')])

writeFileSync(
  join(consumerDir, 'consumer-nuxt.ts'),
  `import nuxtBoard from '@lupinum/nuxt-board'

void nuxtBoard
`,
)
writeFileSync(
  join(consumerDir, 'tsconfig-nuxt.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: true,
      },
      include: ['consumer-nuxt.ts'],
    },
    null,
    2,
  ),
)
run('pnpm', ['exec', 'tsc', '-p', join(consumerDir, 'tsconfig-nuxt.json')])

const packedNuxtBoard = packedPackages.get('@lupinum/nuxt-board')
if (!packedNuxtBoard) throw new Error('Packed Nuxt Board package is missing.')

async function verifyNuxtVersion(label, nuxtVersion) {
  const nuxtConsumerDir = join(outputDir, `nuxt-${label}`)
  const localPackages = {
    '@lupinum/board-core': `file:${packedCore.tarball}`,
    '@lupinum/vue-board': `file:${packedVueBoard.tarball}`,
    '@lupinum/nuxt-board': `file:${packedNuxtBoard.tarball}`,
  }
  mkdirSync(nuxtConsumerDir, { recursive: true })
  writeFileSync(
    join(nuxtConsumerDir, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          ...localPackages,
          nuxt: nuxtVersion,
        },
        devDependencies: {
          typescript: rootManifest.devDependencies.typescript,
          'vue-tsc': rootManifest.devDependencies['vue-tsc'],
        },
      },
      null,
      2,
    ),
  )
  writeConsumerWorkspace(nuxtConsumerDir, localPackages)
  writeFileSync(
    join(nuxtConsumerDir, 'nuxt.config.ts'),
    `export default defineNuxtConfig({ modules: ['@lupinum/nuxt-board'] })\n`,
  )
  writeFileSync(
    join(nuxtConsumerDir, 'tsconfig.json'),
    `${JSON.stringify({ extends: './.nuxt/tsconfig.json' }, null, 2)}\n`,
  )
  writeFileSync(
    join(nuxtConsumerDir, 'app.vue'),
    `<script setup lang="ts">
import { asNodeId } from '@lupinum/board-core'
const engine = createBoardEngine({
  initialNodes: [{
    id: asNodeId('packed-${label}'),
    type: 'text', x: 24, y: 24, width: 160, height: 80,
    text: 'packed-nuxt-${label}', zIndex: 1, locked: false, visible: true,
  }],
})
</script>
<template><BoardRoot :engine="engine" style="height: 320px" /></template>
`,
  )
  run('pnpm', ['install', '--no-frozen-lockfile'], {
    cwd: nuxtConsumerDir,
  })
  run('pnpm', ['exec', 'nuxt', 'prepare'], { cwd: nuxtConsumerDir })
  run('pnpm', ['exec', 'nuxi', 'typecheck'], { cwd: nuxtConsumerDir })
  run('pnpm', ['exec', 'nuxt', 'build'], { cwd: nuxtConsumerDir })
  await assertNuxtSsr(nuxtConsumerDir, `packed-nuxt-${label}`)
}

await verifyNuxtVersion('3-19', '3.19.0')
await verifyNuxtVersion('4-0', '4.0.0')

if (retainArtifacts) {
  rmSync(releaseArtifactsDir, { recursive: true, force: true })
  mkdirSync(releaseArtifactsDir, { recursive: true })

  const artifacts = Array.from(
    packedPackages,
    ([name, { manifest, tarball }]) => {
      const filename = basename(tarball)
      const destination = join(releaseArtifactsDir, filename)
      copyFileSync(tarball, destination)
      const sha256 = createHash('sha256')
        .update(readFileSync(destination))
        .digest('hex')
      const sha1 = createHash('sha1')
        .update(readFileSync(destination))
        .digest('hex')
      return { name, version: manifest.version, filename, sha1, sha256 }
    },
  ).sort((left, right) => left.name.localeCompare(right.name))

  const changelogSource = join(rootDir, 'CHANGELOG.md')
  let changelog
  if (existsSync(changelogSource)) {
    const filename = 'CHANGELOG.md'
    const destination = join(releaseArtifactsDir, filename)
    copyFileSync(changelogSource, destination)
    changelog = {
      filename,
      sha256: createHash('sha256')
        .update(readFileSync(destination))
        .digest('hex'),
    }
  }

  const checksummedFiles = changelog ? [...artifacts, changelog] : artifacts

  writeFileSync(
    join(releaseArtifactsDir, 'SHA256SUMS'),
    `${checksummedFiles.map(({ filename, sha256 }) => `${sha256}  ${filename}`).join('\n')}\n`,
  )
  writeFileSync(
    join(releaseArtifactsDir, 'release-artifact.json'),
    `${JSON.stringify(
      {
        commit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: rootDir,
          encoding: 'utf8',
        }).trim(),
        version: fixedReleaseVersion,
        channel: fixedReleaseVersion.includes('-') ? 'next' : 'latest',
        ...(changelog ? { changelog } : {}),
        packages: artifacts,
      },
      null,
      2,
    )}\n`,
  )
}

rmSync(outputDir, { recursive: true, force: true })
