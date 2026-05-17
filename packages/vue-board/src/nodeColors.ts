import {
  BOARD_COLOR_PRESETS,
  colorForPreset,
  type BoardColorPreset,
  type CanvasColor,
} from '@lupinum/board-core'

export { BOARD_COLOR_PRESETS, colorForPreset }
export type { BoardColorPreset }

/**
 * Emits CSS custom properties for a node's color preset. The primary color
 * resolves through `--board-preset-${preset}` so theme.css can swap light/dark
 * values without touching node inline styles. The hex from board-core is the
 * SSR fallback for consumers that haven't loaded theme.css yet.
 */
export function resolveNodeColorStyle(
  color: CanvasColor | undefined,
): Record<string, string> {
  if (!color) {
    return {}
  }
  const hex = color.startsWith('#')
    ? color
    : colorForPreset(color as BoardColorPreset)
  if (!hex) return {}
  const themed = `var(--board-preset-${color}, ${hex})`
  return {
    '--board-node-color': themed,
    '--board-node-tint': `color-mix(in srgb, ${themed} 7%, var(--board-node-bg, #fff))`,
    '--board-node-tint-strong': `color-mix(in srgb, ${themed} 13%, var(--board-node-bg, #fff))`,
    '--board-node-color-soft': `color-mix(in srgb, ${themed} 24%, transparent)`,
    '--board-node-color-ring': `color-mix(in srgb, ${themed} 70%, transparent)`,
  }
}
