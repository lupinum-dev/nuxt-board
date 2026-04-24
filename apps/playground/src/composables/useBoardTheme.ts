import { onBeforeUnmount, onMounted, ref } from 'vue'

export type BoardTheme = 'light' | 'dark'

const STORAGE_KEY = 'board-theme'

function readStoredTheme(): BoardTheme | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

function systemPreference(): BoardTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function useBoardTheme(): {
  theme: ReturnType<typeof ref<BoardTheme>>
  toggle: () => void
  set: (value: BoardTheme) => void
} {
  const theme = ref<BoardTheme>('light')

  function apply(next: BoardTheme): void {
    theme.value = next
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = next
      document.documentElement.style.colorScheme = next
    }
  }

  function set(next: BoardTheme): void {
    apply(next)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next)
    }
  }

  function toggle(): void {
    set(theme.value === 'dark' ? 'light' : 'dark')
  }

  let media: MediaQueryList | null = null
  function onSystemChange(event: MediaQueryListEvent): void {
    if (readStoredTheme() === null) {
      apply(event.matches ? 'dark' : 'light')
    }
  }

  onMounted(() => {
    apply(readStoredTheme() ?? systemPreference())
    if (typeof window !== 'undefined' && window.matchMedia) {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', onSystemChange)
    }
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', onSystemChange)
  })

  return { theme, toggle, set }
}
