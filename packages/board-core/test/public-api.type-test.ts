import {
  createBoardEngine,
  type BoardEngine,
  type BoardNode,
  type BoardPlugin,
} from '../src'

// @ts-expect-error The v0.1 metadata name was removed from the 1.0 API.
import type { VueBoardNodeMetadata } from '../src'
// @ts-expect-error The v0.1 metadata name was removed from the 1.0 API.
import type { VueBoardEdgeMetadata } from '../src'
// @ts-expect-error The v0.1 metadata name was removed from the 1.0 API.
import type { VueBoardDocumentMetadata } from '../src'

type RemovedMetadataNames =
  VueBoardNodeMetadata | VueBoardEdgeMetadata | VueBoardDocumentMetadata
void (null as RemovedMetadataNames | null)
import {
  defineInternalBoardPlugin,
  type InternalBoardPlugin,
  type InternalPluginContext,
} from '../src/internal'

declare const engine: BoardEngine

engine.addCommandGuard(() => true)

// @ts-expect-error Pointer sessions are available only to framework adapters.
engine.beginNodeDrag('node', 1, { x: 0, y: 0 })
// @ts-expect-error Pointer projection helpers are not application commands.
engine.getUniformTranslationTargets([])

// @ts-expect-error Internal action stream is not part of the consumer engine API.
engine.onAction(() => undefined)
// @ts-expect-error History replay internals are not part of the consumer engine API.
engine.applyRecordedAction({ type: 'BATCH', actions: [] })
// @ts-expect-error Command wrapper is available only to internal features.
engine.runCommand('probe', [], () => undefined)

// @ts-expect-error BoardPlugin is an opaque token, not a structural name bag.
const fakeExtension: BoardPlugin = { name: 'fake' }

const feature: InternalBoardPlugin = defineInternalBoardPlugin({
  name: 'type-probe',
  install(featureEngine: InternalPluginContext) {
    const stop = featureEngine.projectCommit(() => () => undefined)
    featureEngine.runCommand('probe', [], () => undefined, {
      history: 'record',
    })
    stop()
  },
})

createBoardEngine({ plugins: [feature] })
// @ts-expect-error Runtime extension installation is intentionally not public.
engine.use(feature)

// @ts-expect-error Public nodes are JSON Canvas node types for the first release.
createBoardEngine().createNode({ type: 'custom-card' })

declare const node: BoardNode
if (node.type === 'text') {
  node.text.toUpperCase()
  // @ts-expect-error Text nodes cannot contain file data.
  node.file.toUpperCase()
}
if (node.type === 'file') node.file.toUpperCase()
if (node.type === 'link') node.url.toUpperCase()

// @ts-expect-error File nodes require a file value.
createBoardEngine().createNode({ type: 'file' })
// @ts-expect-error Link nodes require a URL value.
createBoardEngine().createNode({ type: 'link' })
