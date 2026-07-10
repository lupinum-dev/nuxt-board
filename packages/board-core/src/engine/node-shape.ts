import { BoardConflictError, BoardInputError } from '../errors.js'
import { createNodeId } from '../helpers/ids.js'
import { snapPoint, snapSize, snapValue } from '../math.js'
import type {
  BoardNode,
  GridSettings,
  NodeConstraints,
  NodeId,
  NodeInput,
  NodePatch,
} from '../types.js'
import { normalizeNodeType, withNodeFields } from './persistence.js'

interface NodeShapeContext {
  nodes: ReadonlyMap<NodeId, BoardNode>
  grid: GridSettings
  constraints: NodeConstraints
}

export function assertValidNodeGeometry(
  id: NodeId,
  geometry: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>,
): void {
  if (
    !Number.isFinite(geometry.x) ||
    !Number.isFinite(geometry.y) ||
    !Number.isFinite(geometry.width) ||
    !Number.isFinite(geometry.height) ||
    geometry.width <= 0 ||
    geometry.height <= 0
  ) {
    throw new BoardInputError(`Invalid node geometry for "${id}".`)
  }
}

export function assertValidParentLink(
  nodes: ReadonlyMap<NodeId, BoardNode>,
  id: NodeId,
  parentId: NodeId | undefined,
): void {
  if (parentId === undefined) return
  if (parentId === id) {
    throw new BoardInputError(`Node "${id}" cannot be its own parent.`)
  }
  const parent = nodes.get(parentId)
  if (!parent) {
    throw new BoardInputError(
      `Node "${id}" references missing parent "${parentId}".`,
    )
  }
  if (parent.type !== 'group') {
    throw new BoardInputError(
      `Node "${id}" parent "${parentId}" must be a group.`,
    )
  }
  let walk: BoardNode | undefined = parent
  const seen = new Set<NodeId>()
  while (walk) {
    if (walk.id === id || seen.has(walk.id)) {
      throw new BoardInputError(`Node "${id}" cannot create a parent cycle.`)
    }
    seen.add(walk.id)
    walk = walk.parentId ? nodes.get(walk.parentId) : undefined
  }
}

export function normalizeNodeInput(
  input: NodeInput,
  context: NodeShapeContext & { nextZIndex: number },
): { node: BoardNode; nextZIndex: number } {
  const { nodes, grid, constraints } = context
  const rawPoint = { x: input.x ?? 0, y: input.y ?? 0 }
  const point = grid.snap ? snapPoint(rawPoint, grid.size) : rawPoint
  const width = grid.snap
    ? snapSize(
        input.width ?? constraints.defaultWidth,
        grid.size,
        constraints.minWidth,
      )
    : (input.width ?? constraints.defaultWidth)
  const height = grid.snap
    ? snapSize(
        input.height ?? constraints.defaultHeight,
        grid.size,
        constraints.minHeight,
      )
    : (input.height ?? constraints.defaultHeight)
  const type = normalizeNodeType(input.type)
  const parentId =
    typeof input.parentId === 'string' && input.parentId.length > 0
      ? input.parentId
      : undefined
  const id = input.id ?? createNodeId()
  if (nodes.has(id)) {
    throw new BoardConflictError(
      `Cannot create node: node "${id}" already exists.`,
    )
  }
  assertValidNodeGeometry(id, { x: point.x, y: point.y, width, height })
  assertValidParentLink(nodes, id, parentId)

  return {
    node: withNodeFields(
      {
        id,
        type,
        x: point.x,
        y: point.y,
        width,
        height,
        color: input.color,
        zIndex: context.nextZIndex,
        locked: Boolean(input.locked),
        visible: input.visible !== false,
        parentId,
      },
      input,
    ),
    nextZIndex: context.nextZIndex + 1,
  }
}

export function applyNodePatchToNode(
  node: BoardNode,
  patch: NodePatch,
  context: NodeShapeContext,
): BoardNode {
  const invalidFields =
    node.type === 'text'
      ? ['file', 'subpath', 'url', 'label', 'background', 'backgroundStyle']
      : node.type === 'file'
        ? ['text', 'url', 'label', 'background', 'backgroundStyle']
        : node.type === 'link'
          ? [
              'text',
              'file',
              'subpath',
              'label',
              'background',
              'backgroundStyle',
            ]
          : ['text', 'file', 'subpath', 'url']
  const invalidField = invalidFields.find((field) => field in patch)
  if (invalidField) {
    throw new BoardInputError(
      `Cannot update ${node.type} node "${node.id}" with field "${invalidField}".`,
    )
  }
  const nextCommon = {
    x: patch.x ?? node.x,
    y: patch.y ?? node.y,
    width: patch.width ?? node.width,
    height: patch.height ?? node.height,
    parentId: 'parentId' in patch ? patch.parentId : node.parentId,
    color: 'color' in patch ? patch.color : node.color,
    locked: patch.locked ?? node.locked,
    visible: patch.visible ?? node.visible,
  }
  const { grid, constraints, nodes } = context
  const x = grid.snap ? snapValue(nextCommon.x, grid.size) : nextCommon.x
  const y = grid.snap ? snapValue(nextCommon.y, grid.size) : nextCommon.y
  const width = grid.snap
    ? snapSize(nextCommon.width, grid.size, constraints.minWidth)
    : nextCommon.width
  const height = grid.snap
    ? snapSize(nextCommon.height, grid.size, constraints.minHeight)
    : nextCommon.height
  assertValidNodeGeometry(node.id, { x, y, width, height })
  assertValidParentLink(nodes, node.id, nextCommon.parentId)

  const common = {
    id: node.id,
    x,
    y,
    width,
    height,
    color: nextCommon.color,
    zIndex: node.zIndex,
    locked: nextCommon.locked,
    visible: nextCommon.visible,
    parentId: nextCommon.parentId,
  }
  switch (node.type) {
    case 'text':
      return { ...common, type: 'text', text: patch.text ?? node.text }
    case 'file':
      return {
        ...common,
        type: 'file',
        file: patch.file ?? node.file,
        subpath: 'subpath' in patch ? patch.subpath : node.subpath,
      }
    case 'link':
      return { ...common, type: 'link', url: patch.url ?? node.url }
    case 'group':
      return {
        ...common,
        type: 'group',
        label: 'label' in patch ? patch.label : node.label,
        background: 'background' in patch ? patch.background : node.background,
        backgroundStyle:
          'backgroundStyle' in patch
            ? patch.backgroundStyle
            : node.backgroundStyle,
      }
  }
}
