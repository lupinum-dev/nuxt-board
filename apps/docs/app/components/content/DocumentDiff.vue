<script setup lang="ts">
defineProps<{
  before: Record<string, unknown>
  after: Record<string, unknown>
}>()
</script>

<template>
  <div class="document-diff">
    <div>
      <p>Before</p>
      <pre>{{ JSON.stringify(before, null, 2) }}</pre>
    </div>
    <div>
      <p>After</p>
      <pre>{{ JSON.stringify(after, null, 2) }}</pre>
    </div>
  </div>
</template>
