<script setup lang="ts">
import { computed } from 'vue'
import type { BoardNode } from '@lupinum/board-core'

const props = defineProps<{
  node: BoardNode
  selected: boolean
}>()

const depth = computed(() => Number(props.node.data.depth ?? 0))

const style = computed(() => {
  if (depth.value === 0) {
    return {
      surface: 'from-teal-50 via-white to-teal-100/60',
      border: '#14b8a6',
      text: 'text-teal-950',
      label: 'ROOT'
    }
  }
  if (depth.value === 1) {
    return {
      surface: 'from-sky-50 via-white to-sky-100/50',
      border: '#0ea5e9',
      text: 'text-sky-950',
      label: 'BRANCH'
    }
  }
  return {
    surface: 'from-slate-50 via-white to-slate-100/40',
    border: '#94a3b8',
    text: 'text-slate-800',
    label: 'LEAF'
  }
})
</script>

<template>
  <div
    class="h-full rounded-[1.25rem] border bg-gradient-to-br p-4 shadow-[0_14px_48px_rgba(15,23,42,0.08)]"
    :class="[style.surface, selected ? 'ring-2 ring-teal-400' : 'border-slate-900/10']"
    :style="{ borderLeft: `5px solid ${style.border}` }"
  >
    <div class="flex h-full flex-col justify-between gap-2">
      <span class="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-slate-400">{{ style.label }}</span>
      <div>
        <h3 class="text-base font-semibold tracking-tight" :class="style.text">
          {{ node.data.title }}
        </h3>
        <p v-if="node.data.detail" class="mt-1.5 text-sm leading-5 text-slate-500">
          {{ node.data.detail }}
        </p>
      </div>
    </div>
  </div>
</template>
