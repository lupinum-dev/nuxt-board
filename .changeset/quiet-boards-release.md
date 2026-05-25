---
'@lupinum/board-core': minor
'@lupinum/vue-board': minor
'@lupinum/board-history': minor
'@lupinum/board-connections': minor
'@lupinum/board-minimap': patch
'nuxt-board': patch
---

Tighten the first-release public API and package artifacts: restrict node types to JSON Canvas node kinds, remove the legacy `x-nuxt-board` metadata namespace, keep history events metadata-only, remove internal Vue root-building composables from the public entrypoint, and ship stricter NodeNext declaration/package smoke coverage with license files in published tarballs.
