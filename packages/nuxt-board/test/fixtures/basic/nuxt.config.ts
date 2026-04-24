import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  modules: [fileURLToPath(new URL('../../../src/module.ts', import.meta.url))],
  board: {},
})
