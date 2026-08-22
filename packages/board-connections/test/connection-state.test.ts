import { describe, expect, it, vi } from 'vitest'
import {
  asEdgeId,
  BoardInputError,
  createBoardEngine,
  type JsonCanvasEdge,
} from '@lupinum/board-core'
import { defineInternalBoardPlugin } from '@lupinum/board-core/internal'
import { historyPlugin } from '@lupinum/board-history'
import { connectionsPlugin } from '../src'

function createConnectedEngine(
  options: Parameters<typeof createBoardEngine>[0] = {},
) {
  const engine = createBoardEngine({
    ...options,
    plugins: [historyPlugin(), connectionsPlugin()],
  })
  const source = engine.createNode({ text: 'Source' })
  const target = engine.createNode({ text: 'Target' })
  return { engine, source, target }
}

describe('connection state', () => {
  it('publishes immutable, identity-stable snapshots once per outer commit', () => {
    const { engine, source, target } = createConnectedEngine()
    const snapshots: ReadonlyMap<unknown, unknown>[] = []
    engine.plugins.connections.$edges.subscribe((value) =>
      snapshots.push(value),
    )

    let firstId = asEdgeId('missing')
    engine.batch(() => {
      const first = engine.plugins.connections.createEdge({
        from: source.id,
        to: target.id,
        fromAnchor: { side: 'right', offset: 0.25 },
        toAnchor: { side: 'left', offset: 0.75 },
        data: { nested: { weight: 2 }, values: [1, 2] },
      })
      firstId = first.id
      engine.plugins.connections.createEdge({
        from: target.id,
        to: source.id,
      })
    })

    const first = engine.plugins.connections.getEdge(firstId)!
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.get(firstId)).toBe(first)
    expect(engine.plugins.connections.$edges.get().get(firstId)).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.data)).toBe(true)
    expect(Object.isFrozen(first.data.nested)).toBe(true)
    expect(Object.isFrozen(first.data.values)).toBe(true)
    expect(Object.isFrozen(first.fromAnchor)).toBe(true)
    expect(Object.isFrozen(first.toAnchor)).toBe(true)
  })

  it('treats value-equivalent patches and missing deletes as true no-ops', () => {
    const { engine, source, target } = createConnectedEngine()
    const edge = engine.plugins.connections.createEdge({
      from: source.id,
      to: target.id,
      fromAnchor: { side: 'right', offset: 0.25 },
      data: { weight: 2 },
    })
    engine.plugins.history.clear()
    const snapshots = vi.fn()
    const updated = vi.fn()
    engine.plugins.connections.$edges.subscribe(snapshots)
    engine.on('edge:updated', updated)

    const result = engine.plugins.connections.updateEdge(edge.id, {
      fromAnchor: { side: 'right', offset: 0.25 },
      data: edge.data,
    })
    engine.plugins.connections.deleteEdge(asEdgeId('missing'))

    expect(result).toBe(edge)
    expect(engine.plugins.connections.getEdge(edge.id)).toBe(edge)
    expect(snapshots).not.toHaveBeenCalled()
    expect(updated).not.toHaveBeenCalled()
    expect(engine.plugins.history.getState().undoDepth).toBe(0)
  })

  it('isolates failing subscribers and follows the engine destroy lifecycle', () => {
    const failures: unknown[] = []
    const engine = createBoardEngine({
      plugins: [connectionsPlugin()],
      onUnhandledError(error, context) {
        if (context.source === 'subscriber') failures.push(error)
      },
    })
    const source = engine.createNode({ text: 'Source' })
    const target = engine.createNode({ text: 'Target' })
    const later = vi.fn()
    const edges = engine.plugins.connections.$edges
    edges.subscribe(() => {
      throw new Error('subscriber failed')
    })
    edges.subscribe(later)

    engine.plugins.connections.createEdge({ from: source.id, to: target.id })
    expect(failures).toHaveLength(1)
    expect(later).toHaveBeenCalledOnce()

    engine.destroy()
    expect(() => edges.get()).toThrow(/destroyed/i)
    expect(() => edges.subscribe(() => undefined)).toThrow(/destroyed/i)
  })

  it('round-trips frozen unknown JSON Canvas edge fields through edits and history', () => {
    const { engine } = createConnectedEngine()
    const future = { nested: { enabled: true } }
    engine.loadDocument({
      nodes: [
        {
          id: 'source',
          type: 'text',
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          text: 'Source',
        },
        {
          id: 'target',
          type: 'text',
          x: 200,
          y: 0,
          width: 100,
          height: 60,
          text: 'Target',
        },
      ],
      edges: [
        {
          id: 'future-edge',
          fromNode: 'source',
          toNode: 'target',
          'future-edge-field': future,
        },
      ],
    } as never)
    future.nested.enabled = false
    engine.plugins.history.clear()

    const id = asEdgeId('future-edge')
    engine.plugins.connections.updateEdge(id, { label: 'Updated' })
    engine.plugins.history.undo()
    engine.plugins.history.redo()

    const edge = engine.exportDocument().edges?.[0] as JsonCanvasEdge &
      Record<string, unknown>
    expect(edge.label).toBe('Updated')
    expect(edge['future-edge-field']).toEqual({ nested: { enabled: true } })
    expect(Object.isFrozen(edge['future-edge-field'])).toBe(true)
  })

  it('rejects non-JSON and cyclic edge data', () => {
    const { engine, source, target } = createConnectedEngine()
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    for (const data of [cyclic, { invalid: new Date() }]) {
      expect(() =>
        engine.plugins.connections.createEdge({
          from: source.id,
          to: target.id,
          data: data as never,
        }),
      ).toThrow(BoardInputError)
    }
  })

  it('keeps connection projection current when a later commit effect fails', () => {
    const failures: string[] = []
    const finalized: string[] = []
    const failing = defineInternalBoardPlugin({
      name: 'failing-effect',
      install(engine) {
        return engine.projectCommit(() => () => {
          throw new Error('effect failed')
        })
      },
    })
    const tail = defineInternalBoardPlugin({
      name: 'tail-effect',
      install(engine) {
        return engine.projectCommit(() => () => finalized.push('tail'))
      },
    })
    const engine = createBoardEngine({
      plugins: [connectionsPlugin(), failing, tail],
      onUnhandledError(_error, context) {
        if (context.source === 'commit-effect') failures.push(context.commit)
      },
    })
    const source = engine.createNode({ text: 'Source' })
    const target = engine.createNode({ text: 'Target' })
    const events: string[] = []
    engine.on('edge:created', () => events.push('created'))
    engine.on('edge:updated', () => events.push('updated'))

    const edge = engine.plugins.connections.createEdge({
      from: source.id,
      to: target.id,
    })
    engine.plugins.connections.updateEdge(edge.id, { label: 'Updated' })

    expect(events).toEqual(['created', 'updated'])
    expect(engine.plugins.connections.getEdge(edge.id)?.label).toBe('Updated')
    expect(failures).toEqual(
      expect.arrayContaining(['edge:create', 'edge:update']),
    )
    expect(finalized.length).toBeGreaterThan(0)
  })
})
