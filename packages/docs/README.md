# Vue Board Docs

This Nuxt app powers the Vue Board documentation site. It imports the workspace packages directly, embeds live board demos, and consumes generated API reference pages written from the source tree.

## Local development

```bash
pnpm docs:api
pnpm --filter docs dev
```

## Build

```bash
pnpm docs:api
pnpm --filter docs build
```
