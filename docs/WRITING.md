# Nuxt Board writing guide

Nuxt Board uses Lupinum Controlled English. This profile is based on
ASD-STE100 Issue 9. It does not claim formal ASD-STE100 compliance.

The website is consumer documentation for the Nuxt Board package family.
Package source and public tests define behavior. The pages under
`apps/docs/content/docs` explain that behavior without exposing repository
internals.

## Organize by reader intent

The documentation follows the user's work:

1. **Evaluate** explains the product and its design choices.
2. **Start building** provides the shortest working path.
3. **Understand the system** explains the document, command, and rendering
   contracts.
4. **Build features** provides focused task guides.
5. **Solutions** combines public features into common products.
6. **Reference** records exact packages, types, APIs, events, and errors.
7. **Project** contains contribution, support, and security guidance.

Keep each page in the first area that answers the reader's question. Do not
copy the same explanation into multiple areas.

## Write for Vue and Nuxt developers

- Lead with the result, decision, or constraint.
- Use active voice.
- Put one instruction in each sentence.
- Use one term for one concept.
- Define a technical term before you use it.
- Prefer a short working example to a long introduction.
- Use sentence case for titles and headings.
- Keep paragraphs compact.
- Remove meta text such as "this page will".
- Use American English spelling.

Frontmatter supplies the page title. Do not add a body `#` heading.

Do not rewrite license text, code, API identifiers, command output,
quotations, changelog entries, or generated reports to match this profile.

## Keep the package boundaries accurate

Use the public package that owns the behavior:

- `@lupinum/board-core` owns documents, commands, transactions, and types.
- `@lupinum/vue-board` owns Vue rendering and interaction adapters.
- `@lupinum/board-connections` owns connection behavior and rendering.
- `@lupinum/board-history` owns undo and redo behavior.
- `@lupinum/nuxt-board` owns Nuxt registration and integration.

Do not document an internal import as a public API. Do not describe Vue or
Nuxt adapters as owners of board state.

## Build examples that can be copied

Label code blocks with a real application path. Use Nuxt 4 `app/` paths in
Nuxt examples. Keep each example focused on one public behavior.

Every board example must use the canonical document and command contracts.
Do not invent options, events, package exports, or migration paths. State when
an example requires an optional package.

## Keep source truth visible

Before you publish a behavior claim, check the owning package source,
manifest, export tests, and type tests. Keep these facts aligned:

- package names and peer versions;
- public root and subpath exports;
- document, node, edge, command, and transaction contracts;
- component props, slots, events, and composables;
- connection, history, minimap, persistence, and SSR behavior;
- Nuxt module registration and defaults.

Run `pnpm test:docs` before handoff. Run `pnpm verify` when the documentation
changes with source, configuration, or package metadata.
