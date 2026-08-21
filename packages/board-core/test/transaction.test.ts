import { describe, expect, it } from 'vitest'
import { asNodeId, type BoardNode } from '../src/index.js'
import { stagePersistentRoots } from '../src/engine/transaction.js'

describe('stagePersistentRoots', () => {
  it('isolates writable containers while structurally sharing immutable values', () => {
    const node: BoardNode = Object.freeze({
      id: asNodeId('node'),
      type: 'text',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      text: 'Node',
      zIndex: 1,
      locked: false,
      visible: true,
    })
    const pluginSlice = Object.freeze({ edges: new Map() })
    const roots = {
      state: {
        camera: { x: 0, y: 0, z: 1 },
        nodes: new Map([[node.id, node]]),
        selection: new Set([node.id]),
        interaction: { mode: 'idle' as const },
        snapGuides: [],
        nextZIndex: 2,
        jsonCanvas: { document: Object.freeze({}), nodes: new Map() },
      },
      grid: {
        size: 10,
        majorEvery: 5,
        snap: true,
        edgeSnap: true,
        edgeSnapThreshold: 8,
        pattern: 'line' as const,
      },
      pluginStates: new Map([['probe', { state: pluginSlice }]]),
    }

    const candidate = stagePersistentRoots(roots)

    expect(candidate.state.nodes).not.toBe(roots.state.nodes)
    expect(candidate.state.nodes.get(node.id)).toBe(node)
    expect(candidate.state.selection).not.toBe(roots.state.selection)
    expect(candidate.grid).not.toBe(roots.grid)
    expect(candidate.pluginStates).not.toBe(roots.pluginStates)
    expect(candidate.pluginStates.get('probe')?.state).toBe(pluginSlice)

    candidate.state.nodes.clear()
    candidate.state.selection.clear()
    candidate.pluginStates.get('probe')!.state = { changed: true }

    expect(roots.state.nodes.size).toBe(1)
    expect(roots.state.selection.size).toBe(1)
    expect(roots.pluginStates.get('probe')?.state).toBe(pluginSlice)
  })
})
