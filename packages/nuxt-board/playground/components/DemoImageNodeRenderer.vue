<script setup lang="ts">
import type { BoardNode } from '@lupinum/board-core'

defineProps<{
  node: BoardNode
  selected: boolean
}>()

const imageAlt = (node: BoardNode): string => node.file ?? 'Image node'
</script>

<template>
  <div class="image-card" :class="{ 'is-selected': selected }">
    <img
      v-if="node.file"
      :src="node.file"
      :alt="imageAlt(node)"
      class="image-card__media"
      draggable="false"
    />
    <div v-else class="image-card__placeholder">
      <span class="image-card__badge">Preview</span>
      <strong>{{ node.file ?? 'Reference image' }}</strong>
      <p>Drop product shots, diagrams, or runbooks into the board.</p>
    </div>
  </div>
</template>

<style scoped>
.image-card {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background:
    linear-gradient(145deg, rgba(15, 118, 110, 0.15), rgba(14, 165, 233, 0.08)),
    #f8fafc;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
}

.image-card.is-selected {
  box-shadow:
    inset 0 0 0 2px rgba(15, 118, 110, 0.45),
    0 0 0 6px rgba(15, 118, 110, 0.08);
}

.image-card__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-card__placeholder {
  display: grid;
  align-content: end;
  gap: 0.45rem;
  width: 100%;
  height: 100%;
  padding: 1rem;
  color: #0f172a;
  background:
    radial-gradient(
      circle at top left,
      rgba(15, 118, 110, 0.24),
      transparent 45%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.92));
}

.image-card__badge {
  width: fit-content;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.image-card__placeholder strong {
  font-size: 1rem;
}

.image-card__placeholder p {
  margin: 0;
  color: #475569;
  font-size: 0.82rem;
  line-height: 1.45;
}
</style>
