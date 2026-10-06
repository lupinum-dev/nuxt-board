# Decisions

A short, dated log of choices a future maintainer or agent might otherwise undo.
Add one line per decision: `Dn (YYYY-MM-DD): decision — why.` Replace a line
when a decision changes; git keeps the history.

- D1 (2026-10-06): Adopt the Lupinum OSS `library-monorepo` starter (lupinum-oss 9841872) and drop the repository's own release, publish, preview, provenance and dependency-policy tooling — every Lupinum repository shares one release, security and CI setup, so fixes to the standard apply everywhere.
- D2 (2026-10-06): CI runs three suites beyond the starter's matrix, and `ci` needs all of them: the `build` task also installs the packed tarballs into Vue and Nuxt 3.19/4.0 consumers (`pnpm test:packed`), `test (Node 20.19)` covers the lowest Node version the packages support, and `e2e (macOS)` runs Playwright with screenshot baselines that are rendered on macOS — each guards behavior users rely on that unit tests do not reach.
- D3 (2026-10-06): Stay on the `beta` prerelease line until 1.0.0 — the line started as `beta` before the standard chose `next`; switching would break the version sequence. The prerelease after 1.0.0 uses `next`.
- D4 (2026-10-06): The packages depend on each other with `workspace:*`, so each published package pins the exact sibling version — the five packages are one fixed group and are only tested together.
- D5 (2026-10-06): Keep the docs sections (evaluate, start building, understand the system, build features, solutions, reference, project) for now — the pages and their URLs are linked from READMEs and package agent docs; regrouping them into Start, Guides, Reference and Help (DOC-04, advice) is a separate change.
