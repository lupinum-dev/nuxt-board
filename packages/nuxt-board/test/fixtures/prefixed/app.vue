<template>
  <div>
    <p class="prefixed-module-ok">prefixed-module-ok</p>
    <AcmeBoardRoot :engine="engine" style="width: 400px; height: 300px">
      <PrefixedBoardProbe />
    </AcmeBoardRoot>
  </div>
</template>

<script setup lang="ts">
import { asNodeId } from '@lupinum/board-core'

const engine = createAcmeBoardEngine({
  initialNodes: [
    {
      id: asNodeId('prefixed-text-node'),
      type: 'text',
      x: 40,
      y: 32,
      width: 180,
      height: 80,
      data: { content: 'prefixed-node-content' },
      zIndex: 1,
      locked: false,
      visible: true,
    },
  ],
})
</script>
