<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    value: unknown
    empty?: string
  }>(),
  { title: 'State', empty: 'No value' },
)

const formatted = computed(() => {
  if (props.value === undefined || props.value === null) return props.empty
  return typeof props.value === 'string'
    ? props.value
    : JSON.stringify(props.value, null, 2)
})
</script>

<template>
  <div class="state-inspector">
    <p class="state-inspector__title">{{ title }}</p>
    <pre aria-live="polite">{{ formatted }}</pre>
  </div>
</template>
