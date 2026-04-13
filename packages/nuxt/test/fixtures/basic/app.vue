<template>
  <div>
    <p class="canvas-module-ok">canvas-module-ok</p>
    <CanvasRoot :engine="engine" style="width: 400px; height: 300px;" />
  </div>
</template>

<script setup lang="ts">
import { asNodeId } from '@canvas/core'

const engine = createCanvasEngine({
  initialNodes: [
    {
      id: asNodeId('fixture-text-node'),
      type: 'text',
      x: 40,
      y: 32,
      width: 180,
      height: 80,
      data: { content: 'fixture-node-content' },
      zIndex: 1,
      locked: false,
      visible: true,
    },
  ],
})
</script>
