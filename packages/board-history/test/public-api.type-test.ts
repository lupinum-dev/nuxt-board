import type { HistoryEntry } from '../src'

declare const entry: HistoryEntry

entry.label
entry.timestamp

// @ts-expect-error Recorded replay actions are internal implementation details.
entry.actions
