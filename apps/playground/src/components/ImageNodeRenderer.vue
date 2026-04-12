<script setup lang="ts">
import type { CanvasNode } from '@canvas/core'

defineProps<{
  node: CanvasNode
  selected: boolean
}>()

function getData(node: CanvasNode): { src?: string; alt?: string } {
  return node.data as { src?: string; alt?: string }
}
</script>

<template>
  <div
    class="relative size-full overflow-hidden rounded-[inherit]"
    :class="{ 'ring-2 ring-teal-600 ring-inset': selected }"
  >
    <img
      v-if="getData(node).src"
      :src="getData(node).src"
      :alt="getData(node).alt ?? 'Image'"
      class="size-full object-cover"
      draggable="false"
    />
    <div
      v-else
      class="flex flex-col items-center justify-center gap-2 size-full bg-stone-100 font-sans text-[13px] text-stone-400"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span>{{ getData(node).alt ?? 'No image' }}</span>
    </div>
  </div>
</template>
