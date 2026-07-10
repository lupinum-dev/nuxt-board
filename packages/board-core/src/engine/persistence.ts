import { validateState } from '../invariants.js'
import { isBoardColorPreset } from '../colors.js'
import { DEFAULT_CAMERA, DEFAULT_GRID } from '../state/types.js'
import { normalizeExistingNode } from '../state/initial.js'
import type {
  BoardNode,
  InternalBoardSnapshot,
  CanvasColor,
  GridSettings,
  JsonCanvasDocument,
  JsonCanvasEdge,
  JsonCanvasEdgeEnd,
  JsonCanvasNode,
  JsonCanvasNodeType,
  JsonCanvasSide,
  NodeId,
  VueBoardDocumentMetadata,
} from '../types.js'

const JSON_CANVAS_NODE_TYPES = new Set<JsonCanvasNodeType>([
  'text',
  'file',
  'link',
  'group',
])

const JSON_CANVAS_SIDES = new Set<JsonCanvasSide>([
  'top',
  'right',
  'bottom',
  'left',
])

const JSON_CANVAS_EDGE_ENDS = new Set<JsonCanvasEdgeEnd>(['none', 'arrow'])

const JSON_CANVAS_BACKGROUND_STYLES = new Set(['cover', 'ratio', 'repeat'])

function isJsonCanvasNodeType(value: unknown): value is JsonCanvasNodeType {
  return (
    typeof value === 'string' &&
    JSON_CANVAS_NODE_TYPES.has(value as JsonCanvasNodeType)
  )
}

export function normalizeNodeType(value: unknown): JsonCanvasNodeType {
  if (value === undefined) return 'text'
  if (isJsonCanvasNodeType(value)) return value
  throw new Error(`Unsupported JSON Canvas node type "${String(value)}".`)
}

export function withNodeFields<T extends { type: JsonCanvasNodeType }>(
  base: T,
  input: {
    type?: string
    text?: string
    file?: string
    subpath?: string
    url?: string
    label?: string
    background?: string
    backgroundStyle?: string
  },
): T & Partial<BoardNode> {
  switch (base.type) {
    case 'file':
      return {
        ...base,
        file: typeof input.file === 'string' ? input.file : '',
        ...(typeof input.subpath === 'string'
          ? { subpath: input.subpath }
          : {}),
      }
    case 'link':
      return {
        ...base,
        url: typeof input.url === 'string' ? input.url : '',
      }
    case 'group':
      return {
        ...base,
        ...(typeof input.label === 'string' ? { label: input.label } : {}),
        ...(typeof input.background === 'string'
          ? { background: input.background }
          : {}),
        ...(input.backgroundStyle === 'cover' ||
        input.backgroundStyle === 'ratio' ||
        input.backgroundStyle === 'repeat'
          ? { backgroundStyle: input.backgroundStyle }
          : {}),
      }
    case 'text':
    default:
      return {
        ...base,
        text: typeof input.text === 'string' ? input.text : '',
      }
  }
}

function validateJsonCanvasNodeFields(node: JsonCanvasNode): void {
  if (
    node.color !== undefined &&
    !isBoardColorPreset(node.color) &&
    !/^#[0-9a-fA-F]{6}$/.test(node.color)
  ) {
    throw new Error(
      `Invalid board document: node "${node.id}" has invalid color.`,
    )
  }
  if (node.type === 'text' && typeof node.text !== 'string') {
    throw new Error(
      `Invalid board document: text node "${node.id}" is missing required text.`,
    )
  }
  if (node.type === 'file' && typeof node.file !== 'string') {
    throw new Error(
      `Invalid board document: file node "${node.id}" is missing required file.`,
    )
  }
  if (node.type === 'link' && typeof node.url !== 'string') {
    throw new Error(
      `Invalid board document: link node "${node.id}" is missing required url.`,
    )
  }
}

function jsonNodeToBoardNode(
  node: JsonCanvasNode,
  meta:
    | {
        zIndex?: number
        locked?: boolean
        visible?: boolean
        parentId?: string
      }
    | undefined,
  index: number,
): BoardNode {
  validateJsonCanvasNodeFields(node)
  const base = {
    id: node.id as NodeId,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    ...(node.color !== undefined ? { color: node.color } : {}),
    zIndex: Number.isFinite(meta?.zIndex) ? meta!.zIndex! : index + 1,
    locked: Boolean(meta?.locked),
    visible: meta?.visible !== false,
    ...(typeof meta?.parentId === 'string'
      ? { parentId: meta.parentId as NodeId }
      : {}),
  }
  return withNodeFields(base, node) as BoardNode
}

