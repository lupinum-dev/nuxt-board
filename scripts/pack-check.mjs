import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outputDir = join(rootDir, '.pack-check')
const tarballDir = join(outputDir, 'tarballs')
const unpackDir = join(outputDir, 'unpacked')
const consumerDir = join(outputDir, 'consumer')
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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function assertFile(path, message) {
  if (!existsSync(path)) {
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
      pnpm: {
        overrides: packedDependencies,
      },
    },
    null,
    2,
  ),
)
run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], {
  cwd: consumerDir,
})

const importLines = Array.from(packedPackages.keys())
  .map((name) => `await import(${JSON.stringify(name)})`)
  .join('\n')
writeFileSync(join(consumerDir, 'import-smoke.mjs'), `${importLines}\n`)
run('node', ['import-smoke.mjs'], { cwd: consumerDir })

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
const node = engine.createNode({ type: 'text', text: 'packed' })
engine.select(node.id)
getSelectionBounds(engine)
engine.exportDocument()
void BoardRoot
void BoardConnectionLayer
void BoardMinimap
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
  `import nuxtBoard from 'nuxt-board'

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

rmSync(outputDir, { recursive: true, force: true })
