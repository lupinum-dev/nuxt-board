# Maintaining Nuxt Board

This file is for Lupinum OG maintainers. Contributors use
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Sources of truth

- The five public package manifests own the package versions.
- `.changeset/config.json` owns the fixed-version package group.
- Changeset files describe changes that require a release.
- `pnpm-lock.yaml` owns the resolved dependency graph.
- The retained tarballs are the release candidates.

Do not create a release branch, a second version file, or a local publication
path.

## Prepare a change

1. Create a small branch from current `main`.
2. Make one focused change.
3. Add or update tests.
4. Update public documentation when behavior changes.
5. Run `pnpm verify`.
6. Run `pnpm test:e2e` for interaction or visual changes.
7. Add a Changeset for each publishable change.
8. Open a pull request and wait for all required checks.

## Prepare a release

1. Merge changes with their Changesets.
2. Let the release workflow prepare the version pull request.
3. Review the versions and release notes as one fixed package set.
4. Run `pnpm release:verify` on the final release-candidate commit.
5. Merge the version pull request to protected `main`.
6. Publish only retained, verified tarballs from the exact `main` commit.
7. Approve the protected `npm` environment when GitHub requests approval.
8. Verify all five registry versions, package files, provenance statements,
   and dist-tags.
9. Create one protected Git tag and one GitHub release for the fixed package
   version.

Do not rebuild a package after verification. Do not publish from a maintainer
workstation after trusted publishing is configured.

## Review dependency changes

Renovate opens grouped dependency pull requests on Monday. It must not merge
them. Disable Dependabot version updates in the repository settings. Keep
Dependabot security alerts enabled.

For each update:

1. Review the upstream release and provenance.
2. Review new and changed lifecycle scripts.
3. Keep build-script permission limited to packages that require it.
4. Run `pnpm verify`.
5. Run packed-consumer and browser tests when Nuxt, Vue, rendering, or input
   dependencies change.
6. Give each temporary exception a reason and a removal date.

## Recover from a defective release

Do not unpublish a release unless npm policy and a confirmed security incident
require it.

1. Move the affected dist-tag to the last known-good version.
2. Deprecate the defective version with a concise impact statement.
3. Publish a forward fix with a new version.
4. Run the complete release verification again.
5. Record the affected versions and resolution in the release notes.

## Respond to a credential incident

1. Stop all release workflows.
2. Reject pending npm deployments.
3. Revoke affected sessions, tokens, and trusted-publisher bindings.
4. Review GitHub audit logs, workflow changes, releases, tags, and npm access
   history.
5. Deprecate untrusted versions and restore the last known-good dist-tags.
6. Restore trusted publishing only after source and artifacts are verified.
