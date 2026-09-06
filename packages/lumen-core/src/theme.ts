/**
 * A near-monochrome syntax theme.
 *
 * Off-the-shelf editor themes paint six or seven hues into a code block, which
 * makes it the loudest thing on a page of prose. Lumen uses weight and one ink
 * instead: keywords take the full ink and bold, comments recede, strings take
 * the same blue-black as links, and everything else is body colour.
 */
interface ThemeRule {
  scope: string[]
  settings: { foreground?: string; fontStyle?: string }
}

const COMMENT = ['comment', 'punctuation.definition.comment', 'string.comment']
const KEYWORD = [
  'keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control',
  'keyword.operator.new', 'keyword.operator.expression', 'variable.language',
  'constant.language', 'entity.name.tag',
]
const STRING = ['string', 'string.quoted', 'constant.character', 'constant.other.symbol', 'markup.inserted']
const QUIET = ['punctuation', 'meta.brace', 'keyword.operator', 'punctuation.separator', 'punctuation.terminator']
const NUMBER = ['constant.numeric', 'constant.language.boolean', 'constant.other']

function build(name: string, type: 'light' | 'dark', ink: {
  base: string; strong: string; quiet: string; faint: string; string: string
}) {
  const rules: ThemeRule[] = [
    { scope: COMMENT, settings: { foreground: ink.faint, fontStyle: 'italic' } },
    { scope: KEYWORD, settings: { foreground: ink.strong, fontStyle: 'bold' } },
    { scope: STRING, settings: { foreground: ink.string } },
    { scope: NUMBER, settings: { foreground: ink.strong } },
    { scope: QUIET, settings: { foreground: ink.quiet } },
  ]
  return {
    name,
    type,
    colors: { 'editor.background': '#00000000', 'editor.foreground': ink.base },
    settings: [{ settings: { foreground: ink.base } }, ...rules],
    tokenColors: [{ settings: { foreground: ink.base } }, ...rules],
  }
}

export const lumenLightTheme = build('lumen-light', 'light', {
  base: '#55565c', strong: '#14151a', quiet: '#86878d', faint: '#a0a1a6', string: '#23394f',
})

export const lumenDarkTheme = build('lumen-dark', 'dark', {
  base: '#a4a09a', strong: '#e9e6e1', quiet: '#78746f', faint: '#6b6864', string: '#b0c1d3',
})
