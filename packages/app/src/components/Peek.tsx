import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PeekState {
  node: HTMLElement
  kind: string
  x: number
  y: number
  bottom: number
}

/** A preview of whatever a cross-reference points at, placed so it never falls
 *  off the viewport and never covers the link it came from. */
export function Peek({
  state, onDismiss, onHold,
}: { state: PeekState; onDismiss: () => void; onHold: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: state.x, top: state.bottom + 8, ready: false })

  const [labelled, setLabelled] = useState(false)

  useLayoutEffect(() => {
    const host = body.current
    if (!host) return
    host.replaceChildren(state.node)
    setLabelled(!!state.node.querySelector('.lmn-block__label, .lmn-caption__label'))
  }, [state.node])

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const margin = 12
    let left = Math.min(state.x, window.innerWidth - rect.width - margin)
    left = Math.max(margin, left)
    const below = state.bottom + 8
    const top = below + rect.height > window.innerHeight - margin
      ? Math.max(margin, state.y - rect.height - 8)
      : below
    setPosition({ left, top, ready: true })
  }, [state])

  useEffect(() => {
    const dismiss = () => onDismiss()
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('keydown', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('keydown', dismiss)
    }
  }, [onDismiss])

  return createPortal(
    <div
      className="peek lmn-doc"
      ref={box}
      role="tooltip"
      style={{
        left: position.left,
        top: position.top,
        display: 'block',
        visibility: position.ready ? 'visible' : 'hidden',
      }}
      onMouseEnter={onHold}
      onMouseLeave={onDismiss}
    >
      {labelled ? null : <div className="peek__kind">{state.kind}</div>}
      <div className="peek__body" ref={body} />
    </div>,
    document.body,
  )
}
