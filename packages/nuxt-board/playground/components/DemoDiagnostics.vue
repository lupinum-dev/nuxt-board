<script setup lang="ts">
defineProps<{
  camera: { x: number; y: number; z: number }
  nodes: number
  edges: number
  selection: number
  visible: number
  trace: string
}>()
</script>

<template>
  <aside class="diagnostics">
    <div class="diagnostics__item">
      <span>Camera</span>
      <strong
        >{{ camera.x.toFixed(1) }}, {{ camera.y.toFixed(1) }},
        {{ camera.z.toFixed(2) }}</strong
      >
    </div>
    <div class="diagnostics__item">
      <span>Nodes</span>
      <strong>{{ nodes }}</strong>
    </div>
    <div class="diagnostics__item">
      <span>Edges</span>
      <strong>{{ edges }}</strong>
    </div>
    <div class="diagnostics__item">
      <span>Selected</span>
      <strong>{{ selection }}</strong>
    </div>
    <div class="diagnostics__item">
      <span>Visible</span>
      <strong>{{ visible }}</strong>
    </div>
    <div class="diagnostics__item">
      <span>Trace</span>
      <strong>{{ trace }}</strong>
    </div>
  </aside>
</template>

<style scoped>
.diagnostics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem 1rem;
  padding: 0.75rem;
  border: 1px solid #3f3f46;
  border-radius: 0.625rem;
  background: rgb(24 24 27 / 0.94);
  color: #fafafa;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.14);
}

.diagnostics__item {
  display: grid;
  gap: 0.2rem;
}

.diagnostics__item span {
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a1a1aa;
}

.diagnostics__item strong {
  font-size: 0.75rem;
  font-weight: 600;
}

@media (max-width: 720px) {
  .diagnostics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem 0.65rem;
    padding: 0.7rem 0.8rem;
    border-radius: 0.5rem;
  }
}
</style>
