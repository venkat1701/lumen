import type { Element, ElementContent, Properties, Text as HastText } from 'hast'
import type { PhrasingContent } from 'mdast'
import type { State } from 'mdast-util-to-hast'
import type { Context } from './context.js'
import { formatReference, shortAuthors } from './bibtex.js'
import {
  isTheoremKind, KIND_LABELS,
  type LumenBibliography, type LumenBlock, type LumenCite, type LumenDiagram, type LumenXref,
} from './types.js'

const text = (value: string): HastText => ({ type: 'text', value })

function el(tagName: string, properties: Properties, children: ElementContent[] = []): Element {
  return { type: 'element', tagName, properties, children }
}

const plural = (label: string) => (label.endsWith('.') ? `${label.slice(0, -1)}s.` : `${label}s`)

/* ------------------------------------------------------------------ *
 * Blocks
 * ------------------------------------------------------------------ */

function inline(state: State, content: PhrasingContent[] | undefined): ElementContent[] {
  if (!content?.length) return []
  return state.all({ type: 'paragraph', children: content }) as ElementContent[]
}

function head(label: string, number: string | undefined, title: ElementContent[]): Element {
  const children: ElementContent[] = [
    el('span', { className: ['lmn-block__label'] }, [text(number ? `${label} ${number}` : label)]),
  ]
  if (title.length) {
    children.push(el('span', { className: ['lmn-block__title'] }, [text('('), ...title, text(')')]))
  }
  return el('p', { className: ['lmn-block__head'] }, children)
}

function lumenBlock(state: State, node: LumenBlock): Element {
  const { kind, variant, number, identifier } = node
  const body = state.all(node) as ElementContent[]
  const title = inline(state, node.title)
  const id = identifier ? { id: identifier } : {}

  if (isTheoremKind(kind)) {
    return el('div', {
      className: ['lmn-block', 'lmn-theorem', `lmn-theorem--${kind}`],
      dataKind: kind, ...id,
    }, [head(KIND_LABELS[kind], number, title), ...body])
  }

  if (kind === 'proof') {
    const tombstone = el('span', { className: ['lmn-proof__end'], 'aria-hidden': 'true' }, [text('∎')])
    const last = body[body.length - 1]
    if (last && last.type === 'element' && last.tagName === 'p') last.children.push(text(' '), tombstone)
    else body.push(el('p', { className: ['lmn-proof__tail'] }, [tombstone]))
    return el('div', { className: ['lmn-block', 'lmn-proof'], ...id }, [
      el('p', { className: ['lmn-block__head'] }, [
        el('span', { className: ['lmn-block__label'] }, [text('Proof')]),
        ...(title.length ? [el('span', { className: ['lmn-block__title'] }, [text('('), ...title, text(')')])] : []),
      ]),
      ...body,
    ])
  }

  if (kind === 'callout') {
    const name = variant ?? 'note'
    return el('div', {
      className: ['lmn-block', 'lmn-callout', `lmn-callout--${name}`],
      role: name === 'warning' || name === 'caution' ? 'note' : undefined, ...id,
    }, [
      el('p', { className: ['lmn-callout__head'] },
        title.length ? title : [text(KIND_LABELS[name] ?? 'Note')]),
      ...body,
    ])
  }

  if (kind === 'figure' || kind === 'table') {
    const caption = inline(state, node.caption)
    const children: ElementContent[] = [el('div', { className: ['lmn-figure__body'] }, body)]
    if (number || caption.length) {
      children.push(el('figcaption', { className: ['lmn-caption'] }, [
        ...(number ? [el('span', { className: ['lmn-caption__label'] }, [text(`${KIND_LABELS[kind]} ${number}`)])] : []),
        ...caption,
      ]))
    }
    return el('figure', { className: ['lmn-figure', `lmn-figure--${kind}`], ...id }, children)
  }

  if (kind === 'aside') {
    return el('aside', { className: ['lmn-aside'], ...id }, [
      ...(title.length ? [el('p', { className: ['lmn-aside__head'] }, title)] : []),
      ...body,
    ])
  }

  if (kind === 'abstract') {
    return el('section', { className: ['lmn-abstract'], ...id }, [
      el('h2', { className: ['lmn-abstract__head'] }, title.length ? title : [text('Abstract')]),
      ...body,
    ])
  }

  if (kind === 'equation') {
    return el('div', { className: ['lmn-eq', 'lmn-eq--block'], ...id }, [
      el('div', { className: ['lmn-eq__body'] }, body),
      ...(number ? [el('span', { className: ['lmn-eq__number'] }, [text(`(${number})`)])] : []),
    ])
  }

  if (kind === 'bibliography') return bibliography(state)

  return el('div', {
    className: ['lmn-block', 'lmn-block--unknown'], dataKind: variant ?? 'unknown', ...id,
  }, [
    ...(title.length ? [el('p', { className: ['lmn-block__head'] }, title)] : []),
    ...body,
  ])
}

