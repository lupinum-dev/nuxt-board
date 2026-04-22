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
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.78);
  color: #e2e8f0;
  backdrop-filter: blur(14px);
  box-shadow: 0 18px 45px -28px rgba(15, 23, 42, 0.7);
}

.diagnostics__item {
  display: grid;
  gap: 0.2rem;
}

.diagnostics__item span {
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.64);
}

.diagnostics__item strong {
  font-size: 0.8rem;
  font-weight: 600;
}

@media (max-width: 720px) {
  .diagnostics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
