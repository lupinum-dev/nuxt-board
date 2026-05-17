import type { CommandGuard } from '../types'

interface CommandGuardRegistry {
  add(fn: CommandGuard): () => void
  run(name: string, args: unknown[]): boolean
}

export function createCommandGuardRegistry(): CommandGuardRegistry {
  const guards: CommandGuard[] = []

  function add(fn: CommandGuard): () => void {
    guards.push(fn)
    return () => {
      const index = guards.indexOf(fn)
      if (index !== -1) guards.splice(index, 1)
    }
  }

  function run(name: string, args: unknown[]): boolean {
    if (guards.length === 0) return true
    let proceeded = false
    let i = 0
    function step(): void {
      const guard = guards[i++]
      if (guard) {
        guard(name, args, step)
      } else {
        proceeded = true
      }
    }
    step()
    return proceeded
  }

  return { add, run }
}
