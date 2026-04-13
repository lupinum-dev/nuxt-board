<script setup lang="ts">
import type { BoardNode } from '@lupinum/board-core'

defineProps<{
  node: BoardNode
  selected: boolean
}>()
</script>

<template>
  <div
    class="flex h-full flex-col justify-between rounded-[1.25rem] border border-slate-900/10 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.10)]"
    :class="{ 'ring-2 ring-sky-400': selected }"
  >
    <div class="flex items-center justify-between gap-3">
      <span class="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-500">{{ node.data.label }}</span>
      <span class="rounded-full bg-sky-50 px-2 py-1 text-[0.7rem] font-medium text-sky-700">{{ node.data.delta }}</span>
    </div>
    <div>
      <p class="text-3xl font-bold tracking-tight text-slate-950">
        {{ node.data.value }}
      </p>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        {{ node.data.caption }}
      </p>
    </div>
  </div>
</template>
