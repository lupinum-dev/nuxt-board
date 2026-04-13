# Contributing

## Local setup

```bash
pnpm install
pnpm docs:api
pnpm test:unit
```

## Expectations

- Keep changes small and intentional.
- Prefer deleting or simplifying code over adding compatibility layers.
- Update docs and generated API reference when public APIs change.
- Add or update tests for user-visible behavior changes.

## Changesets

Create a changeset for any publishable package change:

```bash
pnpm changeset
```
