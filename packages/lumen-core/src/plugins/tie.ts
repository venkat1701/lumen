import { visit } from 'unist-util-visit'
import type { Element, Root, RootContent } from 'hast'

/** Punctuation that must never be the first thing on a line. */
const TIE = /^[,.;:!?)\]}»”’…]+/

const classesOf = (node: RootContent): string[] => {
  if (node.type !== 'element') return []
  const value = (node as Element).properties?.className
  return Array.isArray(value) ? value.map(String) : []
}

/**
 * Keeps punctuation attached to the formula it follows.
 *
 * KaTeX's markup offers the browser a line-break opportunity straight after a
 * formula, so `…at time $t$, and let…` can wrap with the comma stranded at the
 * start of the next line. Binding the two into one non-breaking span is the
 * typographic fix, and doing it here means every renderer inherits it.
 */
export function rehypeLumenTie() {
  return (tree: Root) => {
    visit(tree, (node) => {
      const children = (node as { children?: RootContent[] }).children
      if (!Array.isArray(children)) return
      if (classesOf(node as RootContent).includes('lmn-tie')) return

      for (let index = 0; index < children.length - 1; index++) {
        const current = children[index]
        const next = children[index + 1]
        const classes = classesOf(current)
        if (!classes.includes('katex') || classes.includes('katex-display')) continue
        if (next.type !== 'text') continue

        const match = TIE.exec(next.value)
        if (!match) continue

        next.value = next.value.slice(match[0].length)
        children[index] = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['lmn-tie'] },
          children: [current as Element, { type: 'text', value: match[0] }],
        }
        if (next.value === '') children.splice(index + 1, 1)
      }
    })
  }
}
