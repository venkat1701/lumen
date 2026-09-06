import type { BibEntry } from './bibtex.js'
import {
  defaultMeta, type Diagnostic, type LumenMeta, type OutlineEntry,
  type RegistryEntry, type Severity,
} from './types.js'
import type { EquationLabel } from './normalize.js'

/**
 * State threaded through the pipeline. Plugins read and extend it rather than
 * re-deriving facts about the document, so numbering, cross-references and the
 * outline are all computed from the same single walk of the tree.
 */
export class Context {
  meta: LumenMeta = defaultMeta()
  diagnostics: Diagnostic[] = []
  outline: OutlineEntry[] = []
  registry = new Map<string, RegistryEntry>()
  equationLabels = new Map<number, EquationLabel>()
  bib = new Map<string, BibEntry>()
  /** BibTeX gathered from ```bibtex fences and the `bib` frontmatter field. */
  bibSource = ''
  /** Citation keys in order of first appearance, for numeric styles. */
  citedOrder: string[] = []
  languages = new Set<string>()
  hasDiagrams = false
  /** Set when the document places its own `::: bibliography`. */
  bibliographyPlaced = false
  allowRawHtml = false

  report(
    severity: Severity,
    ruleId: string,
    message: string,
    position?: { start?: { line?: number | null; column?: number | null } } | null,
  ): void {
    this.diagnostics.push({
      severity,
      ruleId,
      message,
      line: position?.start?.line ?? 1,
      column: position?.start?.column ?? 1,
    })
  }

  register(entry: RegistryEntry): void {
    if (this.registry.has(entry.identifier)) {
      this.report('warning', 'duplicate-id', `Two things share the id "${entry.identifier}". References will point at the first.`)
      return
    }
    this.registry.set(entry.identifier, entry)
  }

  citationNumber(key: string): number {
    let index = this.citedOrder.indexOf(key)
    if (index === -1) index = this.citedOrder.push(key) - 1
    return index + 1
  }
}
