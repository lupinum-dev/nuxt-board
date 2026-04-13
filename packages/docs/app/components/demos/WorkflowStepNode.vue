<script setup lang="ts">
import { computed } from 'vue'
import type { BoardNode } from '@lupinum/board-core'

const props = defineProps<{
  node: BoardNode
  selected: boolean
}>()

const tone = computed(() => {
  const status = String(props.node.data.status ?? 'pending')
  if (status === 'done') {
    return {
      badge: 'bg-emerald-50 text-emerald-700',
      border: '#10b981',
      surface: 'from-emerald-50 via-white to-emerald-100/70'
    }
  }
  if (status === 'active') {
    return {
      badge: 'bg-sky-50 text-sky-700',
      border: '#0ea5e9',
      surface: 'from-sky-50 via-white to-cyan-100/70'
    }
  }
  return {
    badge: 'bg-accented text-muted',
    border: '#94a3b8',
    surface: 'from-slate-100 via-white to-slate-50'
  }
})
</script>

<template>
  <div
    class="h-full rounded-md border bg-gradient-to-br p-4 shadow-[0_18px_60px_rgba(15,23,42,0.10)]"
    :class="[tone.surface, selected ? 'ring-2 ring-primary' : 'border-default']"
    :style="{ borderLeft: `6px solid ${tone.border}` }"
  >
    <div class="flex h-full flex-col justify-between gap-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-dimmed">Step</span>
        <span class="rounded-full px-2 py-1 text-[0.7rem] font-medium" :class="tone.badge">{{ node.data.status }}</span>
      </div>
      <div>
        <h3 class="text-lg font-semibold tracking-tight text-highlighted">
          {{ node.data.label }}
        </h3>
        <p class="mt-2 text-sm leading-6 text-muted">
          {{ node.data.summary }}
        </p>
      </div>
    </div>
  </div>
</template>
