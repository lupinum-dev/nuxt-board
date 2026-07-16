import { readdirSync, renameSync } from 'node:fs'
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
