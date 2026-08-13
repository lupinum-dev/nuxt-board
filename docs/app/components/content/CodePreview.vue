<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{ code: string; label?: string }>(), {
  label: 'Relevant code',
})
const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(props.code)
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1400)
}
</script>

<template>
  <div class="code-preview">
    <div>
      <span>{{ label }}</span>
      <button type="button" @click="copy">
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>
