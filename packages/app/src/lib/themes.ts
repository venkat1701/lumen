import type { SyntaxPalette, SyntaxTheme } from 'lumen-core'

export interface Theme {
  id: string
  name: string
  /** What the theme is derived from, shown as a subtitle in the picker. */
  note: string
  mode: 'light' | 'dark'
  /** A registered theme name, or a palette the compiler builds a theme from. */
  code: string | SyntaxTheme
}

/**
 * One highlight scheme, eight palettes.
 *
 * Editor themes each assign token roles their own way, so adopting them
 * wholesale would give a reader eight unrelated schemes. Lumen fixes the roles
 * and each theme supplies colours for them from its own family:
 *
 *   keyword  violet      string  green      number  orange
 *   function blue        type    yellow     operator cyan
 *   tag      red         comment muted, italic
 *
 * Code then reads the same way in every theme; only the hues change.
 */
const palette = (p: SyntaxPalette): SyntaxPalette => p

const syntax = (name: string, type: 'light' | 'dark', p: SyntaxPalette): SyntaxTheme =>
  ({ name, type, palette: p })

export const THEMES: Theme[] = [
  {
    id: 'paper', name: 'Paper', note: 'Monochrome', mode: 'light',
    code: 'lumen-light',
  },
  {
    id: 'one-light', name: 'One Light', note: 'Atom', mode: 'light',
    code: syntax('lumen-one-light', 'light', palette({
      foreground: '#383a42', comment: '#a0a1a7', keyword: '#a626a4', string: '#50a14f',
      number: '#986801', function: '#4078f2', type: '#c18401', variable: '#383a42',
      operator: '#0184bc', tag: '#e45649',
    })),
  },
  {
    id: 'solarized', name: 'Solarized', note: 'Ethan Schoonover', mode: 'light',
    code: syntax('lumen-solarized', 'light', palette({
      foreground: '#657b83', comment: '#93a1a1', keyword: '#6c71c4', string: '#859900',
      number: '#cb4b16', function: '#268bd2', type: '#b58900', variable: '#657b83',
      operator: '#2aa198', tag: '#dc322f',
    })),
  },
  {
    id: 'ink', name: 'Ink', note: 'Monochrome', mode: 'dark',
    code: 'lumen-dark',
  },
  {
    id: 'tokyo-night', name: 'Tokyo Night', note: 'Enkia', mode: 'dark',
    code: syntax('lumen-tokyo-night', 'dark', palette({
      foreground: '#a9b1d6', comment: '#565f89', keyword: '#bb9af7', string: '#9ece6a',
      number: '#ff9e64', function: '#7aa2f7', type: '#e0af68', variable: '#c0caf5',
      operator: '#89ddff', tag: '#f7768e',
    })),
  },
  {
    id: 'one-dark', name: 'One Dark', note: 'Atom', mode: 'dark',
    code: syntax('lumen-one-dark', 'dark', palette({
      foreground: '#abb2bf', comment: '#5c6370', keyword: '#c678dd', string: '#98c379',
      number: '#d19a66', function: '#61afef', type: '#e5c07b', variable: '#abb2bf',
      operator: '#56b6c2', tag: '#e06c75',
    })),
  },
  {
    id: 'nord', name: 'Nord', note: 'Arctic', mode: 'dark',
    code: syntax('lumen-nord', 'dark', palette({
      foreground: '#d8dee9', comment: '#616e88', keyword: '#b48ead', string: '#a3be8c',
      number: '#d08770', function: '#88c0d0', type: '#ebcb8b', variable: '#d8dee9',
      operator: '#81a1c1', tag: '#bf616a',
    })),
  },
  {
    id: 'gruvbox', name: 'Gruvbox', note: 'Retro groove', mode: 'dark',
    code: syntax('lumen-gruvbox', 'dark', palette({
      foreground: '#ebdbb2', comment: '#928374', keyword: '#d3869b', string: '#b8bb26',
      number: '#fe8019', function: '#83a598', type: '#fabd2f', variable: '#ebdbb2',
      operator: '#8ec07c', tag: '#fb4934',
    })),
  },
]

export const DEFAULT_LIGHT = 'paper'
export const DEFAULT_DARK = 'ink'

const byId = new Map(THEMES.map((theme) => [theme.id, theme]))

export function resolveTheme(id: string | null | undefined): Theme {
  return byId.get(id ?? '') ?? byId.get(DEFAULT_LIGHT)!
}

/** Stable key for the compiler cache and the diagram cache. */
export const codeThemeName = (theme: Theme): string =>
  typeof theme.code === 'string' ? theme.code : theme.code.name
