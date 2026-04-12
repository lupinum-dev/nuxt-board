<script setup lang="ts">
import { computed } from 'vue'
import type { CanvasNode } from '@canvas/core'

const props = defineProps<{
  node: CanvasNode
  selected: boolean
}>()

type GroupData = { title?: string; accent?: string }

const data = computed((): GroupData => (props.node.data ?? {}) as GroupData)

const title = computed(() => (typeof data.value.title === 'string' ? data.value.title : 'Untitled group'))

const accent = computed(() =>
  typeof data.value.accent === 'string' && data.value.accent.length > 0 ? data.value.accent : '#0d9488'
)
</script>

<template>
  <div
    class="relative size-full rounded-[inherit] overflow-visible"
    :style="{
      backgroundColor: 'rgba(245, 245, 244, 0.92)',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: accent,
      boxShadow: selected ? `0 0 0 3px ${accent}22` : undefined
    }"
  >
    <div
      class="canvas-group-label absolute left-3 -top-3 z-[1] max-w-[calc(100%-24px)] px-1 font-sans text-[15px] font-semibold tracking-tight text-stone-700 truncate bg-[rgb(245,245,244)]"
      spellcheck="false"
    >
      {{ title }}
    </div>
  </div>
</template>
