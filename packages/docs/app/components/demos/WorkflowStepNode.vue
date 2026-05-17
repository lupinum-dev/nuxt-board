<script setup lang="ts">
import { computed } from 'vue'
import type { BoardNode } from '@lupinum/board-core'

const props = defineProps<{
  node: BoardNode
  selected: boolean
}>()

const data = computed(() => {
  const [status = 'pending', label = 'Step', summary = ''] =
    props.node.text?.split('\n') ?? []
  return { status, label, summary }
})
const tone = computed(() => {
  const status = String(data.value.status ?? 'pending')
  if (status === 'done') {
    return {
      badge: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/60',
      border: '#10b981',
      surface: `linear-gradient(135deg,
        color-mix(in srgb, #10b981 14%, white),
        color-mix(in srgb, #10b981 4%, white) 60%,
        color-mix(in srgb, #10b981 10%, white))`,
      glow: 'inset 0 1px 0 0 rgba(16,185,129,0.18), 0 18px 60px rgba(15,23,42,0.08), 0 1px 3px rgba(16,185,129,0.10)',
    }
  }
  if (status === 'active') {
    return {
      badge: 'bg-sky-100 text-sky-800 ring-1 ring-sky-300/60',
      border: '#0ea5e9',
      surface: `linear-gradient(135deg,
        color-mix(in srgb, #0ea5e9 14%, white),
        color-mix(in srgb, #0ea5e9 4%, white) 60%,
        color-mix(in srgb, #0ea5e9 10%, white))`,
      glow: 'inset 0 1px 0 0 rgba(14,165,233,0.18), 0 18px 60px rgba(15,23,42,0.08), 0 1px 3px rgba(14,165,233,0.10)',
    }
  }
  return {
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    border: '#94a3b8',
    surface: `linear-gradient(135deg,
      color-mix(in srgb, #94a3b8 8%, white),
      white 60%,
      color-mix(in srgb, #94a3b8 6%, white))`,
    glow: 'inset 0 1px 0 0 rgba(148,163,184,0.14), 0 18px 60px rgba(15,23,42,0.06)',
  }
})
</script>

<template>
  <div
    class="h-full rounded-md border p-4"
    :class="[selected ? 'ring-2 ring-primary' : 'border-default']"
    :style="{
      borderLeft: `5px solid ${tone.border}`,
      background: tone.surface,
      boxShadow: tone.glow,
    }"
  >
    <div class="flex h-full flex-col justify-between gap-3">
      <div class="flex items-center justify-between gap-3">
        <span
          class="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-dimmed"
        >
          <span
            class="inline-block size-1.5 rounded-full"
            :style="{ background: tone.border }"
          ></span>
          Step
        </span>
        <span
          class="rounded-full px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide"
          :class="tone.badge"
          >{{ data.status }}</span
        >
      </div>
      <div>
        <h3 class="text-lg font-semibold tracking-tight text-highlighted">
          {{ data.label }}
        </h3>
        <p class="mt-2 text-sm leading-6 text-muted">
          {{ data.summary }}
        </p>
      </div>
    </div>
  </div>
</template>
