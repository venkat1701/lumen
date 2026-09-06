import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import type { Context } from '../context.js'
import { isTheoremKind, KIND_LABELS, type CounterMode, type LumenBlock } from '../types.js'

const format = (mode: CounterMode, section: number, n: number): string =>
  mode === 'section' && section > 0 ? `${section}.${n}` : `${n}`

/**
 * Assigns numbers in one document-order pass and registers every labelled
 * thing, so cross-references have something to resolve against.
 */
export function remarkLumenNumbering(context: Context) {
  return (tree: Root) => {
    const { numbering } = context.meta
    let section = 0
    let shared = 0
    let figure = 0
    let table = 0
    let equation = 0
    const perType = new Map<string, number>()

    const nextTheorem = (kind: string): number => {
      if (numbering.theoremStyle === 'per-type') {
        const n = (perType.get(kind) ?? 0) + 1
        perType.set(kind, n)
        return n
      }
      return ++shared
    }

    visit(tree, (node) => {
      if (node.type === 'heading') {
        const number = (node.data as { lumenNumber?: string } | undefined)?.lumenNumber
        if (number && !number.includes('.')) {
          section = Number(number)
          if (numbering.theorem === 'section') { shared = 0; perType.clear() }
          if (numbering.figure === 'section') figure = 0
          if (numbering.table === 'section') table = 0
        }
        return
      }

      if (node.type === 'lumenBlock') {
        const block = node as LumenBlock
        const { kind } = block
        let number: string | undefined

        if (isTheoremKind(kind) && numbering.theorem !== 'off') {
          number = format(numbering.theorem, section, nextTheorem(kind))
        } else if (kind === 'figure' && numbering.figure !== 'off') {
          number = format(numbering.figure, section, ++figure)
        } else if (kind === 'table' && numbering.table !== 'off') {
          number = format(numbering.table, section, ++table)
        } else if (kind === 'equation' && numbering.equation !== 'off') {
          number = String(++equation)
        }

        block.number = number
        if (block.identifier) {
          context.register({
            identifier: block.identifier,
            kind: block.kind === 'callout' ? (block.variant ?? 'note') : block.kind,
            number,
            title: block.title ? toString({ type: 'paragraph', children: block.title }) : undefined,
          })
        }
        return
      }

      if (node.type === 'math') {
        const math = node as { identifier?: string; number?: string }
        const mode = numbering.equation
        if (mode === 'off') return
        if (mode === 'labeled' && !math.identifier) return
        math.number = String(++equation)
        if (math.identifier) {
          context.register({ identifier: math.identifier, kind: 'equation', number: math.number })
        }
      }
    })

    void KIND_LABELS
  }
}
