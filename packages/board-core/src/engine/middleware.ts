import type { CommandMiddleware } from '../types'

interface MiddlewareRegistry {
  add(fn: CommandMiddleware): () => void
  run(name: string, args: unknown[]): boolean
}

export function createMiddlewareRegistry(): MiddlewareRegistry {
  const middlewares: CommandMiddleware[] = []

  function add(fn: CommandMiddleware): () => void {
    middlewares.push(fn)
    return () => {
      const index = middlewares.indexOf(fn)
      if (index !== -1) middlewares.splice(index, 1)
    }
  }

  function run(name: string, args: unknown[]): boolean {
    if (middlewares.length === 0) return true
    let proceeded = false
    let i = 0
    function step(): void {
      const middleware = middlewares[i++]
      if (middleware) {
        middleware(name, args, step)
      } else {
        proceeded = true
      }
    }
    step()
    return proceeded
  }

  return { add, run }
}
