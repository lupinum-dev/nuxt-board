import {
  asNodeId,
  type BoardSnapshot,
  type BoardEngine,
  type BoardNode,
} from '@lupinum/board-core'
import type { AnchorSide, BoardEdge, EdgeEnd } from '@lupinum/board-connections'

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
  edges?: JsonCanvasEdge[]
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
    edges?: JsonCanvasEdge[]
  }
}

export interface JsonCanvasEdge {
  id: string
  fromNode: string
  toNode: string
  fromSide?: AnchorSide
  toSide?: AnchorSide
  fromEnd?: EdgeEnd
  toEnd?: EdgeEnd
  color?: string
  label?: string
  [key: string]: unknown
}

export type TypeHandler = {
  serialize?: (node: BoardNode) => Record<string, unknown>
  deserialize?: (raw: Record<string, unknown>) => Record<string, unknown>
}

export interface JsonCanvasSerializer {
  registerType(type: string, handler: TypeHandler): void
  export(
    input: BoardSnapshot | BoardEngine,
    extras?: { edges?: JsonCanvasEdge[] | BoardEdge[] },
  ): string
  parse(json: string): JsonCanvasDocument
  toSnapshot(document: JsonCanvasDocument): BoardSnapshot
  hydrateEngine(
    engine: BoardEngine,
    document: JsonCanvasDocument,
    mode?: 'replace' | 'merge',
  ): void
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
      height: node.height,
    }

    if (node.type === 'text') {
      base.text =
        typeof (node.data as { content?: unknown }).content === 'string'
          ? (node.data as { content: string }).content
          : ''
    }

    const handler = typeHandlers.get(node.type)
    const extra = handler?.serialize?.(node) ?? { 'x-canvas:data': node.data }
    return {
      ...base,
      ...extra,
    }
  }

  function deserializeNodeEntry(raw: JsonCanvasNode, index: number): BoardNode {
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
      zIndex: index + 1,
      locked: false,
      visible: true,
    }
  }

  return {
    registerType(type: string, handler: TypeHandler): void {
      typeHandlers.set(type, handler)
    },
    export(
      input: BoardSnapshot | BoardEngine,
      extras?: { edges?: JsonCanvasEdge[] | BoardEdge[] },
    ): string {
      const snapshot =
        typeof (input as BoardEngine).getSnapshot === 'function'
          ? (input as BoardEngine).getSnapshot()
          : (input as BoardSnapshot)
      const engineRef =
        typeof (input as BoardEngine).getSnapshot === 'function'
          ? (input as BoardEngine)
          : null
      const nodes = snapshot.nodes.map((node) => serializeNodeEntry(node))
      const connectionEdges =
        extras?.edges ??
        ((((
          engineRef as
            | (BoardEngine & {
                ext?: {
                  connections?: {
                    getEdges: () => BoardEdge[]
                  }
                }
              })
            | null
        )?.ext?.connections?.getEdges() as BoardEdge[] | undefined) ?? []) as
          | JsonCanvasEdge[]
          | BoardEdge[])
      const serializedEdges = connectionEdges.map((edge) =>
        serializeEdgeEntry(edge),
      )
      return JSON.stringify(
        {
          nodes,
          edges: serializedEdges,
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
                  ...(node.parentId !== undefined
                    ? { parentId: node.parentId }
                    : {}),
                },
              ]),
            ),
            edges: serializedEdges,
          },
        },
        null,
        2,
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
      const nodes = document.nodes.map((node, index) =>
        deserializeNodeEntry(node, index),
      )
      const extensions = document['x-canvas']
      return {
        camera: extensions?.camera ?? { x: 0, y: 0, z: 1 },
        grid: extensions?.grid ?? {
          size: 10,
          majorEvery: 5,
          snap: true,
          edgeSnap: true,
          edgeSnapThreshold: 8,
          pattern: 'line',
        },
        nodes: nodes.map((node) => {
          const meta = extensions?.nodes?.[node.id]
          return {
            ...node,
            zIndex: meta?.zIndex ?? node.zIndex,
            locked: meta?.locked ?? node.locked,
            visible: meta?.visible ?? node.visible,
            parentId: meta?.parentId ? asNodeId(meta.parentId) : node.parentId,
          }
        }),
        selection: [],
        interaction: { mode: 'idle' },
        snapGuides: [],
        nextZIndex:
          extensions?.nextZIndex ??
          nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1,
      }
    },
    hydrateEngine(
      engine: BoardEngine,
      document: JsonCanvasDocument,
      mode: 'replace' | 'merge' = 'replace',
    ): void {
      const snapshot = this.toSnapshot(document)
      engine.importJSON(JSON.stringify(snapshot), mode)

      const connections = (
        engine.ext as BoardEngine['ext'] & {
          connections?: {
            getEdges: () => BoardEdge[]
            deleteEdge: (id: string) => void
            createEdge: (
              input: Omit<BoardEdge, 'zIndex'> & { zIndex?: number },
            ) => BoardEdge
          }
        }
      ).connections

      if (!connections) {
        return
      }

      for (const edge of connections.getEdges()) {
        connections.deleteEdge(String(edge.id))
      }

      const rawEdges = document.edges ?? document['x-canvas']?.edges ?? []
      for (const edge of rawEdges) {
        connections.createEdge(deserializeEdgeEntry(edge))
      }
    },
  }
}

/** Default serializer instance for convenience. */
export const jsonCanvasSerializer: JsonCanvasSerializer =
  createJsonCanvasSerializer()

function serializeEdgeEntry(edge: JsonCanvasEdge | BoardEdge): JsonCanvasEdge {
  if ('fromNode' in edge && 'toNode' in edge) {
    return structuredClone(edge)
  }

  return {
    id: String(edge.id),
    fromNode: String(edge.from),
    toNode: String(edge.to),
    fromSide: edge.fromAnchor?.side,
    toSide: edge.toAnchor?.side,
    fromEnd: edge.fromEnd,
    toEnd: edge.toEnd,
    color: edge.color,
    label: edge.label,
  }
}

function deserializeEdgeEntry(
  edge: JsonCanvasEdge,
): Omit<BoardEdge, 'zIndex'> & { zIndex?: number } {
  return {
    id: edge.id as BoardEdge['id'],
    from: asNodeId(edge.fromNode),
    to: asNodeId(edge.toNode),
    fromAnchor: edge.fromSide
      ? { side: edge.fromSide, offset: 0.5 }
      : undefined,
    toAnchor: edge.toSide ? { side: edge.toSide, offset: 0.5 } : undefined,
    fromEnd: edge.fromEnd,
    toEnd: edge.toEnd,
    color: typeof edge.color === 'string' ? edge.color : undefined,
    label: typeof edge.label === 'string' ? edge.label : undefined,
    data: {},
  }
}
