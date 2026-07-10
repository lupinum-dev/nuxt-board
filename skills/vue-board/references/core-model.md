# Core Model Reference

Use this reference for `@lupinum/board-core` behavior. Verify against source when changing API claims.

## Source Paths

- Public exports: `packages/board-core/src/index.ts`
- Engine methods: `packages/board-core/src/types.ts` (`BoardEngine`) and `packages/board-core/src/engine.ts`
- Defaults: `packages/board-core/src/state/types.ts`
- Persistence: `packages/board-core/src/engine/persistence.ts`
- Node hierarchy: `packages/board-core/src/hierarchy.ts` and group logic in `engine.ts`
- Selection helpers: `packages/board-core/src/selection.ts`
- Math helpers: `packages/board-core/src/math.ts`

## Defaults

```ts
camera = { x: 0, y: 0, z: 1 }
zoom = { min: 0.1, max: 8 }
grid = {
  size: 10,
  majorEvery: 5,
  snap: true,
  edgeSnap: true,
  edgeSnapThreshold: 8,
  pattern: 'line',
}
nodeConstraints = {
  minWidth: 50,
  minHeight: 50,
  defaultWidth: 240,
  defaultHeight: 160,
}
```

Examples may choose `grid.size: 20` for readability, but do not call that the default.

## Engine Options

- `initialNodes` expects complete `BoardNode` records, including `zIndex`, `locked`, and `visible`. Use this for deterministic SSR/tests.
- `createNode(input)` accepts partial `NodeInput` and fills defaults. Use it for imperative setup and interactive creation.
- `initialDocument` accepts a normalized JSON Canvas document. Documents with edges require the connections extension to be installed.
- `plugins` installs first-party feature plugins such as `connectionsPlugin()` and `historyPlugin()`.

## Node Shape

Supported node types:

```ts
type JsonCanvasNodeType = 'text' | 'file' | 'link' | 'group'
```

Node fields:

- Common: `id`, `type`, `x`, `y`, `width`, `height`, `color`, `zIndex`, `locked`, `visible`, `parentId`
- Text: `text`
- File: `file`, `subpath`
- Link: `url`
- Group: `label`, `background`, `backgroundStyle`

Create inputs can omit most fields. `createNode()` fills defaults and selects the created node unless `select: false` is passed.

`CanvasColor` is a preset `'1'` to `'6'` or `#${string}`. Import validates presets and six-digit hex colors. Preset labels are Rose, Amber, Citron, Moss, Azure, Violet.

## Commands and Reads

Use commands as the mutation boundary:

- Node commands: `createNode`, `updateNode`, `deleteNode`, `moveNode`, `translateSelectedNodes`, `resizeNode`, `bringToFront`, `sendToBack`, `lockNode`, `unlockNode`, `duplicateNodes`, `copySelected`, `pasteClipboard`
- Selection commands: `select`, `selectAll`, `clearSelection`, `deleteSelected`
- Camera commands: `panBy`, `panTo`, `zoomAt`, `zoomTo`, `zoomToFit`, `zoomToNodes`
- Interaction commands: `beginPan`, `beginNodeDrag`, `beginResize`, `beginBoxSelect`, `beginTextEdit`, `commitTextEdit`, `updatePointer`, `endInteraction`
- Grid/hierarchy/persistence: `updateGridSettings`, `getUniformTranslationTargets`, `syncGroupZOrder`, `exportJSON`, `importJSON`

Reads include `getState`, `getSnapshot`, `getGridSettings`, `getViewportSize`, `getNode`, `findNode`, `hasNode`, `getNodeAt`, `getNodesInBounds`, `getSelection`, `getVisibleBounds`, `screenToWorld`, `worldToScreen`, `exportTrace`, and subscribables such as `$nodes`.

## Selection and Hierarchy

- `selectAll()` selects all visible nodes.
- Locked nodes are still selectable, but interactive move/resize/delete paths skip or block them.
- `deleteSelected()` deletes unlocked selected roots and their descendants.
- Deleting a group deletes its descendants.
- Group capture during drag checks final bounds. Visible, unlocked nodes fully contained by a moved group become children of that group.
- If multiple groups contain a node, helpers choose the smallest visible group that fully contains the node bounds.
- Call `syncGroupZOrder(groupId)` after manually changing hierarchy so descendants render above their group.

## Public Helpers

Top-level `@lupinum/board-core` exports:

- `createBoardEngine`, `CommandBlockedError`
- `asNodeId`, `asEdgeId`
- color helpers: `BOARD_COLOR_PRESETS`, `colorForPreset`, `isBoardColorPreset`
- selection helpers: `getSelectionNodes`, `getSelectionBounds`, `toggleIds`
- math helpers: `boundsIntersect`, `clamp`, `getBoundsFromPoints`, `getVisibleBounds`

`@lupinum/board-core/internal` is first-party feature ABI for workspace packages, not an app plugin API.