/* ------------------------------------------------------------------ *
 * Cross-references
 * ------------------------------------------------------------------ */

function lumenXref(_state: State, node: LumenXref): ElementContent {
  const resolved = node.targets.filter((t) => t.resolved)

  if (resolved.length === 0) {
    return el('span', {
      className: ['lmn-xref', 'lmn-xref--broken'],
      title: 'This reference points at an id that does not exist in the document.',
    }, [text(`?${node.raw}`)])
  }

  const link = (identifier: string, label: string) =>
    el('a', { className: ['lmn-xref'], href: `#${identifier}` }, [text(label)])

  // Equations are cited by their printed number, which carries parentheses.
  const number = (kind: string, value: string | undefined) =>
    kind === 'equation' ? `(${value ?? '?'})` : (value ?? '')

  if (node.numberOnly) {
    const parts: ElementContent[] = []
    resolved.forEach((target, i) => {
      if (i > 0) parts.push(text(i === resolved.length - 1 ? ' and ' : ', '))
      parts.push(link(target.identifier, target.resolved?.number ?? '?'))
    })
    return parts.length === 1 ? parts[0] : el('span', { className: ['lmn-xref-group'] }, parts)
  }

  const kind = resolved[0].resolved!.kind
  const label = KIND_LABELS[kind] ?? kind.replace(/^./, (c) => c.toUpperCase())
  const sameKind = resolved.every((t) => t.resolved!.kind === kind)

  if (resolved.length === 1) {
    const target = resolved[0]
    return link(target.identifier, `${label} ${number(kind, target.resolved!.number)}`.trim())
  }

  const parts: ElementContent[] = []
  if (sameKind) parts.push(text(`${plural(label)} `))
  resolved.forEach((target, i) => {
    if (i > 0) parts.push(text(i === resolved.length - 1 ? ' and ' : ', '))
    const own = target.resolved!
    const ownLabel = KIND_LABELS[own.kind] ?? own.kind
    parts.push(link(
      target.identifier,
      sameKind ? number(own.kind, own.number) : `${ownLabel} ${number(own.kind, own.number)}`.trim(),
    ))
  })
  return el('span', { className: ['lmn-xref-group'] }, parts)
}

/* ------------------------------------------------------------------ *
 * Citations and bibliography
 * ------------------------------------------------------------------ */

function citeLabel(context: Context, key: string): string {
  if (context.meta.citationStyle === 'numeric') return String(context.citationNumber(key))
  const entry = context.bib.get(key)
  if (!entry) return key
  return `${shortAuthors(entry)}, ${entry.year ?? 'n.d.'}`
}

