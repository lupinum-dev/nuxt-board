import {
  existsSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
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
  'packages/board-minimap',
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

function packageNodeModulesPath(packageName) {
  return packageName.startsWith('@')
    ? join(consumerDir, 'node_modules', ...packageName.split('/'))
    : join(consumerDir, 'node_modules', packageName)
}

function linkNodeModulesEntries(sourceDir) {
  if (!existsSync(sourceDir)) {
    return
  }
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === '@lupinum') {
      continue
    }
    const target = join(consumerDir, 'node_modules', entry.name)
    if (existsSync(target)) {
      continue
    }
    symlinkSync(
      join(sourceDir, entry.name),
      target,
      entry.isDirectory() ? 'dir' : 'file',
    )
  }
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

mkdirSync(join(consumerDir, 'node_modules'), { recursive: true })
linkNodeModulesEntries(join(rootDir, 'node_modules'))
for (const packageDir of packageDirs) {
  linkNodeModulesEntries(join(rootDir, packageDir, 'node_modules'))
}
for (const [name, entry] of packedPackages) {
  const target = packageNodeModulesPath(name)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(entry.packageRoot, target, { recursive: true })
}

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
import { connectionPlugin } from '@lupinum/board-connections'
import { BoardMinimap } from '@lupinum/board-minimap'

const engine = createBoardEngine({ extensions: [historyPlugin(), connectionPlugin()] })
const node = engine.createNode({ type: 'text', text: 'packed' })
engine.select(node.id)
getSelectionBounds(engine)
engine.exportJSON()
void BoardRoot
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
