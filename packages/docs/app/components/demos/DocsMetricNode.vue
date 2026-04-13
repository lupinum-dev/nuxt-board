<script setup lang="ts">
import type { BoardNode } from '@lupinum/board-core'

defineProps<{
  node: BoardNode
  selected: boolean
}>()
</script>

<template>
  <div
    class="flex h-full flex-col justify-between rounded-md border border-default bg-default p-4 shadow-sm"
    :class="{ 'ring-2 ring-primary': selected }"
  >
    <div class="flex items-center justify-between gap-3">
      <span class="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-dimmed">{{ node.data.label }}</span>
      <span class="rounded-full bg-sky-50 px-2 py-1 text-[0.7rem] font-medium text-sky-700">{{ node.data.delta }}</span>
    </div>
    <div>
      <p class="text-3xl font-bold tracking-tight text-highlighted">
        {{ node.data.value }}
      </p>
      <p class="mt-2 text-sm leading-6 text-muted">
        {{ node.data.caption }}
      </p>
    </div>
  </div>
</template>