function boardNodeToJsonNode(node: BoardNode): JsonCanvasNode {
  const base = {
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    ...(node.color !== undefined ? { color: node.color as CanvasColor } : {}),
  }
  switch (node.type) {
    case 'file':
      return {
        ...base,
        type: 'file',
        file: node.file ?? '',
        ...(node.subpath !== undefined ? { subpath: node.subpath } : {}),
      }
    case 'link':
      return { ...base, type: 'link', url: node.url ?? '' }
    case 'group':
      return {
        ...base,
        type: 'group',
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.background !== undefined
          ? { background: node.background }
          : {}),
        ...(node.backgroundStyle !== undefined
          ? { backgroundStyle: node.backgroundStyle }
          : {}),
      }
    case 'text':
    default:
      return { ...base, type: 'text', text: node.text ?? '' }
  }
}

function mergeMetadata(
  base: VueBoardDocumentMetadata,
  patch: VueBoardDocumentMetadata | undefined,
): VueBoardDocumentMetadata {
  if (!patch) return base
  return {
    ...base,
    ...patch,
    nodes:
      base.nodes || patch.nodes
        ? { ...(base.nodes ?? {}), ...(patch.nodes ?? {}) }
        : undefined,
    edges:
      base.edges || patch.edges
        ? { ...(base.edges ?? {}), ...(patch.edges ?? {}) }
        : undefined,
  }
}

function getDocumentMetadata(
  document: Partial<JsonCanvasDocument>,
): VueBoardDocumentMetadata | undefined {
  return document['x-vue-board']
}

export function toPersistedDocument(
  snapshot: InternalBoardSnapshot,
  featureDocuments: Partial<JsonCanvasDocument>[],
): JsonCanvasDocument {
  let metadata: VueBoardDocumentMetadata = {
    camera: snapshot.camera,
    grid: snapshot.grid,
    selection: snapshot.selection,
    nextZIndex: snapshot.nextZIndex,
    nodes: Object.fromEntries(
      snapshot.nodes.map((node) => [
        node.id,
        {
          zIndex: node.zIndex,
          locked: node.locked,
          visible: node.visible,
          ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
        },
      ]),
    ),
  }
  let edges: readonly JsonCanvasEdge[] | undefined

  for (const featureDocument of featureDocuments) {
    if (featureDocument.edges !== undefined) {
      edges = featureDocument.edges
    }
    metadata = mergeMetadata(metadata, getDocumentMetadata(featureDocument))
  }

  return {
    nodes: snapshot.nodes.map((node) => boardNodeToJsonNode(node)),
    ...(edges !== undefined ? { edges } : {}),
    'x-vue-board': metadata,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(message)
  }
  return value
}

function assertOptionalFiniteNumber(
  value: unknown,
  message: string,
): asserts value is number | undefined {
  if (value !== undefined && !Number.isFinite(value)) {
    throw new Error(message)
  }
}

function assertOptionalBoolean(
  value: unknown,
  message: string,
): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(message)
  }
}

