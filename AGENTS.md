# Working on Nuxt Board

Nuxt Board provides a headless board engine, Vue rendering, Nuxt integration,
and optional history and connections. Preserve one document model, command
engine, and interaction contract. A second renderer protocol, generic command
runner, and unrelated framework migration are outside this repository's scope.

Read [MAINTAINING.md](MAINTAINING.md) for setup, daily work, verification,
authority, and recovery. Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing
package behavior and [docs/WRITING.md](docs/WRITING.md) before public prose.
Define observable acceptance criteria and preserve unrelated work. Prefer
`delete > simplify > replace > add`.

## Ownership

- Package manifests own names, versions, dependencies, exports, and commands.
- `pnpm-lock.yaml` owns resolution; `pnpm-workspace.yaml` owns quarantine and
  reviewed build-script permissions.
- `board-core` owns documents, commands, transactions, and types. Vue translates
  input and renders state; Nuxt registers the framework integration.
- History and connections extend the existing engine plugin contract. They do
  not own another board state model.
- `.changeset/config.json` owns the fixed five-package release group. Changesets
  own release intent; Changelogen generates `CHANGELOG.md`.
- Public tests, packed consumers, and playgrounds prove behavior. `docs/` owns
  consumer guidance and is a real package consumer.
- Workflows own hosted gates and retained release artifacts.

## Invariants

Keep domain logic in the engine. Commands own mutations, public snapshots stay
immutable, and plugins preserve transaction rollback. Follow the existing
persisted-format migration obligations; beta status does not remove consumers.
Keep SSR independent from browser globals.

Run real packed consumers. Missing output, fixture setup errors, expired
quarantine exceptions, and unknown CI lane selection must fail. Keep public
subpath imports exercised and preserve the headless, Vue, and Nuxt compatibility
boundaries when simplifying checks.

Do not edit generated `.nuxt`, `.output`, `dist`, or `.pack-check` files by hand.
Do not add non-registry dependencies to package manifests. Local tarballs belong
only in disposable package certification fixtures. Generated install policy must
pass the same repository-owned checker as the root configuration.

Keep the five packages in one fixed Changesets group. Do not edit versions by
hand, fork release history, or add another publication path. Publication uses
retained certified artifacts and the protected human `npm` approval. Never
publish locally, handle publication credentials, weaken provenance checks, or
rebuild after approval. Preserve pinned Action commits and recovery boundaries.
