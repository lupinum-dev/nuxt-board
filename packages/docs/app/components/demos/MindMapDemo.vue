<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createBoardEngine, type NodeId } from '@lupinum/board-core'
import {
  connectionPlugin,
  BoardConnectionLayer,
} from '@lupinum/board-connections'
import { historyPlugin } from '@lupinum/board-history'
import type { BoardRendererRegistry } from '@lupinum/vue-board'
import MindMapTopicNode from './MindMapTopicNode.vue'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'dot' },
  plugins: [historyPlugin(), connectionPlugin({ routing: 'bezier' })],
})

const renderers: BoardRendererRegistry = {
  topic: MindMapTopicNode,
}

const selection = ref<NodeId[]>([])

function seed() {
  engine.importJSON(
    JSON.stringify({
      camera: { x: -60, y: -40, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'root',
          type: 'topic',
          x: 300,
          y: 160,
          width: 220,
          height: 110,
          data: { title: 'Product roadmap', detail: 'Q3 priorities', depth: 0 },
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: 'eng',
          type: 'topic',
          x: 40,
          y: 40,
          width: 200,
          height: 100,
          data: {
            title: 'Engineering',
            detail: 'Performance + infra',
            depth: 1,
          },
          parentId: 'root',
          zIndex: 2,
          locked: false,
          visible: true,
        },
        {
          id: 'design',
          type: 'topic',
          x: 40,
          y: 290,
          width: 200,
          height: 100,
          data: { title: 'Design', detail: 'Design system v2', depth: 1 },
          parentId: 'root',
          zIndex: 3,
          locked: false,
          visible: true,
        },
        {
          id: 'growth',
          type: 'topic',
          x: 610,
          y: 40,
          width: 200,
          height: 100,
          data: { title: 'Growth', detail: 'Activation funnels', depth: 1 },
          parentId: 'root',
          zIndex: 4,
          locked: false,
          visible: true,
        },
        {
          id: 'api',
          type: 'topic',
          x: 610,
          y: 290,
          width: 200,
          height: 90,
          data: { title: 'API v3', depth: 2 },
          parentId: 'eng',
          zIndex: 5,
          locked: false,
          visible: true,
        },
      ],
      selection: [],
      interaction: { mode: 'idle' },
      snapGuides: [],
      nextZIndex: 6,
    }),
    'replace',
  )

  const conn = engine.ext.connections
  for (const edge of conn.getEdges()) conn.deleteEdge(edge.id)
  conn.createEdge({ from: 'root' as NodeId, to: 'eng' as NodeId, data: {} })
  conn.createEdge({ from: 'root' as NodeId, to: 'design' as NodeId, data: {} })
  conn.createEdge({ from: 'root' as NodeId, to: 'growth' as NodeId, data: {} })
  conn.createEdge({ from: 'eng' as NodeId, to: 'api' as NodeId, data: {} })
}

let branchCount = 0
function addBranch() {
  branchCount++
  const selected = selection.value[0]
  const parent = selected ?? ('root' as NodeId)
  const parentNode = engine.getNode(parent)
  if (!parentNode) return

  const parentDepth = Number(parentNode.data.depth ?? 0)
  const newNode = engine.createNode({
    type: 'topic',
    x: parentNode.x + 260 + Math.round(Math.random() * 40),
    y: parentNode.y + Math.round(Math.random() * 120 - 60),
    width: 200,
    height: 90,
    data: {
      title: `New topic ${branchCount}`,
      depth: Math.min(parentDepth + 1, 2),
    },
    parentId: parent,
    select: true,
  })
  engine.ext.connections.createEdge({ from: parent, to: newNode.id, data: {} })
}

onMounted(async () => {
  engine.on('selection:change', (next) => {
    selection.value = next
  })
  seed()
  await engine.zoomToFit(72, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="seed">Reset</button>
      <button class="demo-primary" @click="addBranch">Add branch</button>
      <button @click="engine.zoomToFit(72, false)">Zoom to fit</button>
      <button
        :disabled="!engine.ext.history.canUndo()"
        @click="engine.ext.history.undo()"
      >
        Undo
      </button>
      <button
        :disabled="!engine.ext.history.canRedo()"
        @click="engine.ext.history.redo()"
      >
        Redo
      </button>
      <span class="demo-toolbar-note ml-auto"
        >Select a topic, then add a branch from it.</span
      >
    </div>

    <BoardRoot :engine="engine" :renderers="renderers" style="height: 420px">
      <BoardConnectionLayer routing="bezier" />
    </BoardRoot>
  </div>
</template>