function validateDocumentMetadata(metadata: unknown): void {
  if (metadata === undefined) return
  const meta = assertRecord(
    metadata,
    'Invalid board document: board metadata must be an object.',
  )

  if (meta.camera !== undefined) {
    const camera = assertRecord(
      meta.camera,
      'Invalid board document: board metadata camera must be an object.',
    )
    for (const key of ['x', 'y', 'z'] as const) {
      assertOptionalFiniteNumber(
        camera[key],
        `Invalid board document: board metadata camera.${key} must be finite.`,
      )
    }
  }

  if (meta.grid !== undefined) {
    const grid = assertRecord(
      meta.grid,
      'Invalid board document: board metadata grid must be an object.',
    )
    for (const key of ['size', 'majorEvery', 'edgeSnapThreshold'] as const) {
      assertOptionalFiniteNumber(
        grid[key],
        `Invalid board document: board metadata grid.${key} must be finite.`,
      )
    }
    assertOptionalBoolean(
      grid.snap,
      'Invalid board document: board metadata grid.snap must be boolean.',
    )
    assertOptionalBoolean(
      grid.edgeSnap,
      'Invalid board document: board metadata grid.edgeSnap must be boolean.',
    )
    if (
      grid.pattern !== undefined &&
      grid.pattern !== 'dot' &&
      grid.pattern !== 'line' &&
      grid.pattern !== 'cross' &&
      grid.pattern !== 'none'
    ) {
      throw new Error(
        `Invalid board document: board metadata grid.pattern "${String(grid.pattern)}" is unsupported.`,
      )
    }
  }

  if (meta.selection !== undefined && !Array.isArray(meta.selection)) {
    throw new Error(
      'Invalid board document: board metadata selection must be an array.',
    )
  }
  assertOptionalFiniteNumber(
    meta.nextZIndex,
    'Invalid board document: board metadata nextZIndex must be finite.',
  )

  if (meta.nodes !== undefined) {
    const nodes = assertRecord(
      meta.nodes,
      'Invalid board document: board metadata nodes must be an object.',
    )
    for (const [id, nodeMeta] of Object.entries(nodes)) {
      const node = assertRecord(
        nodeMeta,
        `Invalid board document: metadata for node "${id}" must be an object.`,
      )
      assertOptionalFiniteNumber(
        node.zIndex,
        `Invalid board document: metadata for node "${id}" has invalid zIndex.`,
      )
      assertOptionalBoolean(
        node.locked,
        `Invalid board document: metadata for node "${id}" has invalid locked flag.`,
      )
      assertOptionalBoolean(
        node.visible,
        `Invalid board document: metadata for node "${id}" has invalid visible flag.`,
      )
      if (node.parentId !== undefined && typeof node.parentId !== 'string') {
        throw new Error(
          `Invalid board document: metadata for node "${id}" has invalid parentId.`,
        )
      }
    }
  }

  if (meta.edges !== undefined) {
    const edges = assertRecord(
      meta.edges,
      'Invalid board document: board metadata edges must be an object.',
    )
    for (const [id, edgeMeta] of Object.entries(edges)) {
      const edge = assertRecord(
        edgeMeta,
        `Invalid board document: metadata for edge "${id}" must be an object.`,
      )
      assertOptionalFiniteNumber(
        edge.zIndex,
        `Invalid board document: metadata for edge "${id}" has invalid zIndex.`,
      )
      if (edge.data !== undefined && !isRecord(edge.data)) {
        throw new Error(
          `Invalid board document: metadata for edge "${id}" has invalid data.`,
        )
      }
    }
  }
}

