/**
 * Syntax themes, authored rather than borrowed.
 *
 * Every editor theme assigns token roles differently — one paints functions
 * blue, another paints them yellow — so importing seven of them wholesale
 * gives a reader seven unrelated schemes. Lumen defines the scope-to-role
 * mapping once, here, and a theme supplies only the colours for those roles.
 * Code then reads the same way whatever palette it is set in.
 */

export interface SyntaxPalette {
  /** Everything not otherwise claimed: identifiers, parameters, plain text. */
  foreground: string
  comment: string
  /** Keywords, storage, control flow, language constants. */
  keyword: string
  string: string
  /** Numbers, booleans, and library constants. */
  number: string
  function: string
  /** Types, classes, and the things you declare with them. */
  type: string
  /** Declared names, distinct from the identifiers that merely use them. */
  variable: string
  /** Operators, braces, separators — the connective tissue. */
  operator: string
  /** Markup tags and attribute names. */
  tag: string
}

export interface SyntaxTheme {
  name: string
  type: 'light' | 'dark'
  palette: SyntaxPalette
  /** Set keywords in bold. Monochrome palettes rely on it; colour ones don't. */
  boldKeywords?: boolean
}

const SCOPES: Array<[keyof SyntaxPalette, string[]]> = [
  ['comment', ['comment', 'punctuation.definition.comment', 'string.comment']],
  ['keyword', [
    'keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control',
    'keyword.operator.new', 'keyword.operator.expression', 'keyword.other',
    'constant.language', 'variable.language', 'markup.bold',
  ]],
  ['string', [
    'string', 'string.quoted', 'constant.character', 'constant.other.symbol',
    'punctuation.definition.string', 'markup.inserted',
  ]],
  ['number', [
    'constant.numeric', 'constant.language.boolean', 'constant.other',
    'support.constant', 'constant.character.escape',
  ]],
  ['function', [
    'entity.name.function', 'support.function', 'meta.function-call',
    'variable.function', 'meta.function-call.generic',
  ]],
  ['type', [
    'entity.name.type', 'entity.name.class', 'entity.name.namespace',
    'support.type', 'support.class', 'entity.other.inherited-class',
    'storage.type.class', 'meta.type',
  ]],
  ['variable', [
    'variable.other.definition', 'meta.definition.variable', 'variable.parameter',
    'entity.name.variable', 'meta.object-literal.key', 'support.variable.property',
  ]],
  ['operator', [
    'keyword.operator', 'punctuation', 'meta.brace', 'punctuation.separator',
    'punctuation.terminator', 'punctuation.accessor',
  ]],
  ['tag', [
    'entity.name.tag', 'entity.other.attribute-name', 'support.type.property-name',
    'markup.heading', 'meta.tag',
  ]],
]

export function buildSyntaxTheme({ name, type, palette, boldKeywords }: SyntaxTheme) {
  const rules = SCOPES.map(([role, scope]) => ({
    scope,
    settings: {
      foreground: palette[role],
      ...(role === 'comment' ? { fontStyle: 'italic' } : {}),
      ...(role === 'keyword' && boldKeywords ? { fontStyle: 'bold' } : {}),
    },
  }))
  const base = { settings: { foreground: palette.foreground } }
  return {
    name,
    type,
    colors: { 'editor.background': '#00000000', 'editor.foreground': palette.foreground },
    settings: [base, ...rules],
    tokenColors: [base, ...rules],
  }
}

/** Lumen's own pair: weight and one ink, so code never shouts over prose. */
export const lumenLightTheme = buildSyntaxTheme({
  name: 'lumen-light',
  type: 'light',
  boldKeywords: true,
  palette: {
    foreground: '#55565c', comment: '#a0a1a6', keyword: '#14151a', string: '#23394f',
    number: '#14151a', function: '#55565c', type: '#14151a', variable: '#55565c',
    operator: '#86878d', tag: '#14151a',
  },
})

export const lumenDarkTheme = buildSyntaxTheme({
  name: 'lumen-dark',
  type: 'dark',
  boldKeywords: true,
  palette: {
    foreground: '#a4a09a', comment: '#6b6864', keyword: '#e9e6e1', string: '#b0c1d3',
    number: '#e9e6e1', function: '#a4a09a', type: '#e9e6e1', variable: '#a4a09a',
    operator: '#78746f', tag: '#e9e6e1',
  },
})
