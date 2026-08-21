# Active migrations

## Legacy board metadata key

- **Why:** Nuxt Board 0.1 wrote persisted metadata under `x-vue-board`.
- **Introduced:** 1.0.0-beta.0.
- **Dependency:** Documents saved by Nuxt Board 0.1 can still contain this key.
- **Removal condition:** Remove the import fallback in 2.0. The exporter already writes only `x-lupinum-board`.
- **Tracking issue:** None.
