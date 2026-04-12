<script setup lang="ts">
defineProps<{
  camera: { x: number; y: number; z: number }
  nodeCount: number
  selectionCount: number
  interactionMode: string
  visibleCount: number
  lastTrace: string
}>()
</script>

<template>
  <aside class="absolute bottom-4 left-4 z-10 py-2.5 px-3.5 glass-light border border-black/6 rounded-[10px] shadow-sm">
    <dl class="grid grid-cols-2 gap-x-5 gap-y-1">
      <div class="flex items-baseline gap-2">
        <dt class="font-mono text-[10px] font-medium tracking-[0.03em] uppercase text-stone-400 whitespace-nowrap">Camera</dt>
        <dd class="font-mono text-xs text-stone-600 whitespace-nowrap" data-testid="camera-value">
          {{ camera.x.toFixed(1) }}, {{ camera.y.toFixed(1) }}, {{ camera.z.toFixed(2) }}
        </dd>
      </div>
      <div class="flex items-baseline gap-2">
        <dt class="font-mono text-[10px] font-medium tracking-[0.03em] uppercase text-stone-400 whitespace-nowrap">Nodes</dt>
        <dd class="font-mono text-xs text-stone-600 whitespace-nowrap" data-testid="node-count">{{ nodeCount }}</dd>
      </div>
      <div class="flex items-baseline gap-2">
        <dt class="font-mono text-[10px] font-medium tracking-[0.03em] uppercase text-stone-400 whitespace-nowrap">Selected</dt>
        <dd class="font-mono text-xs text-stone-600 whitespace-nowrap">{{ selectionCount }}</dd>
      </div>
      <div class="flex items-baseline gap-2">
        <dt class="font-mono text-[10px] font-medium tracking-[0.03em] uppercase text-stone-400 whitespace-nowrap">Mode</dt>
        <dd class="font-mono text-xs text-stone-600 whitespace-nowrap">{{ interactionMode }}</dd>
      </div>
      <div class="flex items-baseline gap-2">
        <dt class="font-mono text-[10px] font-medium tracking-[0.03em] uppercase text-stone-400 whitespace-nowrap">Visible</dt>
        <dd class="font-mono text-xs text-stone-600 whitespace-nowrap">{{ visibleCount }}</dd>
      </div>
      <div class="flex items-baseline gap-2">
        <dt class="font-mono text-[10px] font-medium tracking-[0.03em] uppercase text-stone-400 whitespace-nowrap">Trace</dt>
        <dd class="font-mono text-xs text-stone-600 whitespace-nowrap">{{ lastTrace }}</dd>
      </div>
    </dl>
  </aside>
</template>
