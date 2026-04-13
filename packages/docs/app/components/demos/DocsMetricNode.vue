<script setup lang="ts">
import { computed } from 'vue'
import type { BoardNode } from '@lupinum/board-core'

const props = defineProps<{
  node: BoardNode
  selected: boolean
}>()

const deltaPositive = computed(() => {
  const d = String(props.node.data.delta ?? '')
  return d.startsWith('+')
})
</script>

<template>
  <div
    class="flex h-full flex-col justify-between rounded-md border p-4"
    :class="[selected ? 'ring-2 ring-primary' : 'border-default']"
    style="
      background: linear-gradient(160deg,
        color-mix(in srgb, var(--ui-primary) 8%, white),
        white 50%,
        color-mix(in srgb, var(--ui-primary) 5%, white));
      box-shadow:
        inset 0 1px 0 0 color-mix(in srgb, var(--ui-primary) 12%, transparent),
        0 12px 40px rgba(15,23,42,0.07),
        0 1px 3px rgba(15,23,42,0.04);
    "
  >
    <div class="flex items-center justify-between gap-3">
      <span class="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-dimmed">{{ node.data.label }}</span>
      <span
        class="rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide ring-1"
        :class="deltaPositive
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/60'
          : 'bg-amber-50 text-amber-700 ring-amber-200/60'"
      >
        {{ node.data.delta }}
      </span>
    </div>
    <div>
      <p class="text-3xl font-bold tracking-tight" style="color: var(--ui-primary);">
        {{ node.data.value }}
      </p>
      <p class="mt-2 text-sm leading-6 text-muted">
        {{ node.data.caption }}
      </p>
    </div>
  </div>
</template>
