export interface Theme {
  id: string
  name: string
  /** What the theme is derived from, shown as a subtitle in the picker. */
  note: string
  mode: 'light' | 'dark'
  /** Shiki theme used for code blocks. */
  code: string
}

/**
 * Two of these are Lumen's own: near-monochrome pages where colour is spent
 * only on figures. The rest are the editor themes people already read code in,
 * carried through the whole page — links, labels, callouts and diagrams — so a
 * theme is a coherent thing rather than a syntax palette bolted onto a document.
 */
export const THEMES: Theme[] = [
  { id: 'paper', name: 'Paper', note: 'Monochrome', mode: 'light', code: 'lumen-light' },
  { id: 'one-light', name: 'One Light', note: 'Atom', mode: 'light', code: 'one-light' },
  { id: 'solarized', name: 'Solarized', note: 'Ethan Schoonover', mode: 'light', code: 'solarized-light' },
  { id: 'ink', name: 'Ink', note: 'Monochrome', mode: 'dark', code: 'lumen-dark' },
  { id: 'one-dark', name: 'One Dark', note: 'Atom', mode: 'dark', code: 'one-dark-pro' },
  { id: 'nord', name: 'Nord', note: 'Arctic', mode: 'dark', code: 'nord' },
  { id: 'gruvbox', name: 'Gruvbox', note: 'Retro groove', mode: 'dark', code: 'gruvbox-dark-medium' },
]

export const DEFAULT_LIGHT = 'paper'
export const DEFAULT_DARK = 'ink'

const byId = new Map(THEMES.map((theme) => [theme.id, theme]))

export function resolveTheme(id: string | null | undefined): Theme {
  return byId.get(id ?? '') ?? byId.get(DEFAULT_LIGHT)!
}
