import { describe, expect, it } from 'vitest'
import { CommandBlockedError, createBoardEngine } from '@lupinum/board-core'
import { historyPlugin } from '@lupinum/board-history'
import { connectionsPlugin } from '@lupinum/board-connections'
import { wrapSelectionInGroup } from '../packages/nuxt-board/playground/lib/demo'

function fixture(selected = true) {
  const engine = createBoardEngine({
    plugins: [historyPlugin(), connectionsPlugin()],
  })
  const first = engine.createNode({ text: 'first', x: 0, y: 0 })
  const second = engine.createNode({ text: 'second', x: 300, y: 200 })
  engine.select(selected ? [first.id, second.id] : [])
  engine.plugins.history.clear()
  return { engine, first, second }
}

describe('playground grouping history', () => {
  it.each([true, false])(
    'treats grouping with selection=%s as one undoable action',
    (selected) => {
      const { engine, first, second } = fixture(selected)
      const before = engine.exportDocument()
      const selection = engine.getSelection()
      expect(wrapSelectionInGroup(engine)).toBe(
        selected ? 'grouped' : 'created',
      )
      expect(engine.getState().nodes.size).toBe(3)
      if (selected) {
        expect(engine.getNode(first.id).parentId).toBe(
          engine.getNode(second.id).parentId,
        )
        expect(engine.getNode(first.id).parentId).toBeTruthy()
      }
      const after = engine.exportDocument()
      expect(engine.plugins.history.getState().undoDepth).toBe(1)
      engine.plugins.history.undo()
      expect(engine.exportDocument()).toEqual(before)
      expect(engine.getSelection()).toEqual(selection)
      engine.plugins.history.redo()
      expect(engine.exportDocument()).toEqual(after)
      engine.destroy()
    },
  )

  it('rolls back the group and first child when a later child update is rejected', () => {
    const { engine, second } = fixture()
    const before = engine.exportDocument()
    const selection = engine.getSelection()
    engine.addCommandGuard(({ name, args }) =>
      name === 'updateNode' && args[0] === second.id ? 'blocked child' : true,
    )
    expect(() => wrapSelectionInGroup(engine)).toThrow(CommandBlockedError)
    expect(engine.exportDocument()).toEqual(before)
    expect(engine.getSelection()).toEqual(selection)
    expect(engine.plugins.history.getState().undoDepth).toBe(0)
    engine.destroy()
  })
})
