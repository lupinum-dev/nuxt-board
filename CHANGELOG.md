# Changelog

## v0.1.0

### First release

- Publish the board engine, Vue bindings, history plugin, connection plugin, and Nuxt module as one fixed-version package set.
- Add atomic transactions and report post-commit errors without corrupting committed state.
- Add structural history, typed document persistence, reactive Vue inputs, and SSR-safe subscriptions.
- Add accessible board controls and packed Nuxt 3 and Nuxt 4 consumer verification.
- Publish the Nuxt module as `@lupinum/nuxt-board`. The old unpublished name has no compatibility package or alias.
- Update the Nuxt toolchain and apply current dependency security fixes.
- Apply the Lupinum repository, documentation, support, and release contracts.

## v1.0.0-beta.0

[compare changes](https://github.com/lupinum-dev/nuxt-board/compare/v0.1.0...main)

### 🚀 Enhancements

- **docs:** Make Nuxt Board feel native to Nuxt ([#23](https://github.com/lupinum-dev/nuxt-board/pull/23))
- **core:** ⚠️ Establish the 1.0 document contract ([#28](https://github.com/lupinum-dev/nuxt-board/pull/28))
- **connections:** ⚠️ Publish immutable edge state ([#29](https://github.com/lupinum-dev/nuxt-board/pull/29))
- **clipboard:** ⚠️ Preserve browser event ownership ([#30](https://github.com/lupinum-dev/nuxt-board/pull/30))
- **vue:** ⚠️ Add timer-free touch navigation ([#31](https://github.com/lupinum-dev/nuxt-board/pull/31))
- **history:** ⚠️ Scope shortcuts to one board ([#32](https://github.com/lupinum-dev/nuxt-board/pull/32))
- **api:** ⚠️ Settle Vue and Nuxt integration ([#33](https://github.com/lupinum-dev/nuxt-board/pull/33))

### 🩹 Fixes

- **release:** Preserve consumed Changeset deletions ([#24](https://github.com/lupinum-dev/nuxt-board/pull/24))
- **docs:** Build when Vercel baseline is missing ([#26](https://github.com/lupinum-dev/nuxt-board/pull/26))

### 📖 Documentation

- Refresh Nuxt Board branding ([#27](https://github.com/lupinum-dev/nuxt-board/pull/27))

### 🏡 Chore

- **standard:** Complete first-release cleanup ([#21](https://github.com/lupinum-dev/nuxt-board/pull/21))
- **release:** Enter the 1.0 beta cycle ([#34](https://github.com/lupinum-dev/nuxt-board/pull/34))

### 🤖 CI

- **docs:** Cut unrelated Vercel build usage ([#22](https://github.com/lupinum-dev/nuxt-board/pull/22))
- Classify expensive verification lanes ([#25](https://github.com/lupinum-dev/nuxt-board/pull/25))

#### ⚠️ Breaking Changes

- **core:** ⚠️ Establish the 1.0 document contract ([#28](https://github.com/lupinum-dev/nuxt-board/pull/28))
- **connections:** ⚠️ Publish immutable edge state ([#29](https://github.com/lupinum-dev/nuxt-board/pull/29))
- **clipboard:** ⚠️ Preserve browser event ownership ([#30](https://github.com/lupinum-dev/nuxt-board/pull/30))
- **vue:** ⚠️ Add timer-free touch navigation ([#31](https://github.com/lupinum-dev/nuxt-board/pull/31))
- **history:** ⚠️ Scope shortcuts to one board ([#32](https://github.com/lupinum-dev/nuxt-board/pull/32))
- **api:** ⚠️ Settle Vue and Nuxt integration ([#33](https://github.com/lupinum-dev/nuxt-board/pull/33))

### ❤️ Contributors

- Matthias Amon
