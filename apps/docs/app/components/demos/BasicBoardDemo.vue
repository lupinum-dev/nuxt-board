<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../../utils/demoDocument'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'line' },
})
const nodeCount = ref(0)

function syncNodeCount() {
  nodeCount.value = engine.getState().nodes.size
}

function seed() {
  engine.loadDocument(
    createDemoDocument({
      camera: { x: -80, y: -20, z: 1 },
      grid: engine.getGridSettings(),
      nodes: [
        {
          id: 'group-1',
          type: 'group',
          x: 32,
          y: 32,
          width: 896,
          height: 306,
          text: 'Node',
          zIndex: 0,
          locked: false,
          visible: true,
        },
        {
          id: 'research',
          type: 'text',
          x: 60,
          y: 60,
          width: 240,
          height: 100,
          text: 'Node',
          zIndex: 1,
          locked: false,
          visible: true,
          parentId: 'group-1',
        },
        {
          id: 'prototype',
          type: 'text',
          x: 370,
          y: 200,
          width: 260,
          height: 110,
          text: 'Node',
          zIndex: 2,
          locked: false,
          visible: true,
          parentId: 'group-1',
        },
        {
          id: 'review',
          type: 'text',
          x: 680,
          y: 80,
          width: 220,
          height: 100,
          text: 'Node',
          zIndex: 3,
          locked: false,
          visible: true,
          parentId: 'group-1',
        },
      ],
      selection: [],
      nextZIndex: 4,
    }),
    { mode: 'replace' },
  )
  syncNodeCount()
}

function addNode() {
  const index = nodeCount.value - 4
  engine.createNode({
    type: 'text',
    x: 180 + (index % 3) * 120,
    y: 140 + (index % 2) * 100,
    width: 220,
    height: 100,
    text: `Planning note ${index + 1}`,
  })
  syncNodeCount()
}

function wrapSelectionInGroup() {
  const selected = engine.getSelection()
  if (selected.length === 0) {
    return
  }
  const nodes = Array.from(engine.getState().nodes.values()).filter((node) =>
    selected.includes(node.id),
  )
  if (nodes.length === 0) {
    return
  }
  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const maxX = Math.max(...nodes.map((node) => node.x + node.width))
  const maxY = Math.max(...nodes.map((node) => node.y + node.height))
  const group = engine.createNode({
    type: 'group',
    x: minX - 28,
    y: minY - 28,
    width: maxX - minX + 56,
    height: maxY - minY + 56,
    label: 'Group',
    select: false,
  })
  engine.sendToBack(group.id)
  for (const node of nodes) {
    engine.updateNode(node.id, { parentId: group.id })
  }
  engine.select(group.id)
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(72, false)
})
</script>

<template>
  <div
    class="demo-frame"
    data-testid="basic-board-demo"
    :data-node-count="nodeCount"
  >
    <div class="demo-toolbar">
      <button class="demo-danger" @click="seed">Reset</button>
      <button class="demo-primary" @click="addNode">Add note</button>
      <button @click="wrapSelectionInGroup">Group selection</button>
      <button @click="engine.zoomToFit(72, false)">Zoom to fit</button>
    </div>

    <BoardRoot :engine="engine" style="height: 360px" />
  </div>
</template>
