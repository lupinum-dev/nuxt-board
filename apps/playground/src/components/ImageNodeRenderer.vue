<script setup lang="ts">
import type { CanvasNode } from '@canvas/core'

defineProps<{
  node: CanvasNode
  selected: boolean
}>()

function getAlt(node: CanvasNode): string {
  return String((node.data as Record<string, unknown>).alt ?? 'Untitled asset')
}
</script>

<template>
  <div
    class="flex flex-col gap-2 size-full p-3.5 bg-stone-100 font-sans text-[13px] text-stone-600"
    :class="{ 'ring-2 ring-teal-600': selected }"
  >
    <strong class="font-semibold text-stone-900">Image</strong>
    <span>{{ getAlt(node) }}</span>
  </div>
</template>
