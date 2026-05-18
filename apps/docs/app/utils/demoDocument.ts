import type {
  BoardNode,
  Camera,
  GridSettings,
  JsonCanvasDocument,
  JsonCanvasNode,
  NodeId,
  VueBoardNodeMetadata,
} from '@lupinum/board-core'

type DemoNode = Omit<
  Pick<
    BoardNode,
    | 'id'
    | 'type'
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'color'
    | 'text'
    | 'file'
    | 'subpath'
    | 'url'
    | 'label'
    | 'background'
    | 'backgroundStyle'
    | 'zIndex'
    | 'locked'
    | 'visible'
    | 'parentId'
  >,
  'id' | 'parentId'
> & {
  id: NodeId | string
  parentId?: NodeId | string
}

export interface DemoDocumentInput {
  nodes: readonly DemoNode[]
  camera?: Camera
  grid?: GridSettings
  selection?: readonly (NodeId | string)[]
  nextZIndex?: number
}

function toJsonCanvasNode(node: DemoNode): JsonCanvasNode {
  const base = {
    id: node.id as NodeId,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    ...(node.color ? { color: node.color } : {}),
  }

  switch (node.type) {
    case 'file':
      return {
        ...base,
        type: 'file',
        file: node.file ?? '',
        ...(node.subpath ? { subpath: node.subpath } : {}),
      }
    case 'link':
      return {
        ...base,
        type: 'link',
        url: node.url ?? '',
      }
    case 'group':
      return {
        ...base,
        type: 'group',
        ...((node.label ?? node.text)
          ? { label: node.label ?? node.text }
          : {}),
        ...(node.background ? { background: node.background } : {}),
        ...(node.backgroundStyle
          ? { backgroundStyle: node.backgroundStyle }
          : {}),
      }
    case 'text':
    default:
      return {
        ...base,
        type: 'text',
        text: node.text ?? '',
      }
  }
}

function toNodeMetadata(node: DemoNode): VueBoardNodeMetadata {
  return {
    zIndex: node.zIndex,
    locked: node.locked,
    visible: node.visible,
    ...(node.parentId ? { parentId: node.parentId as NodeId } : {}),
  }
}

export function createDemoDocument(
  input: DemoDocumentInput,
): JsonCanvasDocument {
  return {
    nodes: input.nodes.map(toJsonCanvasNode),
    'x-vue-board': {
      ...(input.camera ? { camera: input.camera } : {}),
      ...(input.grid ? { grid: input.grid } : {}),
      ...(input.selection
        ? { selection: input.selection.map((id) => id as NodeId) }
        : {}),
      nextZIndex:
        input.nextZIndex ??
        input.nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1,
      nodes: Object.fromEntries(
        input.nodes.map((node) => [node.id, toNodeMetadata(node)]),
      ),
    },
  }
}
