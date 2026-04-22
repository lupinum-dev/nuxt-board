// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
import eslintConfigPrettier from 'eslint-config-prettier'

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Formatting is handled by Prettier.
    stylistic: true,
  },
  dirs: {
    src: ['./playground'],
  },
}).append(eslintConfigPrettier)
