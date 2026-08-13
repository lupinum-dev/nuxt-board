# Contributing

## Read this first

Nuxt Board currently accepts limited contributions. You can open an issue or a
pull request, but Lupinum OG can close or defer work that does not fit the
current direction.

We are most likely to accept small bug fixes, reliability fixes, focused
documentation corrections, and maintenance that reduces complexity.

Open an issue before you start a feature, a breaking change, or a large
refactor.

## Local setup

```bash
corepack enable
pnpm install
```

Use Node 20.19 or newer. Start the playground with `pnpm dev:playground` or the
documentation site with `pnpm dev:docs`.

## Expectations

- Keep changes small and intentional.
- Prefer deleting or simplifying code over adding compatibility layers.
- Update docs when public APIs change.
- Add or update tests for user-visible behavior changes.
- Keep domain rules in the headless packages rather than Vue, Nuxt, or other
  transport layers.
- Use Conventional Commits.

Start with the narrowest relevant test while working. Before handoff, run:

```bash
pnpm verify
```

Run `pnpm test:e2e` for browser interaction or screenshot changes. Maintainers
run `pnpm release:verify` against a release candidate; it is the final-SHA gate,
not a loop to repeat during normal development.

## Documentation

Public documentation lives in `docs/content/docs`, organized by reader
intent: evaluation, setup, system concepts, feature guides, solutions,
reference, and project policy. Write each page for one reader and one job. Keep
claims about defaults and public behavior aligned with source and contract
tests, and include imports and setup in copy-paste examples.

Documentation and demos must meet WCAG AA contrast, preserve complete keyboard
operation and visible focus, respect reduced motion, and provide textual
equivalents for interactive content.

## Changesets

Create a changeset for any publishable package change:

```bash
pnpm changeset
```

## Maintainer release workflow

Maintainers own compatibility decisions, Changeset review, and final release
verification.

1. Merge changes with the required changesets.
2. Let Changesets prepare the version pull request.
3. Run `pnpm release:verify` on the final release candidate SHA.
4. Merge the version pull request.
5. Start the protected publish workflow from that exact successful `main` CI run.
6. Inspect the certified artifact and approve the protected `npm` environment.
7. Verify npm provenance, the `latest` or `next` dist-tag, the protected tag,
   the GitHub release, the documentation deployment, and packed consumers.

Do not publish, tag, or push a release from a maintainer workstation. The
protected workflow publishes only the retained tarballs that CI certified.
