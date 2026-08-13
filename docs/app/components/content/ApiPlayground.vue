<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <section class="api-playground">
    <header>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </header>
    <div class="api-playground__body">
      <slot />
    </div>
  </section>
</template>
