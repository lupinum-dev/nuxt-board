export type { InternalBoardCommit, InternalHistoryRoot } from './state/types.js'
export { readonlyMapView } from './helpers/clone.js'
export {
  collectJsonObjectExtras,
  freezeJsonObject,
  freezeJsonValue,
} from './helpers/json.js'
export {
  BOARD_EDITOR_ATTRIBUTE,
  BOARD_INTERACTIVE_ATTRIBUTE,
  BOARD_INTERACTIVE_SELECTOR,
  BOARD_NODE_ID_ATTRIBUTE,
  BOARD_RESIZE_ATTRIBUTE,
  BOARD_ROOT_ATTRIBUTE,
  BOARD_ROOT_SELECTOR,
} from './dom-attributes.js'

export type {
  InternalBoardPlugin,
  InternalBoardPluginDefinition,
  InternalInteractionAdapter,
  InternalPluginContext,
  InternalPluginPersistence,
} from './types.js'

/** Resolve the unsupported first-party pointer/session surface used by framework adapters. */
export function getBoardInteractionAdapter(
  engine: import('./types.js').BoardEngine,
): InternalInteractionAdapter {
  return getRegisteredBoardInteractionAdapter(engine)
}

import { getRegisteredBoardInteractionAdapter } from './engine/interaction-adapter.js'

import type {
  BoardEventMap,
  BoardPlugin,
  BoardPluginApis,
  InternalBoardPlugin,
  InternalBoardPluginDefinition,
  InternalInteractionAdapter,
} from './types.js'

export function defineInternalBoardPlugin<
  TPluginApis extends BoardPluginApis = BoardPluginApis,
  TEvents extends {
    [K in keyof TEvents]: (...args: never[]) => unknown
  } = BoardEventMap,
>(
  plugin: InternalBoardPluginDefinition<TPluginApis, TEvents>,
): InternalBoardPlugin<TPluginApis, TEvents> {
  return plugin as InternalBoardPlugin<TPluginApis, TEvents>
}

export function assertInternalBoardPlugin(
  plugin: BoardPlugin,
): asserts plugin is InternalBoardPlugin {
  const candidate = plugin as unknown as Partial<InternalBoardPlugin>
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
    throw new Error('Invalid board plugin: expected a named plugin token.')
  }
  if (typeof candidate.install !== 'function') {
    throw new Error(
      `Invalid board plugin "${candidate.name}": expected a token created by a first-party plugin factory.`,
    )
  }
}
