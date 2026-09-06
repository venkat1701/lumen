import { useEffect, useMemo, useRef, useState } from 'react'
import type { CompileResponse, RenderBlock } from '../worker/compile.worker.js'
import type { CompileOptions, Diagnostic, LumenMeta, OutlineEntry } from 'lumen-core'

export interface CompiledDocument {
  blocks: RenderBlock[]
  meta: LumenMeta | null
  outline: OutlineEntry[]
  diagnostics: Diagnostic[]
  lineMap: Array<{ line: number; index: number }>
  hasDiagrams: boolean
  elapsed: number
}

const empty: CompiledDocument = {
  blocks: [], meta: null, outline: [], diagnostics: [], lineMap: [], hasDiagrams: false, elapsed: 0,
}

/**
 * Compiles in a worker, off the typing path.
 *
 * The last good document stays on screen while the next one is being built, so
 * the preview never blanks between keystrokes, and every request carries a
 * sequence number so a slow compile can't overwrite a newer one.
 *
 * The very first pass skips syntax highlighting. Shiki and its regex engine are
 * over a megabyte and are fetched lazily, which on a cold cache held the whole
 * document hostage to a code block. Now the paper appears immediately and the
 * colour arrives a moment later — and because blocks are keyed by content hash,
 * the second pass re-renders only the code.
 */
export function useCompiler(
  source: string,
  codeTheme: CompileOptions['codeTheme'],
  /** Stable identity for `codeTheme`, which may be a fresh object each render. */
  codeThemeKey: string,
  delay = 120,
) {
  const workerRef = useRef<Worker | null>(null)
  const sequence = useRef(0)
  const firstPass = useRef(true)
  const latest = useRef({ source, codeTheme })
  latest.current = { source, codeTheme }
  const [document, setDocument] = useState<CompiledDocument>(empty)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/compile.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<CompileResponse>) => {
      const data = event.data
      if (data.id !== sequence.current) return
      setBusy(false)
      if (!data.ok) { setFailure(data.error ?? 'The document could not be compiled.'); return }
      setFailure(null)
      setDocument({
        blocks: data.blocks ?? [],
        meta: data.meta ?? null,
        outline: data.outline ?? [],
        diagnostics: data.diagnostics ?? [],
        lineMap: data.lineMap ?? [],
        hasDiagrams: data.hasDiagrams ?? false,
        elapsed: data.elapsed ?? 0,
      })

      // The unhighlighted first pass is on screen; go back for the colour.
      if (data.highlighted === false) {
        setBusy(true)
        worker.postMessage({
          id: ++sequence.current,
          source: latest.current.source,
          options: { codeTheme: latest.current.codeTheme, highlight: true },
        })
      }
    }
    worker.onerror = () => { setBusy(false); setFailure('The compiler worker stopped responding.') }

    return () => { worker.terminate(); workerRef.current = null }
  }, [])

  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    // The first document should appear immediately; later ones can wait for a
    // pause in typing.
    const wait = sequence.current === 0 ? 0 : delay
    const timer = setTimeout(() => {
      setBusy(true)
      const highlight = !firstPass.current
      firstPass.current = false
      worker.postMessage({ id: ++sequence.current, source, options: { codeTheme, highlight } })
    }, wait)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, codeThemeKey, delay])

  return useMemo(() => ({ document, busy, failure }), [document, busy, failure])
}
