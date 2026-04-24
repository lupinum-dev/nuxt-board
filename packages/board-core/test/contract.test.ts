import { describe, expect, it } from 'vitest'
import { createBoardEngine } from '../src'
import type { BoardEngine, NodeId } from '../src'

const engineMethods = [
  'batch',
  'destroy',
  'getState',
  'getSnapshot',
  'getGridSettings',
  'getViewportSize',
  'updateGridSettings',
  'setViewportSize',
  'on',
  'once',
  'off',
  'exportTrace',
  'use',
  'addMiddleware',
  'screenToWorld',
  'worldToScreen',
  'getVisibleBounds',
  'getNode',
  'findNode',
  'hasNode',
  'getNodeAt',
  'getNodesInBounds',
  'panBy',
  'panTo',
  'zoomAt',
  'zoomTo',
  'zoomToFit',
  'zoomToNodes',
  'createNode',
  'updateNode',
  'deleteNode',
  'moveNode',
  'translateSelectedNodes',
  'resizeNode',
  'bringToFront',
  'sendToBack',
  'lockNode',
  'unlockNode',
  'duplicateNodes',
  'copySelected',
  'pasteClipboard',
  'select',
  'selectAll',
  'clearSelection',
  'deleteSelected',
  'getSelection',
  'beginPan',
  'beginNodeDrag',
  'beginResize',
  'beginBoxSelect',
  'beginTextEdit',
  'commitTextEdit',
  'updatePointer',
  'endInteraction',
  'getUniformTranslationTargets',
  'syncGroupZOrder',
  'exportJSON',
  'importJSON',
] as const satisfies ReadonlyArray<keyof BoardEngine>

const subscribableProps = [
  '$camera',
  '$nodes',
  '$selection',
  '$interaction',
  '$snapGuides',
] as const

describe('BoardEngine public API contract', () => {
  it('exposes every documented method and subscribable', () => {
    const engine = createBoardEngine()

    for (const method of engineMethods) {
      expect(
        typeof engine[method],
        `engine.${method} should be a function`,
      ).toBe('function')
    }
    for (const prop of subscribableProps) {
      const sub = engine[prop]
      expect(sub, `engine.${prop} should be a subscribable`).toBeDefined()
      expect(typeof sub.get).toBe('function')
      expect(typeof sub.subscribe).toBe('function')
    }
    expect(engine.ext).toBeDefined()
  })

  it('getSnapshot returns the documented shape', () => {
    const engine = createBoardEngine()
    const snapshot = engine.getSnapshot()
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'camera',
        'grid',
        'interaction',
        'nextZIndex',
        'nodes',
        'selection',
        'snapGuides',
      ].sort(),
    )
    expect(snapshot.camera).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    })
    expect(snapshot.grid).toMatchObject({
      size: expect.any(Number),
      majorEvery: expect.any(Number),
      snap: expect.any(Boolean),
      edgeSnap: expect.any(Boolean),
      edgeSnapThreshold: expect.any(Number),
      pattern: expect.any(String),
    })
    expect(Array.isArray(snapshot.nodes)).toBe(true)
    expect(Array.isArray(snapshot.selection)).toBe(true)
    expect(Array.isArray(snapshot.snapGuides)).toBe(true)
    expect(snapshot.interaction).toMatchObject({ mode: expect.any(String) })
    expect(typeof snapshot.nextZIndex).toBe('number')
  })

  it('getState returns the documented reactive shape', () => {
    const engine = createBoardEngine()
    const state = engine.getState()
    expect(Object.keys(state).sort()).toEqual(
      [
        'camera',
        'interaction',
        'nextZIndex',
        'nodes',
        'selection',
        'snapGuides',
      ].sort(),
    )
    expect(state.nodes).toBeInstanceOf(Map)
    expect(state.selection).toBeInstanceOf(Set)
  })

  it('createNode returns a node with the documented shape', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({
      type: 'text',
      x: 10,
      y: 20,
      data: { content: 'hi' },
    })
    expect(Object.keys(node).sort()).toEqual(
      [
        'data',
        'height',
        'id',
        'locked',
        'type',
        'visible',
        'width',
        'x',
        'y',
        'zIndex',
      ].sort(),
    )
    expect(node).toMatchObject({
      type: 'text',
      x: 10,
      y: 20,
      width: expect.any(Number),
      height: expect.any(Number),
      locked: false,
      visible: true,
      zIndex: expect.any(Number),
    })
    expect(typeof node.id).toBe('string')
  })

  it('get/find/has triplet behaves as documented', () => {
    const engine = createBoardEngine()
    const node = engine.createNode({ type: 'text', x: 0, y: 0, data: {} })
    const ghost = 'does-not-exist' as unknown as NodeId

    expect(engine.getNode(node.id)).toMatchObject({ id: node.id })
    expect(() => engine.getNode(ghost)).toThrow()
    expect(engine.findNode(node.id)).toMatchObject({ id: node.id })
    expect(engine.findNode(ghost)).toBeNull()
    expect(engine.hasNode(node.id)).toBe(true)
    expect(engine.hasNode(ghost)).toBe(false)
  })

  it('event subscriptions return an unsubscribe', () => {
    const engine = createBoardEngine()
    const off = engine.on('node:created', () => {})
    expect(typeof off).toBe('function')
    off()
  })

  it('addMiddleware returns an unsubscribe', () => {
    const engine = createBoardEngine()
    const off = engine.addMiddleware((_name, _args, next) => next())
    expect(typeof off).toBe('function')
    off()
  })

  it('exportJSON / importJSON round-trip preserves persistent state', () => {
    const engine = createBoardEngine({ grid: { snap: false } })
    const node = engine.createNode({
      type: 'text',
      x: 5,
      y: 5,
      data: { content: 'r' },
    })
    engine.select([node.id])
    const json = engine.exportJSON()

    const fresh = createBoardEngine({ grid: { snap: false } })
    fresh.importJSON(json, 'replace')

    const restored = fresh.getSnapshot()
    expect(restored.nodes).toHaveLength(1)
    expect(restored.nodes[0]).toMatchObject({ id: node.id, x: 5, y: 5 })
    expect(restored.selection).toEqual([node.id])
  })

  it('getSnapshot is a frozen, defensive copy', () => {
    const engine = createBoardEngine()
    engine.createNode({ type: 'text', x: 0, y: 0, data: {} })
    const snapshot = engine.getSnapshot()
    expect(Object.isFrozen(snapshot)).toBe(true)
  })
})
