<template>
  <div>
    <p class="board-module-ok">board-module-ok</p>
    <BoardRoot :engine="engine" style="width: 400px; height: 300px">
      <BoardProbe />
    </BoardRoot>
  </div>
</template>

<script setup lang="ts">
import { asNodeId } from '@lupinum/board-core'

const engine = createBoardEngine({
  initialNodes: [
    {
      id: asNodeId('fixture-text-node'),
      type: 'text',
      x: 40,
      y: 32,
      width: 180,
      height: 80,
      text: 'fixture-node-content',
      zIndex: 1,
      locked: false,
      visible: true,
    },
  ],
})
</script>
