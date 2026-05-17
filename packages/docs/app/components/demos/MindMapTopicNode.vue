<script setup lang="ts">
import { computed } from 'vue'
import type { BoardNode } from '@lupinum/board-core'

const props = defineProps<{
  node: BoardNode
  selected: boolean
}>()

const data = computed(() => props.node.data ?? {})
const depth = computed(() => Number(data.value.depth ?? 0))

const style = computed(() => {
  if (depth.value === 0) {
    return {
      surface: `linear-gradient(135deg,
        color-mix(in srgb, #14b8a6 16%, white),
        color-mix(in srgb, #14b8a6 4%, white) 55%,
        color-mix(in srgb, #14b8a6 12%, white))`,
      glow: 'inset 0 1px 0 0 rgba(20,184,166,0.20), 0 14px 48px rgba(15,23,42,0.08), 0 1px 3px rgba(20,184,166,0.08)',
      border: '#14b8a6',
      text: 'text-teal-950',
      label: 'ROOT',
      labelColor: 'text-teal-600',
    }
  }
  if (depth.value === 1) {
    return {
      surface: `linear-gradient(135deg,
        color-mix(in srgb, #0ea5e9 14%, white),
        color-mix(in srgb, #0ea5e9 3%, white) 55%,
        color-mix(in srgb, #0ea5e9 10%, white))`,
      glow: 'inset 0 1px 0 0 rgba(14,165,233,0.18), 0 14px 48px rgba(15,23,42,0.07), 0 1px 3px rgba(14,165,233,0.08)',
      border: '#0ea5e9',
      text: 'text-sky-950',
      label: 'BRANCH',
      labelColor: 'text-sky-500',
    }
  }
  return {
    surface: `linear-gradient(135deg,
      color-mix(in srgb, #94a3b8 10%, white),
      white 55%,
      color-mix(in srgb, #94a3b8 6%, white))`,
    glow: 'inset 0 1px 0 0 rgba(148,163,184,0.14), 0 10px 36px rgba(15,23,42,0.05)',
    border: '#94a3b8',
    text: 'text-default',
    label: 'LEAF',
    labelColor: 'text-dimmed',
  }
})
</script>

<template>
  <div
    class="h-full rounded-md border p-4"
    :class="[selected ? 'ring-2 ring-primary' : 'border-default']"
    :style="{
      borderLeft: `4px solid ${style.border}`,
      background: style.surface,
      boxShadow: style.glow,
    }"
  >
    <div class="flex h-full flex-col justify-between gap-2">
      <span
        class="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.28em]"
        :class="style.labelColor"
      >
        <span
          class="inline-block size-1.5 rounded-full"
          :style="{ background: style.border }"
        ></span>
        {{ style.label }}
      </span>
      <div>
        <h3 class="text-base font-semibold tracking-tight" :class="style.text">
          {{ data.title }}
        </h3>
        <p v-if="data.detail" class="mt-1.5 text-sm leading-5 text-dimmed">
          {{ data.detail }}
        </p>
      </div>
    </div>
  </div>
</template>