function lumenCite(context: Context) {
  return (_state: State, node: LumenCite): ElementContent => {
    const numeric = context.meta.citationStyle === 'numeric'
    const parts: ElementContent[] = []

    const known = node.items.filter((item) => context.bib.has(item.key))
    if (known.length === 0) {
      return el('span', {
        className: ['lmn-cite', 'lmn-cite--broken'],
        title: 'No bibliography entry with this key.',
      }, [text(`[?${node.items.map((i) => i.key).join(', ')}]`)])
    }

    if (node.narrative) {
      const entry = context.bib.get(known[0].key)!
      parts.push(text(`${shortAuthors(entry)} `))
    }

    parts.push(text(numeric ? '[' : node.narrative ? '(' : '('))
    known.forEach((item, i) => {
      if (i > 0) parts.push(text(numeric ? ', ' : '; '))
      if (item.prefix) parts.push(text(`${item.prefix} `))
      parts.push(el('a', { className: ['lmn-cite__ref'], href: `#lmn-bib-${item.key}` }, [
        text(node.narrative && !numeric ? (context.bib.get(item.key)?.year ?? 'n.d.') : citeLabel(context, item.key)),
      ]))
      if (item.suffix) parts.push(text(`, ${item.suffix}`))
    })
    parts.push(text(numeric ? ']' : ')'))

    return el('span', { className: ['lmn-cite'] }, parts)
  }
}

let bibliographyContext: Context | null = null

function bibliography(_state: State): Element {
  const context = bibliographyContext!
  const numeric = context.meta.citationStyle === 'numeric'
  const keys = numeric
    ? [...context.citedOrder]
    : [...context.citedOrder].sort((a, b) => {
        const x = context.bib.get(a); const y = context.bib.get(b)
        return (x?.primary ?? a).localeCompare(y?.primary ?? b) || (x?.year ?? '').localeCompare(y?.year ?? '')
      })

  const entries = keys.map((key, index) => {
    const entry = context.bib.get(key)
    const marker = numeric ? `${context.citationNumber(key)}.` : ''
    return el('li', { className: ['lmn-bib__entry'], id: `lmn-bib-${key}` }, [
      ...(marker ? [el('span', { className: ['lmn-bib__marker'] }, [text(marker)])] : []),
      el('span', { className: ['lmn-bib__text'] }, [
        text(entry ? formatReference(entry) : `${key} — entry not found`),
      ]),
      ...(index < 0 ? [] : []),
    ])
  })

  return el('section', { className: ['lmn-bib'], 'aria-label': 'References' }, [
    el('h2', { className: ['lmn-bib__head'], id: 'references' }, [text('References')]),
    el(numeric ? 'ol' : 'ul', { className: ['lmn-bib__list'] }, entries),
  ])
}

/* ------------------------------------------------------------------ *
 * Diagrams and equations
 * ------------------------------------------------------------------ */

function lumenDiagram(_state: State, node: LumenDiagram): Element {
  return el('div', {
    className: ['lmn-diagram'],
    dataLumenDiagram: node.lang,
    // The source rides along on the node so the renderer never re-parses it.
    dataSource: node.value,
    ...(node.identifier ? { id: node.identifier } : {}),
  }, [])
}

interface MathNode { type: 'math'; value: string; identifier?: string; number?: string }

function math(_state: State, node: MathNode): Element {
  const body = el('div', { className: ['math', 'math-display'] }, [text(node.value)])
  if (!node.number) return body
  return el('div', {
    className: ['lmn-eq'], ...(node.identifier ? { id: node.identifier } : {}),
  }, [
    el('div', { className: ['lmn-eq__body'] }, [body]),
    el('span', { className: ['lmn-eq__number'] }, [text(`(${node.number})`)]),
  ])
}

export function lumenHandlers(context: Context) {
  bibliographyContext = context
  return {
    lumenBlock,
    lumenXref,
    lumenCite: lumenCite(context),
    lumenDiagram,
    lumenBibliography: (_state: State, _node: LumenBibliography) => bibliography(_state),
    math,
  } as Record<string, (state: State, node: never) => ElementContent>
}