export function normalizeDocumentForImport(raw: unknown): JsonCanvasDocument {
  const parsed = assertRecord(
    raw,
    'Invalid board document: document must be an object.',
  ) as Partial<JsonCanvasDocument>
  if (!Array.isArray(parsed.nodes)) {
    throw new Error('Invalid board document: missing nodes array.')
  }
  for (const key of [
    'camera',
    'grid',
    'selection',
    'interaction',
    'snapGuides',
    'nextZIndex',
  ] as const) {
    if (key in parsed) {
      throw new Error(
        `Invalid board document: runtime field "${key}" belongs under x-vue-board.`,
      )
    }
  }
  validateDocumentMetadata(getDocumentMetadata(parsed))

  const seenNodes = new Set<string>()
  const nodes = parsed.nodes.map((node) => {
    if (!isRecord(node)) {
      throw new Error('Invalid board document: node entries must be objects.')
    }
    if (
      typeof node.id !== 'string' ||
      typeof node.x !== 'number' ||
      typeof node.y !== 'number' ||
      typeof node.width !== 'number' ||
      typeof node.height !== 'number' ||
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y) ||
      !Number.isFinite(node.width) ||
      !Number.isFinite(node.height) ||
      node.width <= 0 ||
      node.height <= 0
    ) {
      throw new Error(
        `Invalid board document: node "${String(node.id ?? '?')}" has invalid geometry.`,
      )
    }
    if (!isJsonCanvasNodeType(node.type)) {
      throw new Error(
        `Invalid board document: node "${String(node.id)}" has unsupported type "${String(node.type)}".`,
      )
    }
    if (
      node.type === 'group' &&
      node.backgroundStyle !== undefined &&
      !JSON_CANVAS_BACKGROUND_STYLES.has(String(node.backgroundStyle))
    ) {
      throw new Error(
        `Invalid board document: node "${String(node.id)}" has unsupported backgroundStyle "${String(node.backgroundStyle)}".`,
      )
    }
    const normalized = { ...node } as unknown as JsonCanvasNode
    validateJsonCanvasNodeFields(normalized)
    if (seenNodes.has(normalized.id)) {
      throw new Error(
        `Invalid board document: duplicate node id "${normalized.id}".`,
      )
    }
    seenNodes.add(normalized.id)
    return normalized
  })

  let edges: readonly JsonCanvasEdge[] | undefined
  if (parsed.edges !== undefined) {
    if (!Array.isArray(parsed.edges)) {
      throw new Error('Invalid board document: edges must be an array.')
    }
    const seenEdges = new Set<string>()
    edges = parsed.edges.map((edge) => {
      if (!isRecord(edge)) {
        throw new Error('Invalid board document: edge entries must be objects.')
      }
      if (
        typeof edge.id !== 'string' ||
        typeof edge.fromNode !== 'string' ||
        typeof edge.toNode !== 'string'
      ) {
        throw new Error(
          `Invalid board document: edge "${String(edge.id ?? '?')}" has invalid endpoints.`,
        )
      }
      const id = edge.id
      const fromNode = edge.fromNode
      const toNode = edge.toNode
      if (seenEdges.has(id)) {
        throw new Error(`Invalid board document: duplicate edge id "${id}".`)
      }
      seenEdges.add(id)
      if (!seenNodes.has(fromNode) || !seenNodes.has(toNode)) {
        throw new Error(
          `Invalid board document: edge "${id}" references a missing node.`,
        )
      }
      if (
        edge.fromSide !== undefined &&
        !JSON_CANVAS_SIDES.has(edge.fromSide as JsonCanvasSide)
      ) {
        throw new Error(
          `Invalid board document: edge "${id}" has unsupported fromSide "${String(edge.fromSide)}".`,
        )
      }
      if (
        edge.toSide !== undefined &&
        !JSON_CANVAS_SIDES.has(edge.toSide as JsonCanvasSide)
      ) {
        throw new Error(
          `Invalid board document: edge "${id}" has unsupported toSide "${String(edge.toSide)}".`,
        )
      }
      if (
        edge.fromEnd !== undefined &&
        !JSON_CANVAS_EDGE_ENDS.has(edge.fromEnd as JsonCanvasEdgeEnd)
      ) {
        throw new Error(
          `Invalid board document: edge "${id}" has unsupported fromEnd "${String(edge.fromEnd)}".`,
        )
      }
      if (
        edge.toEnd !== undefined &&
        !JSON_CANVAS_EDGE_ENDS.has(edge.toEnd as JsonCanvasEdgeEnd)
      ) {
        throw new Error(
          `Invalid board document: edge "${id}" has unsupported toEnd "${String(edge.toEnd)}".`,
        )
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        throw new Error(
          `Invalid board document: edge "${id}" has invalid label.`,
        )
      }
      return { ...edge, id, fromNode, toNode } as JsonCanvasEdge
    })
  }

  return {
    nodes,
    ...(edges !== undefined ? { edges } : {}),
    ...(getDocumentMetadata(parsed) !== undefined
      ? { 'x-vue-board': getDocumentMetadata(parsed) }
      : {}),
  }
}

export function materializeSnapshotNodes(
  snapshot: InternalBoardSnapshot,
): BoardNode[] {
  return [...snapshot.nodes]
}

export function documentToSnapshot(
  document: JsonCanvasDocument,
): InternalBoardSnapshot {
  const metadata = getDocumentMetadata(document)
  const nodes = document.nodes.map((node, index) =>
    normalizeExistingNode(
      jsonNodeToBoardNode(node, metadata?.nodes?.[node.id], index),
    ),
  )
  const gridSettings: GridSettings = {
    ...DEFAULT_GRID,
    ...(metadata?.grid ?? {}),
  }
  const selection = Array.isArray(metadata?.selection)
    ? metadata.selection
        .filter(
          (id): id is string =>
            typeof id === 'string' && nodes.some((node) => node.id === id),
        )
        .map((id) => id as NodeId)
    : []
  const nextZIndex =
    metadata?.nextZIndex ??
    nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1
  const camera = { ...DEFAULT_CAMERA, ...(metadata?.camera ?? {}) }

  const snapshot: InternalBoardSnapshot = {
    camera,
    grid: gridSettings,
    nodes,
    selection,
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex,
  }

  const failures = validateState(
    {
      camera,
      grid: gridSettings,
      nodes: new Map(nodes.map((node) => [node.id, node])),
      selection: new Set(selection),
      interaction: { mode: 'idle' },
      snapGuides: [],
    },
    gridSettings,
    'loadDocument',
  )
  if (failures.length > 0) {
    throw new Error(
      `Invalid board document: ${failures[0]?.message ?? 'invariant failed.'}`,
    )
  }

  return snapshot
}
