import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildPackageAgentDocs,
  verifyPackageAgentDocs,
} from './package-agent-docs.mjs'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(root, 'docs/.vercel/output/static/raw')
const references = {
  'board-core': 'board-core',
  'vue-board': 'vue-board',
  'board-history': 'history',
  'board-connections': 'connections',
  'nuxt-board': 'nuxt-board',
}
const selected = process.argv[2]
if (selected && !Object.hasOwn(references, selected))
  throw new Error(`Unknown package: ${selected}`)
for (const directory of await readdir(resolve(root, 'packages'), {
  withFileTypes: true,
})) {
  if (!directory.isDirectory() || (selected && directory.name !== selected))
    continue
  const packageRoot = resolve(root, 'packages', directory.name)
  const pkg = JSON.parse(
    await readFile(resolve(packageRoot, 'package.json'), 'utf8'),
  )
  if (pkg.private) continue
  if (!references[directory.name])
    throw new Error(`Select a starting reference for ${pkg.name}.`)
  await buildPackageAgentDocs({
    packageRoot,
    sourceRoot,
    startRoutes: [
      '/docs/start-building/installation',
      `/docs/reference/${references[directory.name]}`,
    ],
  })
  const manifest = await verifyPackageAgentDocs(packageRoot, { sourceRoot })
  console.log(
    `Packaged ${manifest.pages.length} pages for ${pkg.name}@${pkg.version}.`,
  )
}
