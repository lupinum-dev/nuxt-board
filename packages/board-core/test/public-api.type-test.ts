import { createBoardEngine, type BoardEngine } from '../src'
import type {
  InternalBoardFeature,
  InternalFeatureContext,
} from '../src/internal'

declare const engine: BoardEngine

engine.addCommandGuard((_name, _args, next) => next())

// @ts-expect-error Internal action stream is not part of the consumer engine API.
engine.onAction(() => undefined)
// @ts-expect-error History replay internals are not part of the consumer engine API.
engine.applyRecordedAction({ type: 'BATCH', actions: [] })
// @ts-expect-error Command wrapper is available only to internal features.
engine.runCommand('probe', [], () => undefined)

const feature: InternalBoardFeature = {
  name: 'type-probe',
  install(featureEngine: InternalFeatureContext) {
    const stop = featureEngine.onAction(() => undefined)
    featureEngine.runCommand('probe', [], () => undefined, {
      history: 'record',
    })
    featureEngine.applyRecordedAction({ type: 'BATCH', actions: [] })
    stop()
  },
}

createBoardEngine({ extensions: [feature] })
// @ts-expect-error Runtime extension installation is intentionally not public.
engine.use(feature)
