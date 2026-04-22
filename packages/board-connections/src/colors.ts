export type EdgeColorPreset = '1' | '2' | '3' | '4' | '5' | '6'

export interface EdgeColorOption {
  preset: EdgeColorPreset
  hex: string
  label: string
}

export const EDGE_COLOR_PRESETS: readonly EdgeColorOption[] = [
  { preset: '1', hex: '#e06c6c', label: 'Red' },
  { preset: '2', hex: '#e09a4d', label: 'Orange' },
  { preset: '3', hex: '#d6b64a', label: 'Yellow' },
  { preset: '4', hex: '#4ea371', label: 'Green' },
  { preset: '5', hex: '#4ea8c4', label: 'Cyan' },
  { preset: '6', hex: '#9a6fc4', label: 'Purple' }
] as const

export function colorForPreset(preset: EdgeColorPreset): string {
  return EDGE_COLOR_PRESETS.find((option) => option.preset === preset)?.hex ?? EDGE_COLOR_PRESETS[0]!.hex
}

export function presetForColor(color: string | undefined): EdgeColorPreset | null {
  if (!color) {
    return null
  }
  const normalized = color.toLowerCase()
  return EDGE_COLOR_PRESETS.find((option) => option.hex.toLowerCase() === normalized)?.preset ?? null
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
