import type { Ref } from 'vue'
import {
  asNodeId,
  type BoardEngine,
  type BoardNode,
  type Point,
} from '@lupinum/board-core'
import {
  findBoardNodeId,
  isBoardInteractiveEventTarget,
  isEventOwnedByBoardRoot,
} from '../eventTargets.js'

/** Information emitted when the user opens a board context menu. */
export interface BoardContextMenuInfo {
  event: MouseEvent
  node: BoardNode | null
  world: Point
  screen: Point
}

interface UseBoardContextMenuOptions {
  engine: BoardEngine
  rootElement: Ref<HTMLElement | null>
  toLocalPoint: (clientX: number, clientY: number) => Point
  onContextMenu: (info: BoardContextMenuInfo) => void
}

/** Emit board context without taking ownership of the native browser menu. */
export function useBoardContextMenu(options: UseBoardContextMenuOptions) {
  const { engine, rootElement, toLocalPoint } = options

  function onContextMenu(event: MouseEvent): void {
    if (!isEventOwnedByBoardRoot(event.target, rootElement.value)) return
    if (isBoardInteractiveEventTarget(event.target)) return

    const screen = toLocalPoint(event.clientX, event.clientY)
    const world = engine.screenToWorld(screen)
    const nodeId = findBoardNodeId(event.target) ?? engine.getNodeAt(world)?.id
    options.onContextMenu({
      event,
      node: nodeId ? engine.findNode(asNodeId(nodeId)) : null,
      world,
      screen,
    })
  }

  return { onContextMenu }
}
