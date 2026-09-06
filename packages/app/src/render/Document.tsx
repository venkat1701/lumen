import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Components } from 'hast-util-to-jsx-runtime'
import type { LumenMeta } from 'lumen-core'
import type { RenderBlock } from '../worker/compile.worker.js'
import { Diagram } from '../components/Diagram.js'
import { Peek, type PeekState } from '../components/Peek.js'

/* Diagrams are the one element the compiler hands over unrendered: the source
 * arrives as an attribute and React swaps in the interactive component. */
const components: Partial<Components> = {
  div(props) {
    const record = props as Record<string, unknown>
    if (record['data-lumen-diagram']) {
      return <Diagram source={String(record['data-source'] ?? '')} id={record.id as string | undefined} />
    }
    const { children, ...rest } = props
    return <div {...rest}>{children}</div>
  },
}

const renderOptions = { Fragment, jsx, jsxs, components } as never

/**
 * One top-level block. The comparator looks only at the content hash, so an
 * edit inside one paragraph leaves every other block's DOM untouched — which is
 * what keeps a long document responsive while typing.
 */
const Block = memo(
  function Block({ node }: { node: RenderBlock['node']; hash: string }) {
    return toJsxRuntime({ type: 'root', children: [node] }, renderOptions) as never
  },
  (previous, next) => previous.hash === next.hash,
)

function TitleBlock({ meta }: { meta: LumenMeta }) {
  if (!meta.title && meta.authors.length === 0) return null
  const names = meta.authors.map((a) => a.name)
  const byline =
    names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : names.join(' and ')

  return (
    <header className="lmn-title">
      {meta.title ? <h1>{meta.title}</h1> : null}
      {meta.subtitle ? <p className="lmn-title__subtitle">{meta.subtitle}</p> : null}
      {byline ? <p className="lmn-title__authors">{byline}</p> : null}
      {meta.date ? <p className="lmn-title__date">{meta.date}</p> : null}
      {meta.abstract ? (
        <section className="lmn-abstract">
          <h2 className="lmn-abstract__head">Abstract</h2>
          <p>{meta.abstract}</p>
        </section>
      ) : null}
    </header>
  )
}

export interface DocumentViewProps {
  blocks: RenderBlock[]
  meta: LumenMeta | null
  onActiveLineChange?: (line: number) => void
}

export function DocumentView({ blocks, meta }: DocumentViewProps) {
  const root = useRef<HTMLElement>(null)
  const [peek, setPeek] = useState<PeekState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  /* Hovering a cross-reference shows what it points at. The preview is a live
   * clone of the target that is already in the DOM, so nothing is re-parsed and
   * no HTML is injected. */
  const openPeek = useCallback((anchor: HTMLAnchorElement) => {
    const id = decodeURIComponent(anchor.getAttribute('href')?.slice(1) ?? '')
    if (!id || !root.current) return
    const target = root.current.querySelector(`[id="${CSS.escape(id)}"]`)
    if (!target || target.contains(anchor)) return

    const kindNode = target.querySelector('.lmn-block__label, .lmn-caption__label')
    const rect = anchor.getBoundingClientRect()
    setPeek({
      node: target.cloneNode(true) as HTMLElement,
      kind: kindNode?.textContent?.trim() ?? (target.tagName.startsWith('H') ? 'Section' : 'Reference'),
      x: rect.left,
      y: rect.top,
      bottom: rect.bottom,
    })
  }, [])

  useEffect(() => {
    const element = root.current
    if (!element) return

    const enter = (event: Event) => {
      const anchor = (event.target as HTMLElement)?.closest?.('a.lmn-xref, a.lmn-cite__ref')
      if (!(anchor instanceof HTMLAnchorElement)) return
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => openPeek(anchor), 280)
    }
    const leave = (event: Event) => {
      const anchor = (event.target as HTMLElement)?.closest?.('a.lmn-xref, a.lmn-cite__ref')
      if (!anchor) return
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setPeek(null), 140)
    }

    element.addEventListener('mouseover', enter)
    element.addEventListener('mouseout', leave)
    element.addEventListener('focusin', enter)
    element.addEventListener('focusout', leave)
    return () => {
      window.clearTimeout(timer.current)
      element.removeEventListener('mouseover', enter)
      element.removeEventListener('mouseout', leave)
      element.removeEventListener('focusin', enter)
      element.removeEventListener('focusout', leave)
    }
  }, [openPeek])

  return (
    <>
      <article className="lmn-doc" ref={root}>
        {meta ? <TitleBlock meta={meta} /> : null}
        {blocks.map((block) => (
          <Block key={block.key} node={block.node} hash={block.hash} />
        ))}
      </article>
      {peek ? (
        <Peek
          state={peek}
          onDismiss={() => setPeek(null)}
          onHold={() => window.clearTimeout(timer.current)}
        />
      ) : null}
    </>
  )
}
