import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderDiagram } from '../lib/mermaid.js'
import { useTheme } from '../hooks/useTheme.js'
import { Icon } from './Icon.js'

interface View { x: number; y: number; k: number }
const IDENTITY: View = { x: 0, y: 0, k: 1 }

/* ------------------------------------------------------------------ *
 * Highlighting
 *
 * Mermaid names flowchart nodes `flowchart-<key>-<n>` and links `L_<a>_<b>_<n>`.
 * That is enough to work out what a node is connected to and step everything
 * else back, and when a diagram type doesn't follow the convention the hovered
 * shape is simply lit on its own.
 * ------------------------------------------------------------------ */

/** Mermaid prefixes every id with the diagram's own id, so both patterns are
 *  matched loosely rather than anchored to the start of the string. */
const NODE_ID = /flowchart-(.+?)-\d+$/
const EDGE_ID = /L_(.+)_\d+$/

function keyOf(node: Element): string | null {
  const id = node.getAttribute('id')
  if (!id) return null
  return NODE_ID.exec(id)?.[1] ?? id
}

function highlight(canvas: HTMLElement, node: Element | null): void {
  for (const lit of canvas.querySelectorAll('.lmn-lit')) lit.classList.remove('lmn-lit')
  if (!node) {
    canvas.dataset.focused = 'false'
    return
  }

  canvas.dataset.focused = 'true'
  node.classList.add('lmn-lit')

  const key = keyOf(node)
  if (!key) return
  const neighbours = new Set<string>()

  for (const edge of canvas.querySelectorAll('.flowchart-link, .edgePath, [id*="L_"]')) {
    const ends = EDGE_ID.exec(edge.getAttribute('id') ?? '')?.[1]
    if (!ends) continue
    const parts = ends.split('_')
    if (!parts.includes(key)) continue
    edge.classList.add('lmn-lit')
    for (const part of parts) if (part !== key) neighbours.add(part)
  }

  for (const other of canvas.querySelectorAll('.node')) {
    const otherKey = keyOf(other)
    if (otherKey && neighbours.has(otherKey)) other.classList.add('lmn-lit')
  }
}

/* ------------------------------------------------------------------ *
 * Stage
 * ------------------------------------------------------------------ */

interface StageProps {
  svg: string
  registerFit?: (fit: () => void) => void
  /** Fill the available height instead of sizing to the diagram. */
  fill?: boolean
}

const PAD = 26
const MAX_HEIGHT = 420
const MIN_HEIGHT = 150

