import { createBoardEngine, type BoardEngine, type BoardPlugin } from '../src'
import {
  defineInternalBoardPlugin,
  type InternalBoardPlugin,
  type InternalPluginContext,
} from '../src/internal'

declare const engine: BoardEngine

engine.addCommandGuard((_name, _args, next) => next())

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
    const stop = featureEngine.onAction(() => undefined)
    featureEngine.runCommand('probe', [], () => undefined, {
      history: 'record',
    })
    featureEngine.applyRecordedAction({ type: 'BATCH', actions: [] })
    stop()
  },
})

createBoardEngine({ plugins: [feature] })
// @ts-expect-error Runtime extension installation is intentionally not public.
engine.use(feature)

// @ts-expect-error Public nodes are JSON Canvas node types for the first release.
createBoardEngine().createNode({ type: 'custom-card' })
