# Vue Board

Vue Board is a node-based board toolkit for Vue 3 and Nuxt. The repo contains a headless engine, Vue primitives, Nuxt integration, optional plugins, a full sandbox playground, and a docs app with embedded live examples.

## Packages

- `@lupinum/board-core`: headless engine, types, math, and command model
- `@lupinum/vue-board`: Vue components and composables
- `@lupinum/nuxt-board`: Nuxt module with board auto-imports
- `@lupinum/board-history`: undo/redo plugin
- `@lupinum/board-selection`: selection helpers
- `@lupinum/board-connections`: edge and connection rendering
- `@lupinum/board-minimap`: minimap composable and component
- `@lupinum/board-serializer`: JSON Canvas import/export

## Development

```bash
pnpm install
pnpm dev:playground
pnpm dev:docs
```

Useful commands:

```bash
pnpm test:unit
pnpm test:e2e
pnpm test:docs
pnpm build
pnpm pack:check
```

## Release Flow

- Add a changeset for every publishable change.
- Merges to `main` run the release workflow.
- Changesets opens version PRs and publishes packages to npm when ready.
- Docs previews and production deploys are handled by `.github/workflows/docs.yml` when the Vercel secrets are configured.

## Repository Policy

- This repo does hard cutovers for public renames and refactors.
- Generated artifacts are not committed.
- Root CI, release config, and OSS policy files are the source of truth for the monorepo.
