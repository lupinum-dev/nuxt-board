import {
  asEdgeId,
  asNodeId,
  createBoardEngine,
  type JsonCanvasDocument,
  type JsonCanvasEdge,
  type BoardSnapshot,
  type BoardEngine,
  type BoardNode,
  type GridSettings,
  type GridPattern,
  type Point,
} from '@lupinum/board-core'
import { connectionPlugin } from '../../../board-connections/src/index'
import { historyPlugin } from '../../../board-history/src/index'

export type DemoSceneId = 'workflow' | 'systems' | 'dense' | 'polish'

export interface DemoSceneOption {
  id: DemoSceneId
  label: string
  summary: string
}

interface DemoScene {
  id: DemoSceneId
  label: string
  summary: string
  snapshot: BoardSnapshot
  edges: JsonCanvasEdge[]
}

type DemoNode = BoardNode

const DEFAULT_GRID: GridSettings = {
  size: 24,
  majorEvery: 4,
  snap: true,
  edgeSnap: true,
  edgeSnapThreshold: 8,
  pattern: 'line' as GridPattern,
}

export const DEMO_SCENES: DemoSceneOption[] = [
  {
    id: 'workflow',
    label: 'Workflow Board',
    summary:
      'A product-delivery board with groups, notes, and handoff connections.',
  },
  {
    id: 'systems',
    label: 'System Map',
    summary:
      'A service topology showing ownership, queues, and deployment flow.',
  },
  {
    id: 'dense',
    label: 'Dense Dataset',
    summary: 'A larger seeded board for zoom, culling, and interaction stress.',
  },
  {
    id: 'polish',
    label: 'Polish Pass',
    summary:
      'A staggered board for edge creation, reconnects, duplication, and zoom polish.',
  },
]

function textNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  content: string,
  zIndex: number,
  parentId?: string,
): DemoNode {
  return {
    id: asNodeId(id),
    type: 'text',
    x,
    y,
    width,
    height,
    text: content,
    zIndex,
    locked: false,
    visible: true,
    ...(parentId ? { parentId: asNodeId(parentId) } : {}),
  }
}

function imageNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  alt: string,
  zIndex: number,
  parentId?: string,
): DemoNode {
  return {
    id: asNodeId(id),
    type: 'file',
    x,
    y,
    width,
    height,
    file: alt,
    zIndex,
    locked: false,
    visible: true,
    ...(parentId ? { parentId: asNodeId(parentId) } : {}),
  }
}

function groupNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  color: DemoNode['color'],
  zIndex: number,
): DemoNode {
  return {
    id: asNodeId(id),
    type: 'group',
    x,
    y,
    width,
    height,
    color,
    label: title,
    zIndex,
    locked: false,
    visible: true,
  }
}

function connection(
  id: string,
  from: string,
  to: string,
  label: string,
): JsonCanvasEdge {
  return {
    id: asEdgeId(id),
    fromNode: asNodeId(from),
    toNode: asNodeId(to),
    toEnd: 'arrow',
    label,
  }
}

function snapshotFrom(
  nodes: DemoNode[],
  camera: Point & { z: number },
  grid = DEFAULT_GRID,
): BoardSnapshot {
  return {
    camera,
    grid,
    nodes,
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1,
  }
}

function demoSceneToDocument(scene: DemoScene): JsonCanvasDocument {
  return {
    nodes: scene.snapshot.nodes.map((node) => {
      const base = {
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        ...(node.color ? { color: node.color } : {}),
      }
      if (node.type === 'group') {
        return {
          ...base,
          type: 'group',
          label: node.label ?? '',
        }
      }
      if (node.type === 'file') {
        return {
          ...base,
          type: 'file',
          file: node.file ?? '',
        }
      }
      return {
        ...base,
        type: 'text',
        text: node.text ?? '',
      }
    }),
    edges: scene.edges,
    'x-vue-board': {
      camera: scene.snapshot.camera,
      grid: scene.snapshot.grid,
      selection: [],
      nextZIndex: scene.snapshot.nextZIndex,
      nodes: Object.fromEntries(
        scene.snapshot.nodes.map((node) => [
          node.id,
          {
            zIndex: node.zIndex,
            locked: node.locked,
            visible: node.visible,
            ...(node.parentId ? { parentId: node.parentId } : {}),
          },
        ]),
      ),
    },
  }
}

