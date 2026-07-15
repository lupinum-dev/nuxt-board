<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    instructions?: string
  }>(),
  { instructions: undefined },
)
</script>

<template>
  <section class="docs-lab" :aria-label="title">
    <header class="docs-lab__header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
      <div v-if="$slots.controls" class="docs-lab__controls">
        <slot name="controls" />
      </div>
    </header>

    <p v-if="instructions" class="docs-lab__instructions">
      <span>Try this</span>
      {{ instructions }}
    </p>

    <div class="docs-lab__workspace">
      <div class="docs-lab__stage">
        <slot />
      </div>
      <aside
        v-if="$slots.inspect"
        class="docs-lab__inspect"
        aria-label="Live inspector"
      >
        <slot name="inspect" />
      </aside>
    </div>

    <div v-if="$slots.timeline" class="docs-lab__timeline">
      <slot name="timeline" />
    </div>
    <div v-if="$slots.code" class="docs-lab__code">
      <slot name="code" />
    </div>
  </section>
</template>
