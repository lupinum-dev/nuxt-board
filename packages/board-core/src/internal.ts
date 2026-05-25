export type {
  Action as InternalBoardAction,
  NodeMoveDelta as InternalNodeMoveDelta,
} from './state/actions.js'

export type {
  InternalBoardFeature,
  InternalBoardFeatureDefinition,
  InternalFeatureContext,
  InternalFeaturePersistence,
} from './types.js'

import type {
  BoardEventMap,
  BoardExtension,
  BoardFeatureExtensions,
  InternalBoardFeature,
  InternalBoardFeatureDefinition,
} from './types.js'

export function defineInternalBoardFeature<
  TExtensions extends BoardFeatureExtensions = BoardFeatureExtensions,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
>(
  feature: InternalBoardFeatureDefinition<TExtensions, TEvents>,
): InternalBoardFeature<TExtensions, TEvents> {
  return feature as InternalBoardFeature<TExtensions, TEvents>
}

export function assertInternalBoardFeature(
  extension: BoardExtension,
): asserts extension is InternalBoardFeature {
  const maybeFeature = extension as Partial<InternalBoardFeature>
  if (typeof maybeFeature.name !== 'string' || maybeFeature.name.length === 0) {
    throw new Error(
      'Invalid board extension: expected a named extension token.',
    )
  }
  if (typeof maybeFeature.install !== 'function') {
    throw new Error(
      `Invalid board extension "${maybeFeature.name}": expected an internal feature token created by a first-party extension factory.`,
    )
  }
}
