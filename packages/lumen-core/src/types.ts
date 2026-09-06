import type { Root as HastRoot } from 'hast'
import type { Parent, PhrasingContent, RootContent } from 'mdast'

/* ------------------------------------------------------------------ *
 * Diagnostics
 * ------------------------------------------------------------------ */

export type Severity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  severity: Severity
  /** Stable machine-readable identifier, e.g. `xref-unresolved`. */
  ruleId: string
  message: string
  line: number
  column: number
}

/* ------------------------------------------------------------------ *
 * Frontmatter
 * ------------------------------------------------------------------ */

export interface Author {
  name: string
  affiliation?: string
  email?: string
  orcid?: string
}

export type CounterMode = 'continuous' | 'section' | 'off'
export type EquationMode = 'all' | 'labeled' | 'off'

export interface NumberingConfig {
  theorem: CounterMode
  figure: CounterMode
  table: CounterMode
  equation: EquationMode
  /** `shared`: one counter across theorem-like kinds (AMS convention). */
  theoremStyle: 'shared' | 'per-type'
}

export interface LumenMeta {
  title?: string
  subtitle?: string
  authors: Author[]
  date?: string
  abstract?: string
  bib?: string
  citationStyle: 'numeric' | 'author-year'
  numbering: NumberingConfig
  macros: Record<string, string>
  toc: boolean
  lang: string
}

export const defaultNumbering: NumberingConfig = {
  theorem: 'section',
  figure: 'continuous',
  table: 'continuous',
  equation: 'labeled',
  theoremStyle: 'shared',
}

export const defaultMeta = (): LumenMeta => ({
  authors: [],
  citationStyle: 'numeric',
  numbering: { ...defaultNumbering },
  macros: {},
  toc: true,
  lang: 'en',
})

/* ------------------------------------------------------------------ *
 * Block kinds
 * ------------------------------------------------------------------ */

export const THEOREM_KINDS = [
  'theorem', 'lemma', 'corollary', 'proposition', 'definition',
  'example', 'remark', 'conjecture', 'axiom',
] as const

export const CALLOUT_KINDS = ['note', 'tip', 'warning', 'important', 'caution'] as const

export type TheoremKind = (typeof THEOREM_KINDS)[number]
export type CalloutKind = (typeof CALLOUT_KINDS)[number]
export type BlockKind =
  | TheoremKind | CalloutKind
  | 'callout'
  | 'proof' | 'abstract' | 'figure' | 'table' | 'equation'
  | 'aside' | 'bibliography' | 'unknown'

/** Display names, capitalised per journal convention. */
export const KIND_LABELS: Record<string, string> = {
  theorem: 'Theorem', lemma: 'Lemma', corollary: 'Corollary',
  proposition: 'Proposition', definition: 'Definition', example: 'Example',
  remark: 'Remark', conjecture: 'Conjecture', axiom: 'Axiom',
  proof: 'Proof', figure: 'Figure', table: 'Table', equation: 'Eq.',
  section: 'Section', note: 'Note', tip: 'Tip', warning: 'Warning',
  important: 'Important', caution: 'Caution', abstract: 'Abstract',
  aside: 'Aside',
}

export const isTheoremKind = (k: string): k is TheoremKind =>
  (THEOREM_KINDS as readonly string[]).includes(k)
export const isCalloutKind = (k: string): k is CalloutKind =>
  (CALLOUT_KINDS as readonly string[]).includes(k)

/* ------------------------------------------------------------------ *
 * Custom mdast nodes
 * ------------------------------------------------------------------ */

export interface LumenBlock extends Parent {
  type: 'lumenBlock'
  kind: BlockKind
  /** Original directive name, so `note` survives the mapping to `callout`. */
  variant?: string
  title?: PhrasingContent[]
  identifier?: string
  attributes: Record<string, string>
  number?: string
  caption?: PhrasingContent[]
  children: RootContent[]
}

export interface XrefTarget {
  identifier: string
  resolved?: { kind: string; number?: string; title?: string }
}

export interface LumenXref extends Parent {
  type: 'lumenXref'
  targets: XrefTarget[]
  /** `-@id` — render the bare number without the kind label. */
  numberOnly: boolean
  raw: string
  children: []
}

export interface CiteItem {
  key: string
  prefix?: string
  suffix?: string
}

export interface LumenCite extends Parent {
  type: 'lumenCite'
  items: CiteItem[]
  /** `@key` outside brackets: "Fick [1]" rather than "[1]". */
  narrative: boolean
  children: []
}

export interface LumenDiagram extends Parent {
  type: 'lumenDiagram'
  lang: string
  value: string
  identifier?: string
  children: []
}

export interface LumenBibliography extends Parent {
  type: 'lumenBibliography'
  children: []
}

declare module 'mdast' {
  interface RootContentMap {
    lumenBlock: LumenBlock
    lumenXref: LumenXref
    lumenCite: LumenCite
    lumenDiagram: LumenDiagram
    lumenBibliography: LumenBibliography
  }
  interface PhrasingContentMap {
    lumenXref: LumenXref
    lumenCite: LumenCite
  }
  interface BlockContentMap {
    lumenBlock: LumenBlock
    lumenDiagram: LumenDiagram
    lumenBibliography: LumenBibliography
  }
}

/* ------------------------------------------------------------------ *
 * Compile surface
 * ------------------------------------------------------------------ */

export interface OutlineEntry {
  id: string
  depth: number
  text: string
  number?: string
  line: number
}

export interface RegistryEntry {
  identifier: string
  kind: string
  number?: string
  title?: string
}

export interface CompileOptions {
  /** Permit literal HTML from the source document. Off by default. */
  allowRawHtml?: boolean
  /** Syntax highlighting. Disable in environments without Shiki. */
  highlight?: boolean
  /** Shiki theme for code blocks: a bundled name, or one of Lumen's own
   *  near-monochrome pair, `lumen-light` and `lumen-dark`. */
  codeTheme?: string
  /** Emit an HTML string alongside the hast tree. */
  stringify?: boolean
  /** Extra BibTeX, used when the document references an external file. */
  bibliography?: string
}

export interface CompileResult {
  tree: HastRoot
  html?: string
  meta: LumenMeta
  diagnostics: Diagnostic[]
  outline: OutlineEntry[]
  registry: RegistryEntry[]
  /** Source line -> nearest top-level element index, for scroll sync. */
  lineMap: Array<{ line: number; index: number }>
  hasDiagrams: boolean
  languages: string[]
}
