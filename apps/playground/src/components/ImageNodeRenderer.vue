<script setup lang="ts">
import type { BoardNode } from '@lupinum/board-core'

defineProps<{
  node: BoardNode
  selected: boolean
}>()

const imageAlt = (node: BoardNode): string => node.file ?? 'Image'
</script>

<template>
  <div class="relative size-full overflow-hidden rounded-[inherit]">
    <img
      v-if="node.file"
      :src="node.file"
      :alt="imageAlt(node)"
      class="size-full object-cover"
      draggable="false"
    />
    <div
      v-else
      class="flex flex-col items-center justify-center gap-2 size-full bg-[var(--board-bg-subtle)] font-sans text-[13px] text-[var(--board-dim-fg)]"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span>{{ node.file ?? 'No image' }}</span>
    </div>
  </div>
</template>
