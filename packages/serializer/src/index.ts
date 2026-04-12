import type { BoardSnapshot, CanvasNode } from '@canvas/core'

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
}

type TypeHandler = {
  serialize?: (node: CanvasNode) => Record<string, unknown>
  deserialize?: (raw: Record<string, unknown>) => Record<string, unknown>
}

const typeHandlers = new Map<string, TypeHandler>()

export const jsonCanvasSerializer = {
  registerType(type: string, handler: TypeHandler): void {
    typeHandlers.set(type, handler)
  },
  export(snapshot: BoardSnapshot, extras?: { edges?: Array<Record<string, unknown>> }): string {
    const nodes = snapshot.nodes.map((node) => serializeNode(node))
    return JSON.stringify(
      {
        nodes,
        edges: extras?.edges ?? []
      },
      null,
      2
    )
  },
  parse(json: string): JsonCanvasDocument {
    return JSON.parse(json) as JsonCanvasDocument
  },
  toSnapshot(document: JsonCanvasDocument): BoardSnapshot {
    const nodes = document.nodes.map((node) => deserializeNode(node))
    return {
      camera: { x: 0, y: 0, z: 1 },
      grid: { size: 10, majorEvery: 5, snap: true, pattern: 'line' },
      nodes,
      selection: [],
      interaction: { mode: 'idle' },
      nextZIndex: nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1
    }
  }
}

function serializeNode(node: CanvasNode): JsonCanvasNode {
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

function deserializeNode(raw: JsonCanvasNode): CanvasNode {
  const handler = typeHandlers.get(raw.type)
  const data =
    handler?.deserialize?.(raw) ??
    (raw.type === 'text'
      ? { content: typeof raw.text === 'string' ? raw.text : '' }
      : ((raw['x-canvas:data'] as Record<string, unknown> | undefined) ?? {}))

  return {
    id: raw.id,
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

