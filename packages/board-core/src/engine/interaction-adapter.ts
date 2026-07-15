import { BoardInputError } from '../errors.js'
import type { BoardEngine, InternalInteractionAdapter } from '../types.js'

const adapterKey = Symbol.for('@lupinum/board-core/interaction-adapter')

export function registerBoardInteractionAdapter(
  engine: BoardEngine,
  adapter: InternalInteractionAdapter,
): void {
  Object.defineProperty(engine, adapterKey, {
    configurable: true,
    value: adapter,
    enumerable: false,
  })
}

export function getRegisteredBoardInteractionAdapter(
  engine: BoardEngine,
): InternalInteractionAdapter {
  const adapter = Reflect.get(engine, adapterKey) as
    InternalInteractionAdapter | undefined
  if (!adapter) {
    throw new BoardInputError(
      'The supplied engine was not created by createBoardEngine().',
    )
  }
  return adapter
}
