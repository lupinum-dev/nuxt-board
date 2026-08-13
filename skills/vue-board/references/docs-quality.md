# Docs Quality Reference

Use this reference when writing docs, examples, API pages, or agent-facing guidance for Vue Board.

## Reader Paths

Route readers by job:

- Evaluating fit: introduction and examples.
- First board: installation, quick start, nodes.
- Custom cards/editors: renderers before state shape changes.
- Edges: connections guide and API.
- Undo/redo: history guide and API.
- Save/load: serialization before custom persistence.
- Nuxt: installation, Nuxt API, SSR deterministic recipe.

## Page Rules

- Start with what the page helps the reader do or decide.
- Include imports and setup in examples that readers will copy.
- Give `BoardRoot` a height in full snippets.
- Say which package owns a feature. Core owns JSON Canvas nodes/import/export; connections owns edges; history owns undo/redo; minimap owns overview UI; Nuxt module owns auto-imports/styles/transpilation.
- Prefer one direct path. Avoid dual paths, compatibility shims, feature flags, and imagined future flexibility.
- Link to the next task instead of repeating every reference page.

## Skill File Rules

- Keep `SKILL.md` to workflow, routing, and invariants. Put detailed API facts in one-level `references/` files.
- Do not add README, changelog, installation guide, or process notes inside a skill folder.
- Reference files over 100 lines need a short contents list near the top.
- Validate with the skill-creator validator when available, then run Prettier on the skill folder.

## High-Risk Claims to Verify

Check source before changing claims about:

- node fields and supported node types
- default grid/zoom/node constraints
- color presets and hex validation
- selection behavior, especially locked vs visible nodes
- group capture and z-order
- LOD thresholds and culling margins
- `BoardConnectionLayer` placement and routing styles
- explicit history boundaries
- JSON Canvas persistence and feature ownership
- Nuxt auto-import aliases and prefix behavior

## Stale-Claim Greps

Use these when doing docs review:

```bash
rg -n "data\\.content|custom node types|node:task|type: 'task'|type: \"task\"|h-screen|20px grid|four routing|viewport slot|snap-guide-(width|glow)|serializable snapshot|documented persistence extension" README.md docs/content packages/*/README.md
```

Check formatting and docs build:

```bash
pnpm format:check
pnpm test:docs
git diff --check
```

Run E2E when docs/examples change rendered behavior or interactive demos:

```bash
pnpm test:e2e
```
