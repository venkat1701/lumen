import { visit } from 'unist-util-visit'
import type { Code, Paragraph, PhrasingContent, Root, RootContent } from 'mdast'
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive'
import type { Context } from '../context.js'
import {
  isCalloutKind, isTheoremKind, type BlockKind, type LumenBlock, type LumenDiagram,
} from '../types.js'

const KNOWN: BlockKind[] = [
  'proof', 'abstract', 'figure', 'table', 'equation', 'aside', 'bibliography',
]

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_:.-]*$/

function attributesOf(node: ContainerDirective | LeafDirective | TextDirective): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/**
 * Directives become `lumenBlock` nodes, mermaid fences become `lumenDiagram`,
 * and display equations pick up the labels the normalizer set aside.
 */
export function remarkLumenBlocks(context: Context) {
  return (tree: Root) => {
    visit(tree, 'containerDirective', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const name = node.name.toLowerCase()
      const attributes = attributesOf(node)
      let kind: BlockKind
      let variant: string | undefined

      if (isTheoremKind(name)) kind = name
      else if (isCalloutKind(name)) { kind = 'callout'; variant = name }
      else if (name === 'callout') {
        kind = 'callout'
        variant = isCalloutKind(attributes.kind) ? attributes.kind : 'note'
      } else if ((KNOWN as string[]).includes(name)) kind = name as BlockKind
      else {
        kind = 'unknown'
        variant = name
        context.report('warning', 'unknown-block', `"${name}" isn't a Lumen block. It will render as a plain container.`, node.position)
      }

      const children = [...node.children] as RootContent[]

      // remark-directive puts `[title]` in a leading paragraph.
      let title: PhrasingContent[] | undefined
      const first = children[0]
      if (first?.type === 'paragraph' && (first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel) {
        title = first.children
        children.shift()
      }

      // A figure's or table's last paragraph is its caption, when it has company.
      let caption: PhrasingContent[] | undefined
      if ((kind === 'figure' || kind === 'table') && children.length > 1) {
        const last = children[children.length - 1]
        if (last.type === 'paragraph') {
          caption = (last as Paragraph).children
          children.pop()
        }
      }

      let identifier: string | undefined = attributes.id
      if (identifier && !ID_PATTERN.test(identifier)) {
        context.report('warning', 'invalid-id', `The id "${identifier}" has characters that can't be used in a link.`, node.position)
        identifier = undefined
      }

      const block: LumenBlock = {
        type: 'lumenBlock',
        kind,
        variant,
        title,
        caption,
        identifier,
        attributes,
        children: children as LumenBlock['children'],
        position: node.position,
      }
      if (kind === 'bibliography') context.bibliographyPlaced = true
      parent.children[index] = block
    })

    // Leaf and text directives are not part of Lumen. Keep the text visible.
    for (const type of ['leafDirective', 'textDirective'] as const) {
      visit(tree, type, (node, index, parent) => {
        if (!parent || typeof index !== 'number') return
        context.report('info', 'unsupported-directive', `Lumen uses ::: blocks; ":${node.name}" is passed through as text.`, node.position)
        parent.children.splice(index, 1, ...(node.children as RootContent[]))
        return index
      })
    }

    visit(tree, 'code', (node: Code, index, parent) => {
      if (!parent || typeof index !== 'number') return
      const lang = (node.lang ?? '').toLowerCase()
      if (lang === 'mermaid') {
        context.hasDiagrams = true
        const identifier = /#([A-Za-z][\w:.-]*)/.exec(node.meta ?? '')?.[1]
        const diagram: LumenDiagram = {
          type: 'lumenDiagram', lang: 'mermaid', value: node.value,
          identifier, children: [], position: node.position,
        }
        parent.children[index] = diagram
        return
      }
      if (lang === 'bibtex' || lang === 'bib') {
        // A bibliography fence is a data source, not something to display.
        context.bibSource += `\n${node.value}`
        parent.children.splice(index, 1)
        return index
      }
      if (lang) context.languages.add(lang)
    })

    if (context.equationLabels.size) {
      visit(tree, 'math', (node) => {
        const line = node.position?.end?.line
        if (line === undefined) return
        const label = context.equationLabels.get(line)
        if (label) (node as { identifier?: string }).identifier = label.identifier
      })
    }
  }
}
