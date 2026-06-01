<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { asNodeId, createBoardEngine, type NodeId } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'
import {
  connectionPlugin,
  BoardConnectionLayer,
} from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'
import MindMapTopicNode from './MindMapTopicNode.vue'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
  extensions: [historyPlugin(), connectionPlugin({ routing: 'bezier' })],
})

const selection = ref<NodeId[]>([])
const edgesVersion = ref(0)
const historyState = ref(engine.ext.history.getState())
const ROOT_ID = asNodeId('root')
const ENG_ID = asNodeId('eng')
const DESIGN_ID = asNodeId('design')
const GROWTH_ID = asNodeId('growth')
const API_ID = asNodeId('api')

function syncHistoryState() {
  historyState.value = engine.ext.history.getState()
}

function refreshEdges() {
  edgesVersion.value++
}

const unsubscribeEngine = [
  engine.on('selection:change', (next) => {
    selection.value = next
  }),
  engine.on('edge:created', refreshEdges),
  engine.on('edge:updated', refreshEdges),
  engine.on('edge:deleted', refreshEdges),
  engine.on('history:push', syncHistoryState),
  engine.on('history:undo', syncHistoryState),
  engine.on('history:redo', syncHistoryState),
  engine.on('history:clear', syncHistoryState),
]

const topicDepthsById = computed(() => {
  void edgesVersion.value
  const depths = new Map<NodeId, number>([[ROOT_ID, 0]])
  const queue = [ROOT_ID]

  while (queue.length > 0) {
    const current = queue.shift()!
    const depth = depths.get(current) ?? 0
    for (const edge of engine.ext.connections.getEdgesFrom(current)) {
      if (depths.has(edge.to)) {
        continue
      }
      depths.set(edge.to, depth + 1)
      queue.push(edge.to)
    }
  }

  return depths
})

function seed() {
  engine.importJSON(
    JSON.stringify(
      createDemoDocument({
        camera: { x: -60, y: -40, z: 1 },
        grid: engine.getGridSettings(),
        selection: [],
        nextZIndex: 6,
        nodes: [
          {
            id: ROOT_ID,
            type: 'text',
            x: 300,
            y: 160,
            width: 220,
            height: 110,
            text: 'Product roadmap\nQ3 priorities',
            zIndex: 1,
            locked: false,
            visible: true,
          },
          {
            id: ENG_ID,
            type: 'text',
            x: 40,
            y: 40,
            width: 200,
            height: 100,
            text: 'Engineering\nAPI, canvas, exports',
            zIndex: 2,
            locked: false,
            visible: true,
          },
          {
            id: DESIGN_ID,
            type: 'text',
            x: 40,
            y: 290,
            width: 200,
            height: 100,
            text: 'Design\nInteraction polish',
            zIndex: 3,
            locked: false,
            visible: true,
          },
          {
            id: GROWTH_ID,
            type: 'text',
            x: 610,
            y: 40,
            width: 200,
            height: 100,
            text: 'Growth\nActivation paths',
            zIndex: 4,
            locked: false,
            visible: true,
          },
          {
            id: API_ID,
            type: 'text',
            x: 610,
            y: 290,
            width: 200,
            height: 90,
            text: 'Public API\nKeep it boring',
            zIndex: 5,
            locked: false,
            visible: true,
          },
        ],
      }),
    ),
    'replace',
  )

  const conn = engine.ext.connections
  for (const edge of conn.getEdges()) conn.deleteEdge(edge.id)
  conn.createEdge({ from: ROOT_ID, to: ENG_ID, data: {} })
  conn.createEdge({ from: ROOT_ID, to: DESIGN_ID, data: {} })
  conn.createEdge({ from: ROOT_ID, to: GROWTH_ID, data: {} })
  conn.createEdge({ from: ENG_ID, to: API_ID, data: {} })
  engine.ext.history.clear()
  refreshEdges()
  syncHistoryState()
}

let branchCount = 0
function addBranch() {
  branchCount++
  const selected = selection.value[0]
  const parent = selected ?? ROOT_ID
  const parentNode = engine.getNode(parent)
  if (!parentNode) return

  const newNode = engine.createNode({
    type: 'text',
    x: parentNode.x + 260 + Math.round(Math.random() * 40),
    y: parentNode.y + Math.round(Math.random() * 120 - 60),
    width: 200,
    height: 90,
    text: `New topic ${branchCount}`,
    select: true,
  })
  engine.ext.connections.createEdge({ from: parent, to: newNode.id, data: {} })
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(72, false)
})

onBeforeUnmount(() => {
  for (const unsubscribe of unsubscribeEngine) {
    unsubscribe()
  }
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="seed">Reset</button>
      <button class="demo-primary" @click="addBranch">Add branch</button>
      <button @click="engine.zoomToFit(72, false)">Zoom to fit</button>
      <button
        :disabled="historyState.undoDepth === 0"
        @click="engine.ext.history.undo()"
      >
        Undo
      </button>
      <button
        :disabled="historyState.redoDepth === 0"
        @click="engine.ext.history.redo()"
      >
        Redo
      </button>
      <span class="demo-toolbar-note ml-auto"
        >Select a topic, then add a branch from it.</span
      >
    </div>

    <BoardRoot :engine="engine" style="height: 420px">
      <template #node:text="{ node, selected }">
        <MindMapTopicNode
          :node="node"
          :selected="selected"
          :depth="topicDepthsById.get(node.id) ?? 2"
        />
      </template>
      <BoardConnectionLayer routing="bezier" />
    </BoardRoot>
  </div>
</template>
