import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  asNodeId,
  CommandBlockedError,
  createBoardEngine,
} from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'
import { connectionsPlugin } from '../src'
import { createConnectionActions } from '../src/connection-actions'
import type { CreateDragState } from '../src/controller'

function fixture() {
  const engine = createBoardEngine({
    plugins: [historyPlugin(), connectionsPlugin()],
  })
  const source = engine.createNode({ text: 'source' })
  engine.plugins.history.clear()
  const selectedEdgeId = ref<string | null>(null)
  const hoveredEdgeId = ref<string | null>(null)
  let cancelled = false
  const actions = createConnectionActions({
    getEngine: () => engine,
    getEntry: () => undefined,
    getRootElement: () => null,
    getEndpointMode: () => 'manual',
    createNodeForConnection: () => () =>
      cancelled
        ? null
        : engine.createNode({ id: asNodeId('target'), text: 'target' }),
    state: {
      selectedEdgeId,
      hoveredEdgeId,
      hoveredNodeHandle: ref(null),
      editingEdgeId: ref(null),
      labelDraft: ref(''),
      openMenu: ref(null),
    },
  })
  const drag: CreateDragState = {
    mode: 'create',
    sourceNodeId: source.id,
    sourceSide: 'right',
    pointerId: 1,
    pointerWorld: { x: 400, y: 200 },
    candidateNodeId: null,
    candidateAnchor: null,
  }
  return {
    engine,
    actions,
    drag,
    selectedEdgeId,
    hoveredEdgeId,
    cancel: () => {
      cancelled = true
    },
  }
}

describe('atomic connection creation', () => {
  it('undoes and redoes the target node and edge together', () => {
    const { engine, actions, drag, selectedEdgeId } = fixture()
    actions.commitDrag(drag)
    const [edge] = engine.plugins.connections.getEdges()
    expect(edge).toBeDefined()
    expect(selectedEdgeId.value).toBe(edge?.id)
    expect(engine.getState().nodes.size).toBe(2)
    expect(engine.plugins.history.getState().undoDepth).toBe(1)
    engine.plugins.history.undo()
    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    engine.plugins.history.redo()
    expect(engine.getState().nodes.size).toBe(2)
    expect(engine.plugins.connections.getEdges()).toEqual([edge])
    engine.destroy()
  })

  it('rolls back the target when edge creation is blocked', () => {
    const { engine, actions, drag, selectedEdgeId, hoveredEdgeId } = fixture()
    engine.addCommandGuard(({ name }) =>
      name === 'edge:create' ? 'blocked' : true,
    )
    actions.commitDrag(drag)
    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    expect(engine.plugins.history.getState().undoDepth).toBe(0)
    expect(selectedEdgeId.value).toBeNull()
    expect(hoveredEdgeId.value).toBeNull()
    engine.destroy()
  })

  it('rolls back target creation when the new edge is invalid', () => {
    const { engine, actions, drag, selectedEdgeId } = fixture()
    drag.candidateAnchor = { side: 'left', offset: 2 }
    expect(() => actions.commitDrag(drag)).toThrow(/anchor offset/)
    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    expect(engine.plugins.history.getState().undoDepth).toBe(0)
    expect(selectedEdgeId.value).toBeNull()
    engine.destroy()
  })

  it('does not hide a failed nested batch from the outer transaction', () => {
    const { engine, actions, drag } = fixture()
    engine.addCommandGuard(({ name }) =>
      name === 'edge:create' ? 'blocked' : true,
    )
    expect(() =>
      engine.batch(() => {
        engine.createNode({ text: 'outer partial' })
        actions.commitDrag(drag)
      }),
    ).toThrow(CommandBlockedError)
    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    expect(engine.plugins.history.getState().undoDepth).toBe(0)
    engine.destroy()
  })

  it('keeps a cancelled empty drop unchanged', () => {
    const { engine, actions, drag, cancel } = fixture()
    cancel()
    actions.commitDrag(drag)
    expect(engine.getState().nodes.size).toBe(1)
    expect(engine.plugins.history.getState().undoDepth).toBe(0)
    expect(engine.plugins.connections.getEdges()).toHaveLength(0)
    engine.destroy()
  })
})
