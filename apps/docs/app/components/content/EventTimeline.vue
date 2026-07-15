<script setup lang="ts">
export interface TimelineEntry {
  label: string
  detail?: string
  tone?: 'default' | 'success' | 'danger'
}

defineProps<{ entries: TimelineEntry[] }>()
</script>

<template>
  <div class="event-timeline" aria-live="polite">
    <p v-if="entries.length === 0" class="event-timeline__empty">
      Run an action to inspect its publication order.
    </p>
    <ol v-else>
      <li
        v-for="(entry, index) in entries"
        :key="`${index}-${entry.label}`"
        :data-tone="entry.tone"
      >
        <span>{{ String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ entry.label }}</strong>
        <code v-if="entry.detail">{{ entry.detail }}</code>
      </li>
    </ol>
  </div>
</template>
