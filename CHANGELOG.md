# Changelog

## v0.1.0

### 🚀 Enhancements

- Integrate Tailwind CSS into the playground app ([0ecec4b](https://github.com/lupinum-dev/nuxt-board/commit/0ecec4b))
- Add image upload functionality and enhance image node rendering ([d733030](https://github.com/lupinum-dev/nuxt-board/commit/d733030))
- Add CanvasSnapGuides component for visual snapping guides ([0675921](https://github.com/lupinum-dev/nuxt-board/commit/0675921))
- Implement grouping functionality for canvas nodes ([8ba910e](https://github.com/lupinum-dev/nuxt-board/commit/8ba910e))
- Enhance GroupNodeRenderer and CanvasNode components with improved styling and group handling ([62670fa](https://github.com/lupinum-dev/nuxt-board/commit/62670fa))
- Enhance GroupNodeRenderer with editing functionality and improve styling for input elements ([ac76919](https://github.com/lupinum-dev/nuxt-board/commit/ac76919))
- Add functionality to find node ID at screen point for improved interaction handling ([aca189d](https://github.com/lupinum-dev/nuxt-board/commit/aca189d))
- Update styling for CanvasNode and CanvasNodeHandle components for improved visibility ([fa6f34f](https://github.com/lupinum-dev/nuxt-board/commit/fa6f34f))
- Simplify image node positioning by using worldCenterForViewportBox function ([2411f68](https://github.com/lupinum-dev/nuxt-board/commit/2411f68))
- Implement command middleware for enhanced command handling and add pinch-to-zoom functionality style: update CanvasNode and CanvasNodeHandle components for improved theming and visibility ([90aa696](https://github.com/lupinum-dev/nuxt-board/commit/90aa696))
- Add updateEdge functionality to modify existing edges and emit edge:updated event ([0d888a8](https://github.com/lupinum-dev/nuxt-board/commit/0d888a8))
- Update anchor point logic to center on resolved side and enhance tests for auto endpoints ([a36963d](https://github.com/lupinum-dev/nuxt-board/commit/a36963d))
- Enhance grid snapping with edge snapping functionality and adjustable thresholds ([a77ae15](https://github.com/lupinum-dev/nuxt-board/commit/a77ae15))
- Add arc routing option and implement arc route functionality ([af87ce0](https://github.com/lupinum-dev/nuxt-board/commit/af87ce0))
- Enhance documentation and interfaces for board components and serializers ([6b8c7b7](https://github.com/lupinum-dev/nuxt-board/commit/6b8c7b7))
- Implement box selection behavior with AutoCAD semantics and adjustable styles ([bd0b75d](https://github.com/lupinum-dev/nuxt-board/commit/bd0b75d))
- **tests:** Add new tests for docs contracts and hard domain regressions ([b0f5065](https://github.com/lupinum-dev/nuxt-board/commit/b0f5065))
- Tighten board package APIs ([c726e3e](https://github.com/lupinum-dev/nuxt-board/commit/c726e3e))
- Enhance mind map and workflow demos with improved state management and rendering ([52d8ec6](https://github.com/lupinum-dev/nuxt-board/commit/52d8ec6))
- **vue:** Make board controls keyboard accessible ([32b37ba](https://github.com/lupinum-dev/nuxt-board/commit/32b37ba))

### 🔥 Performance

- Add LOD system and reduce snapshot overhead for 500-node rendering ([cc3660c](https://github.com/lupinum-dev/nuxt-board/commit/cc3660c))

### 🩹 Fixes

- Update CSS contain property for CanvasNode component ([aa14950](https://github.com/lupinum-dev/nuxt-board/commit/aa14950))
- **docs:** Stabilize build config and demos ([9bb6b9a](https://github.com/lupinum-dev/nuxt-board/commit/9bb6b9a))
- **docs:** Harden page actions and e2e gate ([3a00077](https://github.com/lupinum-dev/nuxt-board/commit/3a00077))
- **ci:** Gate docs deployment after secret resolution ([#2](https://github.com/lupinum-dev/nuxt-board/pull/2))
- **ci:** Raise docs build heap limit ([#3](https://github.com/lupinum-dev/nuxt-board/pull/3))
- **ci:** Install browser for release verification ([#4](https://github.com/lupinum-dev/nuxt-board/pull/4))
- **vue:** Remove unsafe node memoization ([80957ed](https://github.com/lupinum-dev/nuxt-board/commit/80957ed))
- **vue:** Enforce board event ownership ([3b26ffb](https://github.com/lupinum-dev/nuxt-board/commit/3b26ffb))
- **vue:** Respect text editing capabilities ([1d31e46](https://github.com/lupinum-dev/nuxt-board/commit/1d31e46))
- **vue:** Avoid subscriptions during SSR ([51134df](https://github.com/lupinum-dev/nuxt-board/commit/51134df))
- **vue:** Support reactive composable inputs ([8124b13](https://github.com/lupinum-dev/nuxt-board/commit/8124b13))
- **packages:** Align dependency ownership ([b25afaf](https://github.com/lupinum-dev/nuxt-board/commit/b25afaf))
- **nuxt:** Make reactive reads lint-safe ([416e588](https://github.com/lupinum-dev/nuxt-board/commit/416e588))
- **deps:** Patch production security advisories ([#7](https://github.com/lupinum-dev/nuxt-board/pull/7))
- **release:** Verify automated version PRs ([#13](https://github.com/lupinum-dev/nuxt-board/pull/13))
- **release:** Keep version pull requests formatted ([#14](https://github.com/lupinum-dev/nuxt-board/pull/14))

### 💅 Refactors

- Update layout and styles for Playground app; enhance toolbar and settings panel functionality ([05f242e](https://github.com/lupinum-dev/nuxt-board/commit/05f242e))
- Remove unused TypeScript definitions and improve CanvasNode rendering ([2903120](https://github.com/lupinum-dev/nuxt-board/commit/2903120))
- Update demo components for improved UI and functionality ([d14f2c8](https://github.com/lupinum-dev/nuxt-board/commit/d14f2c8))
- Remove @lupinum/board-selection package and update related documentation ([143ac20](https://github.com/lupinum-dev/nuxt-board/commit/143ac20))
- Rename invariant handling to validation and update related types ([62a1ac6](https://github.com/lupinum-dev/nuxt-board/commit/62a1ac6))
- **vue:** Keep grid state engine-owned ([dd24285](https://github.com/lupinum-dev/nuxt-board/commit/dd24285))
- **vue:** Expose readonly reactive state ([5250796](https://github.com/lupinum-dev/nuxt-board/commit/5250796))
- **vue:** Align public composable names ([6cf09d4](https://github.com/lupinum-dev/nuxt-board/commit/6cf09d4))

### 📖 Documentation

- Overhaul board documentation ([10613c3](https://github.com/lupinum-dev/nuxt-board/commit/10613c3))
- Add Vue Board agent skill ([419833e](https://github.com/lupinum-dev/nuxt-board/commit/419833e))
- Align release and engine guidance ([d367d17](https://github.com/lupinum-dev/nuxt-board/commit/d367d17))
- Update Ginko Docs consumer to 0.2.3 ([138c561](https://github.com/lupinum-dev/nuxt-board/commit/138c561))

### 🏡 Chore

- Add playground package to pnpm workspace configuration ([2249351](https://github.com/lupinum-dev/nuxt-board/commit/2249351))
- Prepare package release artifacts ([23004f3](https://github.com/lupinum-dev/nuxt-board/commit/23004f3))
- Remove stale workspace cleanup config ([33ae2e6](https://github.com/lupinum-dev/nuxt-board/commit/33ae2e6))
- Tighten package hygiene checks ([eb7b6a0](https://github.com/lupinum-dev/nuxt-board/commit/eb7b6a0))
- Enforce unused TypeScript cleanup ([c5e2701](https://github.com/lupinum-dev/nuxt-board/commit/c5e2701))
- **release:** Lock first-party package versions ([9feecf4](https://github.com/lupinum-dev/nuxt-board/commit/9feecf4))
- Standardize Nuxt Board repository ([#8](https://github.com/lupinum-dev/nuxt-board/pull/8))
- Complete Lupinum repository standard ([#11](https://github.com/lupinum-dev/nuxt-board/pull/11))

### ✅ Tests

- Codify release guardrails ([a14f274](https://github.com/lupinum-dev/nuxt-board/commit/a14f274))
- **nuxt:** Use the official module lifecycle ([cb9db53](https://github.com/lupinum-dev/nuxt-board/commit/cb9db53))
- **nuxt:** Prove supported release floors ([2706937](https://github.com/lupinum-dev/nuxt-board/commit/2706937))
- **nuxt:** Cover browser hydration ([8e27757](https://github.com/lupinum-dev/nuxt-board/commit/8e27757))
- **nuxt:** Share the workspace runner ([b832674](https://github.com/lupinum-dev/nuxt-board/commit/b832674))

### ❤️ Contributors

- Matthias Amon ([@Mat4m0](https://github.com/Mat4m0))
- Mat4m0
