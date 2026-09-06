import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Heading, Root, Text } from 'mdast'
import type { Context } from '../context.js'

const TRAILING_ID = /\s*\{#([A-Za-z][\w:.-]*)\}\s*$/

function slug(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section'
}

/**
 * Gives every heading an id, numbers the sections, and builds the outline.
 * The section number is also what `numbering: section` counts against, so this
 * has to run before numbering.
 */
export function remarkLumenHeadings(context: Context) {
  return (tree: Root) => {
    const headings: Heading[] = []
    visit(tree, 'heading', (node) => { headings.push(node) })
    if (headings.length === 0) return

    const baseDepth = Math.min(...headings.map((h) => h.depth))
    const counters: number[] = []
    const seen = new Set<string>()

    for (const heading of headings) {
      // An explicit `{#sec:intro}` wins over a generated slug.
      let identifier: string | undefined
      const last = heading.children[heading.children.length - 1]
      if (last?.type === 'text') {
        const match = TRAILING_ID.exec((last as Text).value)
        if (match) {
          identifier = match[1]
          ;(last as Text).value = (last as Text).value.replace(TRAILING_ID, '')
          if (!(last as Text).value) heading.children.pop()
        }
      }

      const text = toString(heading).trim()
      if (!identifier) {
        const base = slug(text)
        identifier = base
        let n = 2
        while (seen.has(identifier)) identifier = `${base}-${n++}`
      }
      seen.add(identifier)

      const level = heading.depth - baseDepth
      counters.length = level + 1
      for (let i = 0; i < counters.length; i++) counters[i] ??= 0
      counters[level] = (counters[level] ?? 0) + 1
      const number = counters.slice(0, level + 1).join('.')

      const data = (heading.data ??= {})
      const properties = ((data as { hProperties?: Record<string, unknown> }).hProperties ??= {})
      properties.id = identifier
      ;(data as { lumenNumber?: string }).lumenNumber = number

      context.outline.push({
        id: identifier, depth: heading.depth, text, number,
        line: heading.position?.start.line ?? 1,
      })
      context.register({ identifier, kind: 'section', number, title: text })
    }
  }
}
