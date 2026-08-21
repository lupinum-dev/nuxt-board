import { h, type VNode } from 'vue'
import type { CanvasColor, Point } from '@lupinum/board-core'
import { EDGE_COLOR_PRESETS, resolvePresetColor } from './colors.js'
import type { BoardEdge } from './types.js'

const TOOLBAR_ICON_SIZE = 24

export interface ConnectionToolbarOptions {
  edge: BoardEdge
  screen: Point
  colorMenuOpen: boolean
  directionMenuOpen: boolean
  onDelete: () => void
  onToggleColorMenu: () => void
  onToggleDirectionMenu: () => void
  onSetColor: (color: CanvasColor | undefined) => void
  onSetDirectionality: (direction: 'none' | 'to' | 'both') => void
  onResetAnchor: (end: 'from' | 'to' | 'both') => void
  onClearLabel: () => void
  onBeginLabelEdit: () => void
}

/** Render the selected-edge toolbar without owning connection domain state. */
export function renderConnectionToolbar(
  options: ConnectionToolbarOptions,
): VNode {
  const edgeId = String(options.edge.id)
  const screen = options.screen
  const callbacks = options
  const currentColor = options.edge.color
  const hasFromAnchor = Boolean(options.edge.fromAnchor)
  const hasToAnchor = Boolean(options.edge.toAnchor)
  const hasManualAnchor = hasFromAnchor || hasToAnchor
  const from = options.edge.fromEnd ?? 'none'
  const to = options.edge.toEnd ?? 'arrow'
  const activeDirection =
    from === 'arrow' && to === 'arrow'
      ? 'both'
      : from === 'none' && to === 'none'
        ? 'none'
        : 'to'
  const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    padding: '0',
    border: 'none',
    background: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: '1',
    color: 'var(--board-muted-fg, #6b7280)',
  } as const

  const swatchStyle = (hex: string, active: boolean) =>
    ({
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: hex,
      border: active
        ? '2px solid var(--board-fg, #0f172a)'
        : '1px solid rgba(15, 23, 42, 0.15)',
      cursor: 'pointer',
      padding: '0',
      boxSizing: 'border-box',
    }) as const

  const renderIcon = (
    paths: string[],
    options?: { viewBox?: string; fill?: string },
  ) =>
    h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: TOOLBAR_ICON_SIZE,
        height: TOOLBAR_ICON_SIZE,
        viewBox: options?.viewBox ?? '0 0 24 24',
        fill: options?.fill ?? 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      paths.map((d) => h('path', { d })),
    )

  const toolbarButton = (
    title: string,
    icon: ReturnType<typeof h>,
    onClick: (event: MouseEvent) => void,
    options?: { disabled?: boolean; danger?: boolean; testId?: string },
  ) =>
    h(
      'button',
      {
        'data-board-interactive': 'true',
        ...(options?.testId ? { [options.testId]: edgeId } : {}),
        type: 'button',
        title,
        'aria-label': title,
        disabled: options?.disabled,
        style: {
          ...buttonStyle,
          opacity: options?.disabled ? '0.38' : '1',
          color: options?.danger ? '#b45353' : 'var(--board-muted-fg, #6b7280)',
          cursor: options?.disabled ? 'default' : 'pointer',
        },
        onClick,
      },
      [icon],
    )

  const divider = () =>
    h('span', {
      style: {
        display: 'inline-block',
        width: '1px',
        height: '22px',
        background: 'rgba(15,23,42,0.12)',
        margin: '0 2px',
      },
    })
  const directionItem = (
    label: string,
    icon: ReturnType<typeof h>,
    direction: 'none' | 'to' | 'both',
  ) =>
    h(
      'button',
      {
        'data-board-interactive': 'true',
        'data-connection-direction-option': direction,
        type: 'button',
        title: label,
        'aria-label': label,
        style: {
          display: 'grid',
          gridTemplateColumns: '32px 1fr 24px',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          minWidth: '250px',
          height: '42px',
          padding: '0 12px',
          border: 'none',
          borderRadius: '7px',
          background:
            activeDirection === direction
              ? 'rgba(107, 114, 128, 0.16)'
              : 'transparent',
          color: 'var(--board-fg, #111827)',
          cursor: 'pointer',
          font: 'inherit',
          fontSize: '18px',
          lineHeight: '1',
          textAlign: 'left',
        },
        onClick: (event: MouseEvent) => {
          event.preventDefault()
          event.stopPropagation()
          callbacks.onSetDirectionality(direction)
        },
      },
      [
        h('span', { style: { color: 'var(--board-muted-fg, #6b7280)' } }, [
          icon,
        ]),
        h('span', label),
        activeDirection === direction
          ? renderIcon(['m20 6-11 11-5-5'])
          : h('span'),
      ],
    )

  return h(
    'div',
    {
      'data-board-interactive': 'true',
      'data-connection-toolbar': edgeId,
      onPointerdown: (event: PointerEvent) => event.stopPropagation(),
      style: {
        position: 'absolute',
        left: `${screen.x}px`,
        top: `${screen.y}px`,
        transform: 'translate(-50%, calc(-100% - 14px))',
        zIndex: '7',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '5px',
        background: 'var(--board-node-bg, #ffffff)',
        border: '1px solid var(--board-node-border, rgba(15,23,42,0.1))',
        borderRadius: '6px',
        boxShadow:
          '0 4px 14px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.08)',
        fontSize: '12px',
        color: 'var(--board-fg, #0f172a)',
        whiteSpace: 'nowrap',
        pointerEvents: 'auto',
        userSelect: 'none',
      },
    },
    [
      toolbarButton(
        'Remove',
        renderIcon([
          'M10 11v6',
          'M14 11v6',
          'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
          'M3 6h18',
          'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
        ]),
        (event) => {
          event.preventDefault()
          event.stopPropagation()
          callbacks.onDelete()
        },
        { danger: true },
      ),
      h(
        'div',
        {
          style: {
            position: 'relative',
            display: 'inline-flex',
          },
        },
        [
          toolbarButton(
            'Set colour',
            renderIcon([
              'M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z',
              'M13.5 6.5h.01',
              'M17.5 10.5h.01',
              'M6.5 12.5h.01',
              'M8.5 7.5h.01',
            ]),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              callbacks.onToggleColorMenu()
            },
          ),
          options.colorMenuOpen
            ? h(
                'div',
                {
                  'data-board-interactive': 'true',
                  'data-connection-color-menu': edgeId,
                  style: {
                    position: 'absolute',
                    left: '50%',
                    top: 'calc(100% + 8px)',
                    transform: 'translateX(-50%)',
                    zIndex: '1',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 20px)',
                    gap: '8px',
                    padding: '8px',
                    background: 'var(--board-node-bg, #ffffff)',
                    border:
                      '1px solid var(--board-node-border, rgba(15,23,42,0.1))',
                    borderRadius: '6px',
                    boxShadow:
                      '0 6px 18px rgba(15, 23, 42, 0.14), 0 1px 2px rgba(15, 23, 42, 0.08)',
                  },
                },
                [
                  h('button', {
                    'data-board-interactive': 'true',
                    type: 'button',
                    title: 'Default color',
                    style: {
                      ...swatchStyle('transparent', !currentColor),
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(148,163,184,0.35) 0 3px, transparent 3px 6px)',
                    },
                    onClick: (event: MouseEvent) => {
                      event.preventDefault()
                      event.stopPropagation()
                      callbacks.onSetColor(undefined)
                    },
                  }),
                  ...EDGE_COLOR_PRESETS.map((option) =>
                    h('button', {
                      'data-board-interactive': 'true',
                      type: 'button',
                      title: option.label,
                      style: swatchStyle(
                        option.hex,
                        resolvePresetColor(currentColor) === option.hex,
                      ),
                      onClick: (event: MouseEvent) => {
                        event.preventDefault()
                        event.stopPropagation()
                        callbacks.onSetColor(option.hex as CanvasColor)
                      },
                    }),
                  ),
                ],
              )
            : null,
        ],
      ),
      divider(),
      h(
        'div',
        {
          style: {
            position: 'relative',
            display: 'inline-flex',
          },
        },
        [
          toolbarButton(
            'Line direction',
            renderIcon(['M5 12h14', 'm12 5 7 7-7 7']),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              callbacks.onToggleDirectionMenu()
            },
            { testId: 'data-connection-direction-menu-button' },
          ),
          options.directionMenuOpen
            ? h(
                'div',
                {
                  'data-board-interactive': 'true',
                  'data-connection-direction-menu': edgeId,
                  style: {
                    position: 'absolute',
                    left: '50%',
                    top: 'calc(100% + 8px)',
                    transform: 'translateX(-50%)',
                    zIndex: '1',
                    display: 'grid',
                    gap: '2px',
                    padding: '8px',
                    background: 'var(--board-node-bg, #ffffff)',
                    border:
                      '1px solid var(--board-node-border, rgba(15,23,42,0.1))',
                    borderRadius: '8px',
                    boxShadow:
                      '0 8px 22px rgba(15, 23, 42, 0.16), 0 1px 2px rgba(15, 23, 42, 0.08)',
                  },
                },
                [
                  directionItem(
                    'Nondirectional',
                    renderIcon(['M5 12h14']),
                    'none',
                  ),
                  directionItem(
                    'Unidirectional',
                    renderIcon(['M5 12h14', 'm12 5 7 7-7 7']),
                    'to',
                  ),
                  directionItem(
                    'Bidirectional',
                    renderIcon(['M7 7 3 12l4 5', 'M17 7l4 5-4 5', 'M4 12h16']),
                    'both',
                  ),
                ],
              )
            : null,
        ],
      ),
      hasManualAnchor ? divider() : null,
      hasFromAnchor
        ? toolbarButton(
            'Reset source anchor to auto',
            renderIcon([
              'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
              'M21 3v5h-5',
              'M12 7v5l3 3',
            ]),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              callbacks.onResetAnchor('from')
            },
            { testId: 'data-connection-reset-source-anchor' },
          )
        : null,
      hasToAnchor
        ? toolbarButton(
            'Reset target anchor to auto',
            renderIcon([
              'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
              'M3 21v-5h5',
              'M12 7v5l3 3',
            ]),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              callbacks.onResetAnchor('to')
            },
            { testId: 'data-connection-reset-target-anchor' },
          )
        : null,
      hasFromAnchor && hasToAnchor
        ? toolbarButton(
            'Reset connection to auto',
            renderIcon([
              'M4 4v6h6',
              'M20 20v-6h-6',
              'M20 9A8 8 0 0 0 6.3 4.7L4 7',
              'M4 15a8 8 0 0 0 13.7 4.3L20 17',
            ]),
            (event) => {
              event.preventDefault()
              event.stopPropagation()
              callbacks.onResetAnchor('both')
            },
            { testId: 'data-connection-reset-all-anchors' },
          )
        : null,
      toolbarButton(
        'Remove label',
        renderIcon(['M3 3h18v18H3z', 'm15 9-6 6', 'm9 9 6 6']),
        (event) => {
          event.preventDefault()
          event.stopPropagation()
          callbacks.onClearLabel()
        },
        {
          disabled: !options.edge.label,
          testId: 'data-connection-remove-label',
        },
      ),
      toolbarButton(
        'Edit label',
        renderIcon([
          'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
          'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z',
        ]),
        (event) => {
          event.preventDefault()
          event.stopPropagation()
          callbacks.onBeginLabelEdit()
        },
      ),
    ],
  )
}
