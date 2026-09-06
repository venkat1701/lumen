import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const listeners = new Set<() => void>()

const current = (): Theme =>
  (document.documentElement.dataset.theme as Theme | undefined) ?? 'light'

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem('lumen.theme', theme) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The theme lives on the document element, which is also where the pre-paint
 *  script in index.html puts it, so there is never a flash on load. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme)
  const toggle = useCallback(() => apply(current() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}
