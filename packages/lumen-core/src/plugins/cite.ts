import { visit } from 'unist-util-visit'
import type { LinkReference, Parent, Root, Text } from 'mdast'
import type { Context } from '../context.js'
import { parseBibtex } from '../bibtex.js'
import type { CiteItem, LumenCite } from '../types.js'

/** A bracketed citation, or a bare `@key` used in the run of a sentence. */
const CITE = /\[([^[\]]*@[^[\]]*)\]|(?<![\\\w@.[])@([A-Za-z][A-Za-z0-9_.+-]*)/g

function parseLabel(label: string, narrative: boolean): CiteItem[] {
  return label.split(';').flatMap((part): CiteItem[] => {
    const at = part.indexOf('@')
    if (at === -1) return []
    const prefix = part.slice(0, at).trim()
    const match = /^([A-Za-z][A-Za-z0-9_.+:-]*)\s*(?:,\s*([\s\S]*))?$/.exec(part.slice(at + 1).trim())
    if (!match) return []
    return [{
      key: match[1],
      prefix: narrative ? undefined : prefix || undefined,
      suffix: match[2]?.trim() || undefined,
    }]
  })
}

export function remarkLumenCite(context: Context, extraBibliography?: string) {
  return (tree: Root) => {
    const sources = [context.bibSource, extraBibliography ?? '']
    // `bib:` holds BibTeX directly when it isn't a path to a file.
    if (context.meta.bib?.includes('@')) sources.push(context.meta.bib)
    context.bib = parseBibtex(sources.join('\n'))

    const record = (items: CiteItem[], position: Text['position']) => {
      for (const item of items) {
        if (!context.bib.has(item.key)) {
          context.report('error', 'citation-unknown', `No bibliography entry for "${item.key}".`, position)
        }
        context.citationNumber(item.key)
      }
    }

    // `[@key]` usually parses as a shortcut link reference.
    visit(tree, 'linkReference', (node: LinkReference, index, parent) => {
      if (!parent || typeof index !== 'number') return
      const label = node.label ?? node.identifier
      if (!label?.includes('@')) return
      const items = parseLabel(label, false)
      if (items.length === 0) return
      record(items, node.position)
      const cite: LumenCite = { type: 'lumenCite', items, narrative: false, children: [], position: node.position }
      parent.children[index] = cite
    })

    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (!node.value.includes('@')) return

      CITE.lastIndex = 0
      const replacement: Array<Text | LumenCite> = []
      let cursor = 0
      let match: RegExpExecArray | null

      while ((match = CITE.exec(node.value))) {
        const [raw, bracketed, bare] = match
        const narrative = bracketed === undefined
        const items = parseLabel(narrative ? `@${bare}` : bracketed, narrative)
        if (items.length === 0) continue
        record(items, node.position)

        if (match.index > cursor) {
          replacement.push({ type: 'text', value: node.value.slice(cursor, match.index) })
        }
        replacement.push({ type: 'lumenCite', items, narrative, children: [], position: node.position })
        cursor = match.index + raw.length
      }

      if (replacement.length === 0) return
      if (cursor < node.value.length) {
        replacement.push({ type: 'text', value: node.value.slice(cursor) })
      }
      ;(parent as Parent).children.splice(index, 1, ...(replacement as never[]))
      return index + replacement.length
    })

    // `\@` is how you write a literal at-sign; the backslash has done its job.
    visit(tree, 'text', (node: Text) => {
      if (node.value.includes('\\@')) node.value = node.value.replace(/\\@/g, '@')
    })

    if (context.citedOrder.length > 0 && !context.bibliographyPlaced) {
      tree.children.push({ type: 'lumenBibliography', children: [] })
    }
  }
}
