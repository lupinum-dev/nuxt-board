import { CommandBlockedError } from '@lupinum/board-core'

/** Run a bundled UI command while treating policy blocks as handled input. */
export function runBoardCommand<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch (error) {
    if (error instanceof CommandBlockedError) return undefined
    throw error
  }
}

export function tryBoardCommand(fn: () => void): boolean {
  let ran = false
  const result = runBoardCommand(() => {
    fn()
    ran = true
  })
  return ran || result !== undefined
}