function createWorkflowScene(): DemoScene {
  const nodes: DemoNode[] = [
    groupNode('workflow-intake', 48, 56, 340, 320, 'Discovery', '1', 1),
    groupNode('workflow-build', 430, 36, 430, 360, 'Delivery', '4', 2),
    groupNode('workflow-launch', 910, 76, 300, 280, 'Launch', '5', 3),
    textNode(
      'brief',
      88,
      108,
      220,
      100,
      'Clarify scope\nStakeholders + risks',
      10,
      'workflow-intake',
    ),
    textNode(
      'research',
      104,
      232,
      200,
      88,
      'User interviews\nThree blockers',
      11,
      'workflow-intake',
    ),
    imageNode(
      'moodboard',
      242,
      118,
      120,
      162,
      'Visual direction',
      12,
      'workflow-intake',
    ),
    textNode(
      'prototype',
      478,
      96,
      190,
      100,
      'Prototype critical flow',
      20,
      'workflow-build',
    ),
    textNode(
      'spec',
      700,
      88,
      120,
      86,
      'API + schema lock',
      21,
      'workflow-build',
    ),
    textNode(
      'qa',
      490,
      240,
      160,
      88,
      'QA matrix\nEdge cases',
      22,
      'workflow-build',
    ),
    textNode(
      'release',
      692,
      220,
      130,
      92,
      'Release train\nCanary',
      23,
      'workflow-build',
    ),
    textNode(
      'notes',
      950,
      122,
      214,
      88,
      'Customer notes\nRollout plan',
      30,
      'workflow-launch',
    ),
    textNode(
      'metrics',
      968,
      242,
      188,
      84,
      'Watch activation\n+ latency',
      31,
      'workflow-launch',
    ),
  ]

  const edges = [
    connection('workflow-1', 'brief', 'prototype', 'handoff'),
    connection('workflow-2', 'research', 'qa', 'findings'),
    connection('workflow-3', 'prototype', 'release', 'ready'),
    connection('workflow-4', 'spec', 'release', 'schema'),
    connection('workflow-5', 'release', 'notes', 'announce'),
    connection('workflow-6', 'qa', 'metrics', 'watch'),
  ]

  return {
    id: 'workflow',
    label: 'Workflow Board',
    summary:
      'A product-delivery board with groups, notes, and handoff connections.',
    snapshot: snapshotFrom(nodes, { x: 24, y: 28, z: 0.78 }),
    edges,
  }
}

function createSystemsScene(): DemoScene {
  const nodes: DemoNode[] = [
    groupNode('sys-web', 80, 100, 270, 270, 'Surface', '6', 1),
    groupNode('sys-platform', 410, 56, 420, 360, 'Platform', '4', 2),
    groupNode('sys-ops', 876, 92, 330, 304, 'Ops', '2', 3),
    textNode(
      'landing',
      116,
      140,
      182,
      82,
      'Nuxt app\nSSR + hydration',
      10,
      'sys-web',
    ),
    textNode(
      'editor',
      142,
      246,
      164,
      86,
      'Canvas editor\nClient events',
      11,
      'sys-web',
    ),
    textNode('api', 458, 108, 156, 82, 'API gateway', 20, 'sys-platform'),
    textNode('queue', 656, 112, 124, 82, 'Queue', 21, 'sys-platform'),
    textNode(
      'worker',
      470,
      244,
      172,
      90,
      'Render worker\nSnapshots + export',
      22,
      'sys-platform',
    ),
    textNode('store', 676, 246, 120, 88, 'Blob store', 23, 'sys-platform'),
    textNode(
      'alerts',
      920,
      142,
      198,
      88,
      'Observability\nAlerts + traces',
      30,
      'sys-ops',
    ),
    textNode('deploy', 956, 260, 164, 76, 'Canary deploy', 31, 'sys-ops'),
    imageNode('ops-board', 1038, 168, 120, 128, 'Runbook board', 32, 'sys-ops'),
  ]

  const edges = [
    connection('systems-1', 'landing', 'api', 'request'),
    connection('systems-2', 'editor', 'api', 'mutate'),
    connection('systems-3', 'api', 'queue', 'enqueue'),
    connection('systems-4', 'queue', 'worker', 'pull'),
    connection('systems-5', 'worker', 'store', 'persist'),
    connection('systems-6', 'worker', 'alerts', 'trace'),
    connection('systems-7', 'store', 'deploy', 'artifact'),
  ]

  return {
    id: 'systems',
    label: 'System Map',
    summary:
      'A service topology showing ownership, queues, and deployment flow.',
    snapshot: snapshotFrom(
      nodes,
      { x: 34, y: 42, z: 0.82 },
      { ...DEFAULT_GRID, pattern: 'dot' },
    ),
    edges,
  }
}

