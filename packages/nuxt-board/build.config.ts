export default {
  hooks: {
    'build:prepare'({ pkg }: { pkg: { exports?: Record<string, unknown> } }) {
      // This build owns runtime files. The pack command renders documentation
      // afterward and verifies every export in the actual package manifest.
      // Omit only that deferred text export from unbuild's in-memory check.
      delete pkg.exports?.['./agent-docs']
    },
  },
}
