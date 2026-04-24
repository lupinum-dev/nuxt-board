import {
  BOARD_COLOR_PRESETS,
  colorForPreset,
  type BoardColorPreset,
} from '@lupinum/board-core'

export { BOARD_COLOR_PRESETS, colorForPreset }
export type { BoardColorPreset }

export function resolveNodeColorStyle(
  color: BoardColorPreset | undefined,
): Record<string, string> {
  const hex = colorForPreset(color)
  if (!hex) {
    return {}
  }
  return {
    '--board-node-color': hex,
    '--board-node-tint': `color-mix(in srgb, ${hex} 7%, var(--board-node-bg, #fff))`,
    '--board-node-tint-strong': `color-mix(in srgb, ${hex} 13%, var(--board-node-bg, #fff))`,
    '--board-node-color-soft': `color-mix(in srgb, ${hex} 24%, transparent)`,
    '--board-node-color-ring': `color-mix(in srgb, ${hex} 70%, transparent)`,
  }
}
