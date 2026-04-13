import { asNodeId, type BoardSnapshot, type BoardEngine, type BoardNode } from '@lupinum/board-core'

export interface JsonCanvasNode {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  [key: string]: unknown
}

export interface JsonCanvasDocument {
  nodes: JsonCanvasNode[]
  edges?: Array<Record<string, unknown>>
  'x-canvas'?: {
    camera?: BoardSnapshot['camera']
    grid?: BoardSnapshot['grid']
    nextZIndex?: number
    nodes?: Record<
      string,
      {
        zIndex?: number
        locked?: boolean
        visible?: boolean
        parentId?: string
      }
    >
    edges?: Array<Record<string, unknown>>
  }
}

export type TypeHandler = {
  serialize?: (node: BoardNode) => Record<string, unknown>
  deserialize?: (raw: Record<string, unknown>) => Record<string, unknown>
}

export interface JsonCanvasSerializer {
  registerType(type: string, handler: TypeHandler): void
  export(
    input: BoardSnapshot | BoardEngine,
    extras?: { edges?: Array<Record<string, unknown>> }
  ): string
  parse(json: string): JsonCanvasDocument
  toSnapshot(document: JsonCanvasDocument): BoardSnapshot
}

export function createJsonCanvasSerializer(): JsonCanvasSerializer {
  const typeHandlers = new Map<string, TypeHandler>()

  function serializeNodeEntry(node: BoardNode): JsonCanvasNode {
    const base: JsonCanvasNode = {
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    }

    if (node.type === 'text') {
      base.text = typeof (node.data as { content?: unknown }).content === 'string'
        ? ((node.data as { content: string }).content)
        : ''
    }

    const handler = typeHandlers.get(node.type)
    const extra = handler?.serialize?.(node) ?? { 'x-canvas:data': node.data }
    return {
      ...base,
      ...extra
    }
  }

  function deserializeNodeEntry(raw: JsonCanvasNode): BoardNode {
    const handler = typeHandlers.get(raw.type)
    const data =
      handler?.deserialize?.(raw) ??
      (raw.type === 'text'
        ? { content: typeof raw.text === 'string' ? raw.text : '' }
        : ((raw['x-canvas:data'] as Record<string, unknown> | undefined) ?? {}))

    return {
      id: asNodeId(raw.id),
      type: raw.type,
      x: raw.x,
      y: raw.y,
      width: raw.width,
      height: raw.height,
      data,
      zIndex: 1,
      locked: false,
      visible: true
    }
  }

  return {
    registerType(type: string, handler: TypeHandler): void {
      typeHandlers.set(type, handler)
    },
    export(
      input: BoardSnapshot | BoardEngine,
      extras?: { edges?: Array<Record<string, unknown>> }
    ): string {
      const snapshot = typeof (input as BoardEngine).getSnapshot === 'function'
        ? (input as BoardEngine).getSnapshot()
        : (input as BoardSnapshot)
      const engineRef = typeof (input as BoardEngine).getSnapshot === 'function'
        ? (input as BoardEngine)
        : null
      const nodes = snapshot.nodes.map((node) => serializeNodeEntry(node))
      const connectionEdges =
        extras?.edges ??
        (((engineRef as BoardEngine & {
          ext?: {
            connections?: {
              getEdges: () => Array<Record<string, unknown>>
            }
          }
        } | null)?.ext?.connections?.getEdges() as
          Array<Record<string, unknown>> | undefined) ??
          [])
      return JSON.stringify(
        {
          nodes,
          edges: connectionEdges,
          'x-canvas': {
            camera: snapshot.camera,
            grid: snapshot.grid,
            nextZIndex: snapshot.nextZIndex,
            nodes: Object.fromEntries(
              snapshot.nodes.map((node) => [
                node.id,
                {
                  zIndex: node.zIndex,
                  locked: node.locked,
                  visible: node.visible,
                  ...(node.parentId !== undefined ? { parentId: node.parentId } : {})
                }
              ])
            ),
            edges: connectionEdges
          }
        },
        null,
        2
      )
    },
    parse(json: string): JsonCanvasDocument {
      const parsed = JSON.parse(json)
      if (!parsed || !Array.isArray(parsed.nodes)) {
        throw new Error('Invalid JSON Canvas document: missing nodes array.')
      }
      return parsed as JsonCanvasDocument
    },
    toSnapshot(document: JsonCanvasDocument): BoardSnapshot {
      const nodes = document.nodes.map((node) => deserializeNodeEntry(node))
      const extensions = document['x-canvas']
      return {
        camera: extensions?.camera ?? { x: 0, y: 0, z: 1 },
        grid: extensions?.grid ?? { size: 10, majorEvery: 5, snap: true, pattern: 'line' },
        nodes: nodes.map((node) => {
          const meta = extensions?.nodes?.[node.id]
          return {
            ...node,
            zIndex: meta?.zIndex ?? node.zIndex,
            locked: meta?.locked ?? node.locked,
            visible: meta?.visible ?? node.visible,
            parentId: meta?.parentId ? asNodeId(meta.parentId) : node.parentId
          }
        }),
        selection: [],
        interaction: { mode: 'idle' },
        snapGuides: [],
        nextZIndex:
          extensions?.nextZIndex ??
          nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1
      }
    }
  }
}

/** Default serializer instance for convenience. */
export const jsonCanvasSerializer: JsonCanvasSerializer = createJsonCanvasSerializer()
