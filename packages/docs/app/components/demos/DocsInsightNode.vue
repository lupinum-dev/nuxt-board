<script setup lang="ts">
import type { BoardNode } from '@lupinum/board-core'

defineProps<{
  node: BoardNode
  selected: boolean
}>()
</script>

<template>
  <div
    class="size-full rounded-[inherit] p-4 text-left"
    :class="selected ? 'ring-2 ring-primary/60 ring-inset' : ''"
    style="background: linear-gradient(135deg, color-mix(in srgb, var(--ui-primary) 12%, transparent), var(--ui-bg));"
  >
    <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-primary/80">
      Insight node
    </div>
    <div class="mt-2 text-sm font-semibold text-highlighted">
      {{ (node.data as { title?: string }).title ?? 'Untitled' }}
    </div>
    <div class="mt-2 text-xs leading-5 text-muted">
      {{ (node.data as { body?: string }).body ?? 'Use custom renderers to swap the default card view for any Vue component.' }}
    </div>
  </div>
</template>
