import type { BoardColorPreset } from './types.js'

export interface BoardColorOption {
  preset: BoardColorPreset
  hex: string
  label: string
}

export const BOARD_COLOR_PRESETS: readonly BoardColorOption[] = [
  { preset: '1', hex: '#e5476a', label: 'Rose' },
  { preset: '2', hex: '#d97a1c', label: 'Amber' },
  { preset: '3', hex: '#b89a14', label: 'Citron' },
  { preset: '4', hex: '#2fa560', label: 'Moss' },
  { preset: '5', hex: '#3b7de0', label: 'Azure' },
  { preset: '6', hex: '#7e5ae4', label: 'Violet' },
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
