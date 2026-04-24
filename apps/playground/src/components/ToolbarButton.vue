<script setup lang="ts">
import { computed } from 'vue'

type Size = 'square' | 'text' | 'icon-text'

const props = withDefaults(
  defineProps<{
    active?: boolean
    size?: Size
    title?: string
    ariaLabel?: string
    tone?: 'neutral' | 'accent'
  }>(),
  { size: 'text', tone: 'neutral' },
)

defineEmits<{ click: [event: MouseEvent] }>()

const base =
  'group relative inline-flex items-center justify-center shrink-0 border-0 cursor-pointer whitespace-nowrap rounded-lg font-sans text-[13px] font-medium active:scale-[0.97] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--board-accent)] focus-visible:-outline-offset-2 disabled:cursor-default disabled:opacity-40'

const sizeCls = computed(() => {
  switch (props.size) {
    case 'square':
      return 'w-10 h-10 sm:w-8 sm:h-8'
    case 'icon-text':
      return 'h-10 sm:h-8 pl-2 pr-2.5 gap-1.5'
    default:
      return 'h-10 sm:h-8 px-3'
  }
})

const toneCls = computed(() => {
  if (props.active) {
    return 'bg-[var(--board-fg)] text-[var(--board-bg-elevated)] hover:bg-[color-mix(in_srgb,var(--board-fg)_92%,transparent)]'
  }
  if (props.tone === 'accent') {
    return 'bg-transparent text-[var(--board-accent)] hover:bg-[color-mix(in_srgb,var(--board-accent)_12%,transparent)]'
  }
  return 'bg-transparent text-[var(--board-muted-fg)] hover:bg-[color-mix(in_srgb,var(--board-fg)_6%,transparent)] hover:text-[var(--board-fg)]'
})
</script>

<template>
  <button
    type="button"
    :class="[base, sizeCls, toneCls]"
    :title="title"
    :aria-label="ariaLabel ?? title"
    :aria-pressed="active || undefined"
    @click="(event) => $emit('click', event)"
  >
    <slot />
  </button>
</template>
