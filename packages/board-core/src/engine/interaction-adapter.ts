import { BoardInputError } from '../errors.js'
import type { BoardEngine, InternalInteractionAdapter } from '../types.js'

const adapters = new WeakMap<BoardEngine, InternalInteractionAdapter>()
const adapterKey = Symbol('board-interaction-adapter')

export function registerBoardInteractionAdapter(
  engine: BoardEngine,
  adapter: InternalInteractionAdapter,
): void {
  adapters.set(engine, adapter)
  Object.defineProperty(engine, adapterKey, {
    configurable: true,
    enumerable: false,
    value: adapter,
    writable: false,
  })
}

export function getRegisteredBoardInteractionAdapter(
  engine: BoardEngine,
): InternalInteractionAdapter {
  const adapter =
    adapters.get(engine) ??
    (
      engine as BoardEngine & {
        readonly [adapterKey]?: InternalInteractionAdapter
      }
    )[adapterKey]
  if (!adapter) {
    throw new BoardInputError(
      'The supplied engine was not created by createBoardEngine().',
    )
  }
  return adapter
}
