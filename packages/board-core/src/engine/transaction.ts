import { cloneInteraction } from '../invariants.js'
import type { MutableBoardState } from '../state/types.js'
import type { InternalHistoryRoot } from '../state/types.js'
import type { CommandMetadata, GridSettings } from '../types.js'

export type MutablePluginStates = Map<string, { state: unknown }>

export interface PersistentRoots {
  state: MutableBoardState
  grid: GridSettings
  pluginStates: MutablePluginStates
}

export type RuntimeCommandMetadata = CommandMetadata & { validate?: false }

interface TransactionExecutorDeps<TRoot> {
  assertAlive: () => void
  runGuard: (
    name: string,
    args: unknown[],
    metadata: CommandMetadata,
  ) => string | null
  emitBlocked: (
    name: string,
    args: unknown[],
    metadata: CommandMetadata,
  ) => void
  emitBefore: (name: string, args: unknown[], metadata: CommandMetadata) => void
  emitAfter: (
    name: string,
    args: unknown[],
    duration: number,
    metadata: CommandMetadata,
  ) => void
  createBlockedError: (name: string, args: unknown[], reason: string) => Error
  isBatching: () => boolean
  canOwnEffects: () => boolean
  beginEffects: () => void
  commitEffects: () => void
  rollbackEffects: () => void
  markValidationPending: () => void
  captureHistoryRoot: () => InternalHistoryRoot
  beginPersistentTransaction: () => TRoot
  rollbackPersistentTransaction: (checkpoint: TRoot) => void
  beforeExecute: (
    name: string,
    metadata: CommandMetadata,
    historyBefore: InternalHistoryRoot | null,
  ) => InternalHistoryRoot | null
  publishCommit: (
    label: string,
    metadata: CommandMetadata,
    before: InternalHistoryRoot,
  ) => void
  validate: (context: string) => void
  isCancellation: (error: unknown) => boolean
}

interface CommitOverride {
  before: InternalHistoryRoot
  label: string
  metadata: CommandMetadata
}

/** Own guarded command staging, validation, publication, and rollback order. */
export function createTransactionExecutor<TRoot>(
  deps: TransactionExecutorDeps<TRoot>,
): {
  runCommand: <T>(
    name: string,
    args: unknown[],
    fn: () => T,
    metadata?: RuntimeCommandMetadata,
    commitOverride?: CommitOverride,
  ) => T
  runAsyncCommand: <T>(
    name: string,
    args: unknown[],
    fn: () => Promise<T>,
    metadata?: RuntimeCommandMetadata,
  ) => Promise<T>
} {
  const defaultMetadata: CommandMetadata = { history: 'record' }

  function prepare(
    name: string,
    args: unknown[],
    metadata: RuntimeCommandMetadata,
    emitBefore: boolean,
  ): void {
    deps.assertAlive()
    const blockedReason = deps.runGuard(name, args, metadata)
    if (blockedReason) {
      deps.emitBlocked(name, args, metadata)
      throw deps.createBlockedError(name, args, blockedReason)
    }
    if (emitBefore) deps.emitBefore(name, args, metadata)
  }

  function runCommand<T>(
    name: string,
    args: unknown[],
    fn: () => T,
    metadata: RuntimeCommandMetadata = defaultMetadata,
    commitOverride?: CommitOverride,
  ): T {
    const inBatch = deps.isBatching()
    prepare(name, args, metadata, false)
    const started = performance.now()
    const ownsEffects = deps.canOwnEffects()
    if (ownsEffects) deps.beginEffects()
    if (!inBatch) deps.emitBefore(name, args, metadata)
    let historyBefore = ownsEffects ? deps.captureHistoryRoot() : null
    const checkpoint =
      ownsEffects && metadata.validate !== false
        ? deps.beginPersistentTransaction()
        : null

    try {
      historyBefore =
        deps.beforeExecute(name, metadata, historyBefore) ?? historyBefore
      const result = fn()
      if (metadata.validate !== false) {
        if (inBatch) deps.markValidationPending()
        else deps.validate(name)
      }
      const commitBefore = commitOverride?.before ?? historyBefore
      if (commitBefore) {
        deps.publishCommit(
          commitOverride?.label ?? name,
          commitOverride?.metadata ?? metadata,
          commitBefore,
        )
      }
      if (!inBatch) {
        deps.emitAfter(name, args, performance.now() - started, metadata)
      }
      if (ownsEffects) deps.commitEffects()
      return result
    } catch (error) {
      if (checkpoint) deps.rollbackPersistentTransaction(checkpoint)
      if (ownsEffects) deps.rollbackEffects()
      throw error
    }
  }

  async function runAsyncCommand<T>(
    name: string,
    args: unknown[],
    fn: () => Promise<T>,
    metadata: RuntimeCommandMetadata = defaultMetadata,
  ): Promise<T> {
    prepare(name, args, metadata, false)
    const started = performance.now()
    try {
      const result = await fn()
      if (metadata.validate !== false) deps.validate(name)
      deps.emitBefore(name, args, metadata)
      deps.emitAfter(name, args, performance.now() - started, metadata)
      return result
    } catch (error) {
      if (deps.isCancellation(error)) return undefined as T
      throw error
    }
  }

  return { runCommand, runAsyncCommand }
}

/**
 * Create an isolated candidate for one outer persistent command.
 * Node records and plugin slices remain shared until a command replaces them.
 */
export function stagePersistentRoots(roots: PersistentRoots): PersistentRoots {
  return {
    state: {
      camera: { ...roots.state.camera },
      nodes: new Map(roots.state.nodes),
      selection: new Set(roots.state.selection),
      interaction: cloneInteraction(roots.state.interaction),
      snapGuides: roots.state.snapGuides.map((guide) => ({ ...guide })),
      nextZIndex: roots.state.nextZIndex,
    },
    grid: { ...roots.grid },
    pluginStates: new Map(
      Array.from(roots.pluginStates, ([name, pluginState]) => [
        name,
        { state: pluginState.state },
      ]),
    ),
  }
}