function createDenseScene(): DemoScene {
  const nodes: DemoNode[] = []
  const edges: JsonCanvasEdge[] = []
  const laneIds = ['dense-plan', 'dense-build', 'dense-ship']
  const laneTitles = ['Plan', 'Build', 'Ship']
  const laneAccents = ['1', '4', '5'] as const

  for (let lane = 0; lane < laneIds.length; lane += 1) {
    nodes.push(
      groupNode(
        laneIds[lane]!,
        84 + lane * 420,
        60,
        360,
        760,
        laneTitles[lane]!,
        laneAccents[lane]!,
        lane + 1,
      ),
    )
  }

  let zIndex = 10
  for (let lane = 0; lane < laneIds.length; lane += 1) {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const id = `dense-${lane}-${row}-${col}`
        nodes.push(
          textNode(
            id,
            120 + lane * 420 + col * 154,
            118 + row * 82,
            132,
            62,
            `Cell ${lane + 1}.${row * 2 + col + 1}\nQueued`,
            zIndex,
            laneIds[lane],
          ),
        )
        zIndex += 1
      }
    }
  }

  for (let lane = 0; lane < laneIds.length; lane += 1) {
    for (let row = 0; row < 7; row += 1) {
      const source = `dense-${lane}-${row}-0`
      const target = `dense-${lane}-${row + 1}-1`
      edges.push(
        connection(`dense-lane-${lane}-${row}`, source, target, 'flow'),
      )
    }
  }

  for (let row = 0; row < 6; row += 1) {
    edges.push(
      connection(
        `dense-cross-a-${row}`,
        `dense-0-${row}-1`,
        `dense-1-${row + 1}-0`,
        'handoff',
      ),
    )
    edges.push(
      connection(
        `dense-cross-b-${row}`,
        `dense-1-${row}-1`,
        `dense-2-${row + 1}-0`,
        'handoff',
      ),
    )
  }

  return {
    id: 'dense',
    label: 'Dense Dataset',
    summary: 'A larger seeded board for zoom, culling, and interaction stress.',
    snapshot: snapshotFrom(
      nodes,
      { x: 20, y: 14, z: 0.6 },
      { ...DEFAULT_GRID, size: 20, majorEvery: 5 },
    ),
    edges,
  }
}

function createPolishScene(): DemoScene {
  const nodes: DemoNode[] = [
    groupNode('polish-flow', 56, 52, 1120, 520, 'Canvas Polish', '4', 1),
    textNode(
      'polish-brief',
      104,
      120,
      230,
      112,
      'Brief\nNeed calmer chrome\n+ cleaner edge cadence',
      10,
      'polish-flow',
    ),
    textNode(
      'polish-parse',
      438,
      86,
      244,
      124,
      'Parse input\nPreserve structure',
      11,
      'polish-flow',
    ),
    textNode(
      'polish-score',
      456,
      300,
      236,
      118,
      'Score signals\nWeight confidence',
      12,
      'polish-flow',
    ),
    textNode(
      'polish-output',
      820,
      176,
      248,
      130,
      'Output\nReadable + stable',
      13,
      'polish-flow',
    ),
    textNode(
      'polish-notes',
      820,
      352,
      214,
      96,
      'Alt-drag to duplicate\nDrag from card edge to connect',
      14,
      'polish-flow',
    ),
  ]

  const edges = [
    connection('polish-1', 'polish-brief', 'polish-parse', 'frame'),
    connection('polish-2', 'polish-brief', 'polish-score', 'branch'),
    connection('polish-3', 'polish-parse', 'polish-output', 'emit'),
    connection('polish-4', 'polish-score', 'polish-output', 'merge'),
    connection('polish-5', 'polish-output', 'polish-notes', 'follow-up'),
  ]

  return {
    id: 'polish',
    label: 'Polish Pass',
    summary:
      'A staggered board for edge creation, reconnects, duplication, and zoom polish.',
    snapshot: snapshotFrom(
      nodes,
      { x: 18, y: 24, z: 0.82 },
      { ...DEFAULT_GRID, pattern: 'dot' },
    ),
    edges,
  }
}

