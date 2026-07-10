export type {
  Action as InternalBoardAction,
  NodeMoveDelta as InternalNodeMoveDelta,
} from './state/actions.js'

export type { InternalBoardCommit, InternalHistoryRoot } from './state/types.js'

export type {
  InternalBoardPlugin,
  InternalBoardPluginDefinition,
  InternalPluginContext,
  InternalFeaturePersistence,
} from './types.js'

import type {
  BoardEventMap,
  BoardPlugin,
  BoardPluginApis,
  InternalBoardPlugin,
  InternalBoardPluginDefinition,
} from './types.js'

export function defineInternalBoardPlugin<
  TExtensions extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
>(
  feature: InternalBoardPluginDefinition<TExtensions, TEvents>,
): InternalBoardPlugin<TExtensions, TEvents> {
  return feature as InternalBoardPlugin<TExtensions, TEvents>
}

export function assertInternalBoardPlugin(
  extension: BoardPlugin,
): asserts extension is InternalBoardPlugin {
  const maybeFeature = extension as Partial<InternalBoardPlugin>
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
