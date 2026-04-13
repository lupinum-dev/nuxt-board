<script setup lang="ts">
import { onMounted } from 'vue'
import { createBoardEngine } from '@lupinum/board-core'

const engine = createBoardEngine({
  grid: { size: 20, majorEvery: 5, snap: true, pattern: 'line' }
})

function seed() {
  engine.importJSON(JSON.stringify({
    camera: { x: -80, y: -20, z: 1 },
    grid: engine.getGridSettings(),
    nodes: [
      { id: 'research', type: 'text', x: 60, y: 60, width: 240, height: 120, data: { content: 'User research\nSynthesize interview findings' }, zIndex: 1, locked: false, visible: true },
      { id: 'prototype', type: 'text', x: 370, y: 200, width: 260, height: 140, data: { content: 'Prototype\nInteractive flows for the onboarding redesign' }, zIndex: 2, locked: false, visible: true },
      { id: 'review', type: 'text', x: 680, y: 80, width: 220, height: 120, data: { content: 'Design review\nAlign with eng on feasibility' }, zIndex: 3, locked: false, visible: true }
    ],
    selection: [],
    interaction: { mode: 'idle' },
    snapGuides: [],
    nextZIndex: 4
  }), 'replace')
}

function addNode() {
  engine.createNode({
    type: 'text',
    x: 180 + Math.round(Math.random() * 320),
    y: 140 + Math.round(Math.random() * 160),
    width: 220,
    height: 120,
    data: { content: 'Note\nCreated from the docs demo' }
  })
}

function wrapSelectionInGroup() {
  const selected = engine.getSelection()
  if (selected.length === 0) {
    return
  }
  const nodes = engine.getSnapshot().nodes.filter(node => selected.includes(node.id))
  if (nodes.length === 0) {
    return
  }
  const minX = Math.min(...nodes.map(node => node.x))
  const minY = Math.min(...nodes.map(node => node.y))
  const maxX = Math.max(...nodes.map(node => node.x + node.width))
  const maxY = Math.max(...nodes.map(node => node.y + node.height))
  const group = engine.createNode({
    type: 'group',
    x: minX - 28,
    y: minY - 28,
    width: maxX - minX + 56,
    height: maxY - minY + 56,
    data: { title: 'Cluster' },
    select: false
  })
  engine.sendToBack(group.id)
  for (const node of nodes) {
    engine.updateNode(node.id, { parentId: group.id })
  }
  engine.syncGroupZOrder(group.id)
  engine.select(group.id)
}

onMounted(async () => {
  seed()
  await engine.zoomToFit(72, false)
})
</script>

<template>
  <div class="demo-frame">
    <div class="demo-toolbar">
      <button class="demo-danger" @click="seed">
        Reset
      </button>
      <button class="demo-primary" @click="addNode">
        Add note
      </button>
      <button @click="wrapSelectionInGroup">
        Group selection
      </button>
      <button @click="engine.zoomToFit(72, false)">
        Zoom to fit
      </button>
    </div>

    <BoardRoot
      :engine="engine"
      style="height: 360px"
    />
  </div>
</template>