function getScene(id: DemoSceneId): DemoScene {
  switch (id) {
    case 'polish':
      return createPolishScene()
    case 'systems':
      return createSystemsScene()
    case 'dense':
      return createDenseScene()
    case 'workflow':
    default:
      return createWorkflowScene()
  }
}

export function createDemoEngine(initialSceneId: DemoSceneId = 'workflow'): {
  engine: BoardEngine
  scene: DemoSceneOption
} {
  const engine = createBoardEngine({
    diagnostics: { traceLimit: 400 },
    grid: DEFAULT_GRID,
    extensions: [historyPlugin(), connectionPlugin()],
  })

  const scene = loadDemoScene(engine, initialSceneId)
  return { engine, scene }
}

export function loadDemoScene(
  engine: BoardEngine,
  sceneId: DemoSceneId,
): DemoSceneOption {
  const scene = getScene(sceneId)
  engine.importJSON(JSON.stringify(demoSceneToDocument(scene)), 'replace')
  engine.clearSelection()
  engine.endInteraction()
  engine.ext.history.clear()
  return {
    id: scene.id,
    label: scene.label,
    summary: scene.summary,
  }
}

export function exportDemoDocument(engine: BoardEngine): string {
  return engine.exportJSON()
}

export function importDemoDocument(engine: BoardEngine, json: string): void {
  engine.importJSON(json, 'replace')
  engine.clearSelection()
  engine.endInteraction()
  engine.ext.history.clear()
}

export function getDemoCounts(engine: BoardEngine): {
  nodes: number
  edges: number
  selection: number
  history: number
} {
  const snapshot = engine.getSnapshot()
  return {
    nodes: snapshot.nodes.length,
    edges: engine.ext.connections.getEdges().length,
    selection: snapshot.selection.length,
    history: engine.ext.history.getState().undoDepth,
  }
}

export function wrapSelectionInGroup(
  engine: BoardEngine,
): 'created' | 'grouped' {
  const selection = engine.getSelection()
  const snapshot = engine.getSnapshot()
  const groupPadding = 32
  const groupId = `group-${snapshot.nextZIndex}`

  if (selection.length === 0) {
    const viewport = engine.getViewportSize()
    const center = engine.screenToWorld({
      x: viewport.x / 2,
      y: viewport.y / 2,
    })
    const group = engine.createNode({
      id: asNodeId(groupId),
      type: 'group',
      x: Math.round(center.x - 180),
      y: Math.round(center.y - 130),
      width: 360,
      height: 260,
      color: '2',
      label: 'New group',
      select: false,
    })
    engine.sendToBack(group.id)
    engine.select(group.id)
    return 'created'
  }

  const selectedNodes = snapshot.nodes.filter((node) =>
    selection.includes(node.id),
  )
  if (selectedNodes.length === 0) {
    return 'created'
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of selectedNodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }

  const group = engine.createNode({
    id: asNodeId(groupId),
    type: 'group',
    x: minX - groupPadding,
    y: minY - groupPadding,
    width: maxX - minX + groupPadding * 2,
    height: maxY - minY + groupPadding * 2,
    color: '2',
    label: 'Selection group',
    select: false,
  })

  engine.sendToBack(group.id)
  for (const node of selectedNodes) {
    if (node.id !== group.id) {
      engine.updateNode(node.id, { parentId: group.id })
    }
  }
  engine.syncGroupZOrder(group.id)
  engine.select([group.id, ...selection.filter((id) => id !== group.id)])
  return 'grouped'
}

export function getLastTraceLabel(engine: BoardEngine): string {
  return engine.exportTrace().at(-1)?.event ?? 'ready'
}
