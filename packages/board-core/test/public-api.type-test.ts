import type {
  BoardEngine,
  FirstPartyBoardFeature,
  FirstPartyBoardFeatureContext,
} from '../src'

declare const engine: BoardEngine

engine.addCommandGuard((_name, _args, next) => next())

// @ts-expect-error Internal action stream is not part of the consumer engine API.
engine.onAction(() => undefined)
// @ts-expect-error History replay internals are not part of the consumer engine API.
engine.applyRecordedAction({ type: 'BATCH', actions: [] })
// @ts-expect-error Command wrapper is available only to first-party features.
engine.runCommand('probe', [], () => undefined)

const feature: FirstPartyBoardFeature = {
  name: 'type-probe',
  install(featureEngine: FirstPartyBoardFeatureContext) {
    const stop = featureEngine.onAction(() => undefined)
    featureEngine.runCommand('probe', [], () => undefined)
    featureEngine.applyRecordedAction({ type: 'BATCH', actions: [] })
    stop()
  },
}

engine.use(feature)
