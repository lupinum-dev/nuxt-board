<script setup lang="ts">
defineProps<{ defaultValue?: string }>()
</script>

<template>
  <div class="my-6 overflow-hidden rounded-lg border bg-card">
    <div v-if="defaultValue" class="border-b bg-muted/50 px-4 py-2 font-mono text-xs text-muted-foreground">
      {{ defaultValue }}
    </div>
    <div class="[&>div]:my-0">
      <slot />
    </div>
  </div>
</template>
