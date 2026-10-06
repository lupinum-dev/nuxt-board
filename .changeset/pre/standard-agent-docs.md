---
'@lupinum/board-core': patch
'@lupinum/vue-board': patch
'@lupinum/board-history': patch
'@lupinum/board-connections': patch
'@lupinum/nuxt-board': patch
---

Change the packaged agent docs to every documentation page, indexed in `dist/agent/AGENTS.md`, and add an "Agent setup" section to each README.

The `./agent-docs` export still resolves to `dist/agent/AGENTS.md`. Each package now also ships its `CHANGELOG.md`.
