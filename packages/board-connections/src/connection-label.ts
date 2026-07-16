import { defineComponent, h, type PropType } from 'vue'
import type { Point } from '@lupinum/board-core'
import {
  EDGE_LABEL_ACTIVE_FONT_SIZE,
  EDGE_LABEL_ACTIVE_HEIGHT,
  EDGE_LABEL_HORIZONTAL_PADDING,
  EDGE_LABEL_IDLE_HEIGHT,
  EDGE_LABEL_MAX_SCREEN_WIDTH,
  EDGE_LABEL_MIN_ZOOM,
  EDGE_LABEL_SCREEN_FONT_SIZE,
} from './layer-helpers.js'

/** SVG foreign-object label editor used by the connection render shell. */
export const ConnectionLabel = defineComponent({
  name: 'ConnectionLabel',
  props: {
    edgeId: { type: String, required: true },
    point: { type: Object as PropType<Point>, required: true },
    label: { type: String, default: '' },
    color: { type: String, default: 'var(--board-edge-color)' },
    zoom: { type: Number, required: true },
    selected: { type: Boolean, default: false },
    hovered: { type: Boolean, default: false },
    editing: { type: Boolean, default: false },
    draft: { type: String, default: '' },
  },
  emits: {
    edgePointerDown: (_edgeId: string, _event: PointerEvent) => true,
    beginEdit: (_edgeId: string) => true,
    updateDraft: (_value: string) => true,
    commitEdit: () => true,
    cancelEdit: () => true,
  },
  setup(props, { emit }) {
    return () => {
      if (!props.editing && !props.label) return null

      const active = props.editing || props.selected || props.hovered
      const labelZoom = Math.max(props.zoom, EDGE_LABEL_MIN_ZOOM)
      const size = 1 / labelZoom
      const content = props.editing ? props.draft : props.label
      const approximateWidth = Math.max(
        active ? 40 : 24,
        Math.min(
          EDGE_LABEL_MAX_SCREEN_WIDTH,
          (content.length || 1) * 8 + EDGE_LABEL_HORIZONTAL_PADDING,
        ),
      )
      const approximateHeight = active
        ? EDGE_LABEL_ACTIVE_HEIGHT
        : EDGE_LABEL_IDLE_HEIGHT
      const width = approximateWidth * size
      const height = approximateHeight * size

      const contents = props.editing
        ? h('input', {
            'data-connection-label-input': props.edgeId,
            'data-board-interactive': 'true',
            'data-connection-edge-id': props.edgeId,
            type: 'text',
            value: props.draft,
            onInput: (event: Event) =>
              emit('updateDraft', (event.target as HTMLInputElement).value),
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                emit('commitEdit')
              } else if (event.key === 'Escape') {
                event.preventDefault()
                emit('cancelEdit')
              }
              event.stopPropagation()
            },
            onBlur: () => emit('commitEdit'),
            onPointerdown: (event: PointerEvent) => event.stopPropagation(),
            style: {
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              padding: '2px 8px',
              borderRadius: '999px',
              border: '1px solid currentColor',
              background: 'var(--board-node-bg, #fff)',
              color: 'inherit',
              font: 'inherit',
              fontSize: `${EDGE_LABEL_ACTIVE_FONT_SIZE}px`,
              lineHeight: '1',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            },
          })
        : h(
            'div',
            {
              'data-connection-label': props.edgeId,
              'data-board-interactive': 'true',
              'data-connection-edge-id': props.edgeId,
              title: props.label,
              onPointerdown: (event: PointerEvent) =>
                emit('edgePointerDown', props.edgeId, event),
              onDblclick: (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                emit('beginEdit', props.edgeId)
              },
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: active ? '2px 8px' : '0 3px',
                maxWidth: `${EDGE_LABEL_MAX_SCREEN_WIDTH}px`,
                borderRadius: '999px',
                border: active
                  ? '1px solid currentColor'
                  : '1px solid transparent',
                background: active
                  ? 'var(--board-node-bg, #fff)'
                  : 'transparent',
                fontSize: `${active ? EDGE_LABEL_ACTIVE_FONT_SIZE : EDGE_LABEL_SCREEN_FONT_SIZE}px`,
                lineHeight: active ? '1' : '1.2',
                fontWeight: active ? '500' : '600',
                color: 'inherit',
                cursor: 'text',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textShadow: active
                  ? 'none'
                  : '0 1px 0 var(--board-node-bg, #fff), 0 -1px 0 var(--board-node-bg, #fff), 1px 0 0 var(--board-node-bg, #fff), -1px 0 0 var(--board-node-bg, #fff)',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              },
            },
            props.label || '\u00A0',
          )

      return h(
        'foreignObject',
        {
          x: props.point.x - width / 2,
          y: props.point.y - height / 2,
          width,
          height,
          color: props.color,
          style: { overflow: 'visible', pointerEvents: 'auto' },
        },
        [
          h(
            'div',
            {
              xmlns: 'http://www.w3.org/1999/xhtml',
              style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              },
            },
            [
              h(
                'div',
                {
                  style: {
                    width: `${approximateWidth}px`,
                    height: `${approximateHeight}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                },
                [contents],
              ),
            ],
          ),
        ],
      )
    }
  },
})
