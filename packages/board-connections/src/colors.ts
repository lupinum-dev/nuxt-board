import {
  BOARD_COLOR_PRESETS,
  colorForPreset as coreColorForPreset,
  type BoardColorOption,
  type BoardColorPreset,
} from '@lupinum/board-core'

/** JSON Canvas color preset shared by nodes and edges. */
export type EdgeColorPreset = BoardColorPreset
/** Edge-facing alias for the canonical board color option. */
export type EdgeColorOption = BoardColorOption

/** Canonical JSON Canvas palette; edges and nodes intentionally share semantics. */
export const EDGE_COLOR_PRESETS: readonly EdgeColorOption[] =
  BOARD_COLOR_PRESETS

export function colorForPreset(preset: EdgeColorPreset): string {
  return coreColorForPreset(preset)
}

export function presetForColor(
  color: string | undefined,
): EdgeColorPreset | null {
  if (!color) {
    return null
  }
  const normalized = color.toLowerCase()
  return (
    EDGE_COLOR_PRESETS.find((option) => option.hex.toLowerCase() === normalized)
      ?.preset ?? null
  )
}

export function resolvePresetColor(color: string | undefined): string {
  if (!color) {
    return ''
  }
  if (/^[1-6]$/.test(color)) {
    return colorForPreset(color as EdgeColorPreset)
  }
  return color
}
