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
    :class="selected ? 'ring-2 ring-teal-500/60 ring-inset' : ''"
    style="background: linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(255, 255, 255, 0.96));"
  >
    <div class="text-[10px] font-mono uppercase tracking-[0.18em] text-teal-700/80">
      Insight node
    </div>
    <div class="mt-2 text-sm font-semibold text-slate-900">
      {{ (node.data as { title?: string }).title ?? 'Untitled' }}
    </div>
    <div class="mt-2 text-xs leading-5 text-slate-600">
      {{ (node.data as { body?: string }).body ?? 'Use custom renderers to swap the default card view for any Vue component.' }}
    </div>
  </div>
</template>