function Stage({ svg, registerFit, fill = false }: StageProps) {
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>(IDENTITY)
  const [height, setHeight] = useState<number | null>(null)
  const [panning, setPanning] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const pinned = useRef<Element | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useLayoutEffect(() => {
    const host = canvas.current
    if (!host) return
    // Parsed as HTML, not XML: Mermaid's node labels are real HTML inside a
    // foreignObject, and an XML parser gives up on the first unclosed <br>.
    const parsed = new DOMParser().parseFromString(`<body>${svg}</body>`, 'text/html')
    const element = parsed.body.querySelector('svg')
    if (!element) return
    element.removeAttribute('width')
    element.removeAttribute('style')
    host.replaceChildren(document.importNode(element, true))
    pinned.current = null
  }, [svg])

  /* The frame is sized to the diagram, not the other way round: a wide
   * flowchart gets a short box and a tall one gets a taller box, up to a limit,
   * so a diagram is never a postage stamp floating in empty space. */
  const fit = useCallback(() => {
    const box = stage.current
    const image = canvas.current?.querySelector('svg')
    if (!box || !image) return
    const bounds = image.getBBox()
    if (!bounds.width || !bounds.height) return

    const width = box.clientWidth
    let k: number
    let boxHeight: number

    if (fill) {
      boxHeight = box.clientHeight
      k = Math.min((width - PAD * 2) / bounds.width, (boxHeight - PAD * 2) / bounds.height, 2.5)
    } else {
      k = Math.min((width - PAD * 2) / bounds.width, 1.5)
      boxHeight = bounds.height * k + PAD * 2
      if (boxHeight > MAX_HEIGHT) {
        boxHeight = MAX_HEIGHT
        k = (MAX_HEIGHT - PAD * 2) / bounds.height
      }
      boxHeight = Math.max(MIN_HEIGHT, boxHeight)
      setHeight(boxHeight)
    }

    setView({
      k,
      x: (width - bounds.width * k) / 2 - bounds.x * k,
      y: (boxHeight - bounds.height * k) / 2 - bounds.y * k,
    })
  }, [fill])

  useEffect(() => {
    const id = requestAnimationFrame(fit)
    return () => cancelAnimationFrame(id)
  }, [svg, fit])

  useEffect(() => { registerFit?.(fit) }, [fit, registerFit])

  // Wheel is only taken over once the reader has engaged with the diagram, so
  // scrolling past one never traps the page.
  useEffect(() => {
    const box = stage.current
    if (!box) return
    const onWheel = (event: WheelEvent) => {
      const zoomGesture = event.ctrlKey || event.metaKey
      if (!zoomGesture && !engaged) return
      event.preventDefault()
      const rect = box.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      setView((current) => {
        const k = Math.min(6, Math.max(0.15, current.k * Math.exp(-event.deltaY * 0.0016)))
        const ratio = k / current.k
        return { k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio }
      })
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [engaged])

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    setEngaged(true)
    drag.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y }
    setPanning(true)
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent) => {
    const start = drag.current
    if (!start) return
    setView((current) => ({ ...current, x: start.ox + (event.clientX - start.x), y: start.oy + (event.clientY - start.y) }))
  }
  const endPan = () => { drag.current = null; setPanning(false) }

  const onMouseOver = (event: React.MouseEvent) => {
    if (pinned.current || !canvas.current) return
    const node = (event.target as Element).closest?.('.node')
    highlight(canvas.current, node ?? null)
  }
  const onMouseLeave = () => {
    if (!pinned.current && canvas.current) highlight(canvas.current, null)
  }
  const onClick = (event: React.MouseEvent) => {
    if (!canvas.current) return
    const node = (event.target as Element).closest?.('.node') ?? null
    pinned.current = pinned.current === node ? null : node
    highlight(canvas.current, pinned.current)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pinned.current && canvas.current) {
        pinned.current = null
        highlight(canvas.current, null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="diagram__stage"
      ref={stage}
      style={fill || height === null ? undefined : { height }}
      data-panning={panning}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onDoubleClick={fit}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <div
        className="diagram__canvas"
        ref={canvas}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      />
      <ZoomReadout k={view.k} />
    </div>
  )
}

function ZoomReadout({ k }: { k: number }) {
  return <span className="diagram__hint">{Math.round(k * 100)}% · drag to pan, ⌘-scroll to zoom, click a node to focus</span>
}

/* ------------------------------------------------------------------ *
 * Diagram
 * ------------------------------------------------------------------ */

export function Diagram({ source, id }: { source: string; id?: string }) {
  const { theme } = useTheme()
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const fitRef = useRef<(() => void) | null>(null)
  const registerFit = useCallback((fit: () => void) => { fitRef.current = fit }, [])

  useEffect(() => {
    let live = true
    const run = () => {
      renderDiagram(source, theme)
        .then((result) => { if (live) { setSvg(result.svg); setError(null) } })
        .catch((cause: Error) => { if (live) setError(cause.message) })
    }
    // Rendering waits for an idle moment so a burst of typing stays smooth.
    const idle = typeof window.requestIdleCallback === 'function'
    const handle = idle
      ? window.requestIdleCallback(run, { timeout: 400 })
      : window.setTimeout(run, 0)
    return () => {
      live = false
      if (idle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
    }
  }, [source, theme])

  const download = useCallback((kind: 'svg' | 'png') => {
    const image = container.current?.querySelector('svg')
    if (!image) return
    const clone = image.cloneNode(true) as SVGSVGElement
    const bounds = image.getBBox()
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(Math.ceil(bounds.width + 24)))
    clone.setAttribute('height', String(Math.ceil(bounds.height + 24)))
    clone.setAttribute('viewBox', `${bounds.x - 12} ${bounds.y - 12} ${bounds.width + 24} ${bounds.height + 24}`)
    const markup = new XMLSerializer().serializeToString(clone)
    const name = id ?? 'diagram'

    if (kind === 'svg') {
      save(new Blob([markup], { type: 'image/svg+xml' }), `${name}.svg`)
      return
    }

    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil((bounds.width + 24) * scale)
    canvas.height = Math.ceil((bounds.height + 24) * scale)
    const context = canvas.getContext('2d')
    const bitmap = new Image()
    bitmap.onload = () => {
      if (!context) return
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim() || '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => blob && save(blob, `${name}.png`), 'image/png')
    }
    bitmap.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`
  }, [id])

  useEffect(() => {
    if (!full) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  const body = useMemo(() => {
    if (error) return <p className="diagram__error">This diagram didn’t parse.{'\n'}{error}</p>
    if (!svg) return <div className="diagram__stage" aria-busy="true" />
    return <Stage svg={svg} registerFit={registerFit} />
  }, [error, svg, registerFit])

  return (
    <>
      <div className="diagram" ref={container} id={id}>
        {body}
        {svg && !error ? (
          <div className="diagram__bar">
            <button type="button" onClick={() => fitRef.current?.()} title="Fit to view" aria-label="Fit to view"><Icon name="fit" /></button>
            <button type="button" onClick={() => setFull(true)} title="Open full screen" aria-label="Open full screen"><Icon name="expand" /></button>
            <button type="button" onClick={() => download('svg')} title="Download SVG" aria-label="Download SVG"><Icon name="download" /></button>
            <button type="button" onClick={() => download('png')} title="Download PNG" aria-label="Download PNG"><Icon name="image" /></button>
          </div>
        ) : null}
      </div>
      {full && svg
        ? createPortal(
            <div className="overlay" role="dialog" aria-modal="true" aria-label="Diagram">
              <div className="overlay__head">
                <strong style={{ fontWeight: 500 }}>{id ?? 'Diagram'}</strong>
                <span style={{ flex: 1 }} />
                <button className="btn" type="button" onClick={() => download('svg')}>Download SVG</button>
                <button className="btn" type="button" onClick={() => download('png')}>Download PNG</button>
                <button className="btn" type="button" onClick={() => setFull(false)}>Close</button>
              </div>
              <div className="diagram" ref={container}>
                <Stage svg={svg} fill />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
