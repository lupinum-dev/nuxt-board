import type { BoardColorPreset } from './types'

export interface BoardColorOption {
  preset: BoardColorPreset
  hex: string
  label: string
}

export const BOARD_COLOR_PRESETS: readonly BoardColorOption[] = [
  { preset: '1', hex: '#e93147', label: 'Red' },
  { preset: '2', hex: '#ec7500', label: 'Orange' },
  { preset: '3', hex: '#e0ac00', label: 'Yellow' },
  { preset: '4', hex: '#08b94e', label: 'Green' },
  { preset: '5', hex: '#00bfbc', label: 'Cyan' },
  { preset: '6', hex: '#7852ee', label: 'Purple' },
] as const

export function isBoardColorPreset(value: unknown): value is BoardColorPreset {
  return (
    typeof value === 'string' &&
    BOARD_COLOR_PRESETS.some((option) => option.preset === value)
  )
}

export function colorForPreset(preset: BoardColorPreset | undefined): string {
  if (!preset) {
    return ''
  }
  return (
    BOARD_COLOR_PRESETS.find((option) => option.preset === preset)?.hex ?? ''
  )
}
