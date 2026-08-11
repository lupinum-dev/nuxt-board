import { readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
if (!root) throw new Error('Expected a declaration output directory.')

function normalize(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      normalize(path)
    } else if (entry.name.endsWith('.vue.d.ts')) {
      renameSync(path, path.replace(/\.vue\.d\.ts$/, '.d.vue.ts'))
    }
  }
}

normalize(root)

const entryDeclaration = join(root, 'index.d.ts')
const declaration = readFileSync(entryDeclaration, 'utf8')
const normalizedDeclaration = declaration.replace(
  /^import ['"]\.\/styles\/(?:theme|motion)\.css['"]\s*;?\r?\n/gm,
  '',
)
if (normalizedDeclaration !== declaration) {
  writeFileSync(entryDeclaration, normalizedDeclaration)
}
