<script setup lang="ts">
import type { BoardNode } from '@lupinum/board-core'

defineProps<{ node: BoardNode; selected: boolean }>()
</script>

<template>
  <article class="lab-task-node" :data-selected="selected">
    <span>Documentation</span>
    <strong>{{ node.text }}</strong>
    <small>Canonical type: {{ node.type }}</small>
  </article>
</template>

<style scoped>
.lab-task-node {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
  border-radius: inherit;
  color: var(--board-fg);
  background: var(--board-bg-elevated);
  box-shadow: inset 0 0 0 1px var(--board-border-strong);
}

.lab-task-node[data-selected='true'] {
  box-shadow: inset 0 0 0 2px var(--board-accent);
}

.lab-task-node span,
.lab-task-node small {
  color: var(--board-muted-fg);
  font-size: 0.7rem;
}

.lab-task-node strong {
  font-size: 0.95rem;
  line-height: 1.35;
}
</style>
