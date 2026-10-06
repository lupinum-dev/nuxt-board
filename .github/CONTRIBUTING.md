# Contributing

Nuxt Board accepts limited contributions. Small bug fixes, reliability fixes,
focused documentation corrections and maintenance that reduces complexity are
the most likely to land. Lupinum OG can close or defer work that does not fit
the current direction.

- Open an issue before a feature, a breaking change or a large refactor, so we
  can agree on the approach first.
- Keep pull requests small and focused on one change.
- Set up with `corepack enable && pnpm install` (Node 24, as in CI). Start the
  playground with `pnpm dev` and the docs with `pnpm docs:dev`.
- Run `pnpm verify` before you ask for review. It runs the same checks as CI.
  Run `pnpm test:e2e` for interaction or screenshot changes.
- Keep domain rules in the headless packages, not in Vue or Nuxt.
- Update `docs/` in the same pull request as the behavior it describes. Docs and
  demos keep WCAG AA contrast, full keyboard operation, visible focus and
  reduced motion.
- Add a changeset with `pnpm changeset` when users will notice the change.
  The style rules are in [AGENTS.md](../AGENTS.md).
- Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md).
