# Nuxt Board

Nuxt Board provides a headless board engine, Vue rendering, Nuxt integration,
and optional history and connections. Five npm packages in `packages/` release
together with one version (a Changesets `fixed` group): `@lupinum/board-core`,
`@lupinum/vue-board`, `@lupinum/board-history`, `@lupinum/board-connections`
and `@lupinum/nuxt-board`, the main entry point for Nuxt.

Read [internals/architecture.md](internals/architecture.md) before you change
package behavior, and [docs/WRITING.md](docs/WRITING.md) before public prose.
Prefer `delete > simplify > replace > add`.

## Commands

```bash
pnpm install
pnpm dev            # build the packages, then run the Vue playground
pnpm docs:dev       # run the documentation site
pnpm test           # unit and Nuxt module tests
pnpm test:e2e       # Playwright interactions and screenshots (CI runs it on macOS)
pnpm test:packed    # install the packed tarballs into Vue and Nuxt 3.19/4.0 consumers; run pnpm build first
pnpm format         # apply Prettier
pnpm verify         # what CI runs: lint, typecheck, test, build, packed consumers, audit
pnpm changeset      # describe a user-facing change for the next release
```

`pnpm build` builds every package, the docs site and each package's `dist/agent/`,
a copy of the rendered docs that ships as `<package>/agent-docs` so agents in
consuming projects read documentation that matches the installed version.
The "Agent setup" section of each package README tells those agents how
to add a pointer to it. Keep the `./agent-docs` export and that section.

## Hard rules

- Never publish to npm, push to `main`, create tags or release by hand. Releases
  happen when a maintainer merges the "Version packages" PR and approves the
  protected `npm` environment.
- Never add `NPM_TOKEN` or any other long-lived publish credential.
- Add a changeset (`pnpm changeset`) to every pull request that changes what
  package users install: code, types, runtime behavior or dependencies.
  Documentation, tests and CI changes need none. CI requires one when
  `packages/*/src/` changes; use `pnpm changeset --empty` if users see nothing. A change to `dependencies` or
  `peerDependencies` of a published package needs a changeset that bumps that
  package (at least patch).
- Changeset style: one summary line in present tense that starts with Fix, Add,
  Remove or Change and says what changed for users. A short body may follow
  after a blank line. A major change adds a line that starts with `Migration:`
  and says what users must do.
- The packages are in prerelease mode (`beta`) until 1.0.0. Do not exit it or
  edit versions by hand.
- Keep the five packages in the one `fixed` group in `.changeset/config.json`.
  A new package joins it; its first npm version is published by the maintainer
  (see the Lupinum OSS handbook).
- Do not bypass the 24-hour dependency quarantine (`minimumReleaseAge`). Do not
  add dependencies to `allowBuilds` without a reason.
- Pin GitHub Actions to full commit SHAs. Give each job only the permissions it needs.
- Do not edit generated `.nuxt`, `.output`, `dist` or `.pack-check` files by hand.
- Keep tooling lean. Add a script, check or workflow only when it guards
  behavior users rely on or closes a real attack path. Process is not security.
- Record lasting choices in [internals/decisions.md](internals/decisions.md).

## Principles

- `board-core` owns documents, commands, transactions and types. Vue translates
  input and renders state; Nuxt registers the framework integration. History
  and connections extend the engine plugin contract; they own no second board
  state model.
- Commands own mutations, public snapshots stay immutable, and plugins preserve
  transaction rollback. Keep SSR independent from browser globals.
- Follow the persisted-format migration obligations in
  [internals/migrations.md](internals/migrations.md); beta status does not
  remove consumers.
- Keep each package's public API small. Everything exported is a promise to
  users. Every export and option has a doc comment with its meaning and
  default. Errors say how to fix them.
- Packages depend on each other with `workspace:*`, so the published packages
  pin the exact sibling version they were released with. Never use relative
  paths or fixed versions.
- Update `docs/` in the same pull request as the behavior it describes. The docs
  site is a real package consumer.
- Test public behavior, not internals. Keep public subpath imports exercised in
  the packed-consumer check.
