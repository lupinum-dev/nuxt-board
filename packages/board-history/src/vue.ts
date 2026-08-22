import { defineComponent, toRaw, watch, type PropType } from 'vue'
import { useBoardEngine } from '@lupinum/vue-board'
import {
  isBoardInteractiveEventTarget,
  isEventOwnedByBoardRoot,
} from '@lupinum/board-core/internal'
import type { HistoryApi } from './index.js'

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

    function getOwnedHistory(): HistoryApi {
      const plugins = context.engine.plugins
      if (
        !('history' in plugins) ||
        toRaw(plugins.history) !== toRaw(props.history)
      ) {
        throw new Error(
          'BoardHistoryShortcuts history must belong to its enclosing BoardRoot engine.',
        )
      }
      return props.history
    }

    getOwnedHistory()
    watch(() => props.history, getOwnedHistory)

    watch(
      () => context.rootElement.value,
      (root, _previous, onCleanup) => {
        if (!root) return

        const onKeyDown = (event: KeyboardEvent) => {
          if (
            event.defaultPrevented ||
            isBoardInteractiveEventTarget(event.target)
          )
            return
          if (!isEventOwnedByBoardRoot(event.target, root)) return
          if (!event.metaKey && !event.ctrlKey) return

          const key = event.key.toLowerCase()
          const history = getOwnedHistory()
          if (key === 'z') {
            event.preventDefault()
            if (event.shiftKey) history.redo()
            else history.undo()
          } else if (key === 'y') {
            event.preventDefault()
            history.redo()
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
