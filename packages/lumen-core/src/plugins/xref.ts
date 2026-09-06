import { visit } from 'unist-util-visit'
import type { Parent, Root, Text } from 'mdast'
import type { Context } from '../context.js'
import type { LumenXref, XrefTarget } from '../types.js'

/**
 * `@thm:cs` and `-@thm:cs`. The colon is what separates a cross-reference from
 * a citation key, and the leading boundary check is what keeps email addresses
 * and handles intact.
 */
const NAME = String.raw`[a-z][a-z0-9]*:[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*`
const XREF = new RegExp(String.raw`(?<![\\\w@.])(-?)@(${NAME}(?:\s*,\s*${NAME})*)`, 'g')

export function remarkLumenXref(context: Context) {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (!node.value.includes('@')) return

      XREF.lastIndex = 0
      const replacement: Array<Text | LumenXref> = []
      let cursor = 0
      let match: RegExpExecArray | null

      while ((match = XREF.exec(node.value))) {
        const [raw, dash, identifiers] = match
        const targets: XrefTarget[] = identifiers.split(/\s*,\s*/).map((identifier) => {
          const entry = context.registry.get(identifier)
          if (!entry) {
            context.report('error', 'xref-unresolved', `Nothing in this document has the id "${identifier}".`, node.position)
          }
          return {
            identifier,
            resolved: entry ? { kind: entry.kind, number: entry.number, title: entry.title } : undefined,
          }
        })

        if (match.index > cursor) {
          replacement.push({ type: 'text', value: node.value.slice(cursor, match.index) })
        }
        replacement.push({
          type: 'lumenXref', targets, numberOnly: dash === '-', raw, children: [],
          position: node.position,
        })
        cursor = match.index + raw.length
      }

      if (replacement.length === 0) return
      if (cursor < node.value.length) {
        replacement.push({ type: 'text', value: node.value.slice(cursor) })
      }

      ;(parent as Parent).children.splice(index, 1, ...(replacement as never[]))
      return index + replacement.length
    })
  }
}
