---
seo:
  title: Vue Board
  description: Build node-based editors, whiteboards, and spatial tools in Vue 3 and Nuxt.
---

::u-page-hero
---
orientation: horizontal
class: "min-h-[70vh]"
---
#title
Build spatial tools with [Vue Board]{.text-primary}.

#description
Vue Board gives you a headless board engine, Vue primitives, Nuxt auto-imports, and focused plugins for history, connections, minimaps, and JSON Canvas workflows.

#links
  :::u-button
  ---
  to: /getting-started/quick-start
  size: xl
  trailing-icon: i-lucide-arrow-right
  ---
  Build your first board
  :::

  :::u-button
  ---
  to: /examples/basic-board
  color: neutral
  variant: outline
  size: xl
  ---
  Explore live examples
  :::

  :::u-button
  ---
  to: https://github.com/Mat4m0/canvas
  target: _blank
  icon: i-simple-icons-github
  color: neutral
  variant: ghost
  size: xl
  ---
  GitHub
  :::

#default
  ::basic-board-demo
  ::
::

::u-page-section
#title
Why this stack

#features
  :::u-page-feature
  ---
  icon: i-lucide-box
  ---
  #title
  Headless core

  #description
  Model boards, nodes, selection, camera state, grouping, snapping, and commands without coupling the engine to the DOM.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layers-3
  ---
  #title
  Vue-first rendering

  #description
  Compose `BoardRoot`, custom renderers, and composables without giving up direct control over layout and interaction.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-undo-2
  ---
  #title
  Focused plugins

  #description
  Add history, minimaps, connections, and serializer workflows only when the product needs them.
  :::
::

::u-page-section
#title
Build this in 5 minutes

#description
Start from a runnable board, then pull in the pattern you actually need.

::tabs

:::tabs-item{label="Workflow" icon="i-lucide-workflow"}

::::workflow-builder-demo
::::

[Open the workflow builder](/examples/workflow-builder)
:::

:::tabs-item{label="Connected graph" icon="i-lucide-cable"}

::::connections-board-demo
::::

[Open the connections example](/examples/connections-and-minimap)
:::

::
::

::u-page-section
#title
Choose your path

#features
  :::u-page-feature
  ---
  icon: i-lucide-rocket
  to: /getting-started/quick-start
  ---
  #title
  New here

  #description
  Start with one quick start page for both Vue and Nuxt, then move into Essentials.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-compass
  to: /essentials/core-concepts
  ---
  #title
  Already building

  #description
  Skip setup and go straight to the engine model, nodes, renderers, and interaction rules.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-sparkles
  to: /examples/basic-board
  ---
  #title
  Just browsing

  #description
  Open the examples first. Every example is a live board you can poke at.
  :::
::

::u-page-section
#title
Interactive by default

#description
The docs use the real workspace packages, not screenshots or isolated mocks.

::connections-board-demo
::
::
