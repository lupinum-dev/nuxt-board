import type { Action } from '../state/actions'

export type ActionListener = (action: Action) => void

export interface Dispatcher {
  dispatch(action: Action): void
  onAction(listener: ActionListener): () => void
  getLastAction(): Action | null
}

export function createDispatcher(): Dispatcher {
  const listeners = new Set<ActionListener>()
  let lastAction: Action | null = null

  function dispatch(action: Action): void {
    lastAction = action
    for (const listener of listeners) {
      try {
        listener(action)
      } catch (error) {
        console.error('[board] action listener threw:', error)
      }
    }
  }

  function onAction(listener: ActionListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    dispatch,
    onAction,
    getLastAction: () => lastAction
  }
}
