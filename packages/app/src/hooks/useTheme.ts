import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_DARK, DEFAULT_LIGHT, resolveTheme, type Theme } from '../lib/themes.js'

const KEY = 'lumen.theme'
const listeners = new Set<() => void>()

const currentId = (): string => document.documentElement.dataset.theme ?? DEFAULT_LIGHT

export function applyTheme(id: string): void {
  const theme = resolveTheme(id)
  document.documentElement.dataset.theme = theme.id
  document.documentElement.dataset.mode = theme.mode
  try { localStorage.setItem(KEY, id) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * The theme lives on the document element, which is where the pre-paint script
 * in index.html also puts it, so the page never flashes the wrong palette.
 */
export function useTheme(): { theme: Theme; setTheme: (id: string) => void; toggle: () => void } {
  const id = useSyncExternalStore(subscribe, currentId, () => DEFAULT_LIGHT)
  const theme = resolveTheme(id)
  const setTheme = useCallback((next: string) => applyTheme(next), [])
  // Kept for the keyboard shortcut: flip between the two monochrome themes.
  const toggle = useCallback(
    () => applyTheme(resolveTheme(currentId()).mode === 'dark' ? DEFAULT_LIGHT : DEFAULT_DARK),
    [],
  )
  return { theme, setTheme, toggle }
}
