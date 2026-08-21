import { defineComponent, watch, type PropType } from 'vue'
import { useBoardEngine } from '@lupinum/vue-board'
import {
  BOARD_EDITOR_ATTRIBUTE,
  BOARD_INTERACTIVE_SELECTOR,
  BOARD_ROOT_SELECTOR,
} from '@lupinum/board-core/internal'
import type { HistoryApi } from './index.js'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      `${BOARD_INTERACTIVE_SELECTOR}, [${BOARD_EDITOR_ATTRIBUTE}="true"], input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"])`,
    ),
  )
}

/** Renderless undo/redo shortcuts scoped to the enclosing BoardRoot. */
export const BoardHistoryShortcuts = defineComponent({
  name: 'BoardHistoryShortcuts',
  props: {
    history: {
      type: Object as PropType<HistoryApi>,
      required: true,
    },
  },
  setup(props) {
    const context = useBoardEngine()

    watch(
      () => context.rootElement.value,
      (root, _previous, onCleanup) => {
        if (!root) return

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.defaultPrevented || isEditableTarget(event.target)) return
          if (!(event.target instanceof Element)) return
          if (event.target.closest(BOARD_ROOT_SELECTOR) !== root) return
          if (!event.metaKey && !event.ctrlKey) return

          const key = event.key.toLowerCase()
          if (key === 'z') {
            event.preventDefault()
            if (event.shiftKey) props.history.redo()
            else props.history.undo()
          } else if (key === 'y') {
            event.preventDefault()
            props.history.redo()
          }
        }

        root.addEventListener('keydown', onKeyDown)
        onCleanup(() => root.removeEventListener('keydown', onKeyDown))
      },
      { immediate: true },
    )

    return () => null
  },
})
