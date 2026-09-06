import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OutlineEntry } from 'lumen-core'
import { useCompiler } from './hooks/useCompiler.js'
import { usePersistedDoc } from './hooks/usePersistedDoc.js'
import { useTheme } from './hooks/useTheme.js'
import { DocumentView } from './render/Document.js'
import { Editor } from './components/Editor.js'
import { Outline } from './components/Outline.js'
import { Icon } from './components/Icon.js'
import { ThemeMenu } from './components/ThemeMenu.js'
import { SAMPLE, SAMPLE_NAME } from './lib/sample.js'
import { DEFAULT_LIGHT } from './lib/themes.js'
import { buildStandalone, download } from './lib/exportHtml.js'

type Mode = 'read' | 'split' | 'write'
const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'read', label: 'Read' },
  { id: 'split', label: 'Split' },
  { id: 'write', label: 'Write' },
]

export function App() {
  const [doc, setDoc, restored] = usePersistedDoc({ source: SAMPLE, name: SAMPLE_NAME })
  const [mode, setMode] = useState<Mode>('split')
  const [showOutline, setShowOutline] = useState(true)
  const [showProblems, setShowProblems] = useState(false)
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const [menu, setMenu] = useState(false)
  const [firstPaint, setFirstPaint] = useState(true)

  const { theme, setTheme, toggle } = useTheme()
  const { document: compiled, busy, failure } = useCompiler(doc.source, theme.code)

  const preview = useRef<HTMLDivElement>(null)
  const editorApi = useRef<{ goToLine: (line: number) => void } | null>(null)
  const syncLock = useRef(0)
  const restoreTheme = useRef<string | null>(null)
  const [printPending, setPrintPending] = useState(false)

  const setSource = useCallback((source: string) => setDoc((d) => ({ ...d, source })), [setDoc])

  const problems = useMemo(
    () => compiled.diagnostics.filter((d) => d.severity !== 'info'),
    [compiled.diagnostics],
  )
  const errorCount = problems.filter((d) => d.severity === 'error').length
  const words = useMemo(
    () => (doc.source.trim() ? doc.source.trim().split(/\s+/).length : 0),
    [doc.source],
  )

  useEffect(() => {
    if (compiled.blocks.length && firstPaint) {
      const id = setTimeout(() => setFirstPaint(false), 400)
      return () => clearTimeout(id)
    }
  }, [compiled.blocks.length, firstPaint])

  /* ------------------------------ scroll sync ------------------------------ */

  const scrollPreviewToLine = useCallback((line: number) => {
    const container = preview.current
    if (!container || Date.now() < syncLock.current) return
    let best: { line: number; index: number } | null = null
    for (const entry of compiled.lineMap) {
      if (entry.line <= line && (!best || entry.line > best.line)) best = entry
    }
    if (!best) return
    const target = container.querySelector<HTMLElement>(`[data-block="${best.index}"]`)
    if (!target) return
    syncLock.current = Date.now() + 220
    container.scrollTo({
      top: target.offsetTop - container.clientHeight * 0.25,
      behavior: 'smooth',
    })
  }, [compiled.lineMap])

  /* ------------------------------ scroll spy ------------------------------- */

  useEffect(() => {
    const container = preview.current
    if (!container) return
    const headings = container.querySelectorAll<HTMLElement>('.lmn-doc :is(h1,h2,h3,h4)[id]')
    if (headings.length === 0) { setActiveHeading(null); return }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveHeading(visible[0].target.id)
      },
      { root: container, rootMargin: '-8% 0px -70% 0px', threshold: 0 },
    )
    for (const heading of headings) observer.observe(heading)
    return () => observer.disconnect()
  }, [compiled.blocks])

  const goToHeading = useCallback((entry: OutlineEntry) => {
    const container = preview.current
    const target = container?.querySelector<HTMLElement>(`[id="${CSS.escape(entry.id)}"]`)
    if (container && target) {
      syncLock.current = Date.now() + 400
      container.scrollTo({ top: target.offsetTop - 24, behavior: 'smooth' })
    }
    if (mode !== 'read') editorApi.current?.goToLine(entry.line)
  }, [mode])

  /* --------------------------------- files -------------------------------- */

  const openFile = useCallback(async (file: File) => {
    const text = await file.text()
    setDoc({ source: text, name: file.name })
  }, [setDoc])

  useEffect(() => {
    const over = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      setDropping(true)
    }
    const leave = (event: DragEvent) => {
      if (event.relatedTarget) return
      setDropping(false)
    }
    const drop = (event: DragEvent) => {
      event.preventDefault()
      setDropping(false)
      const file = event.dataTransfer?.files?.[0]
      if (file) void openFile(file)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [openFile])

  const pickFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.lmd,.md,.markdown,.txt,text/markdown,text/plain'
    input.onchange = () => { const file = input.files?.[0]; if (file) void openFile(file) }
    input.click()
  }, [openFile])

  const exportStandalone = useCallback(() => {
    setMenu(false)
    try {
      const title = compiled.meta?.title ?? doc.name.replace(/\.[^.]+$/, '')
      download(buildStandalone(title), `${doc.name.replace(/\.[^.]+$/, '')}.html`)
    } catch (cause) {
      window.alert((cause as Error).message)
    }
  }, [compiled.meta, doc.name])

  /* Code colours are baked into the compiled tree, so a dark theme would print
   * light text onto white paper. The document is switched to Paper, printed
   * once the recompile lands, and switched back. */
  const printDocument = useCallback(() => {
    setMenu(false)
    if (theme.mode !== 'dark') { window.print(); return }
    restoreTheme.current = theme.id
    setTheme(DEFAULT_LIGHT)
    setPrintPending(true)
  }, [setTheme, theme.id, theme.mode])

  useEffect(() => {
    if (!printPending || busy) return
    const timer = setTimeout(() => {
      window.print()
      setPrintPending(false)
      if (restoreTheme.current) { setTheme(restoreTheme.current); restoreTheme.current = null }
    }, 180)
    return () => clearTimeout(timer)
  }, [printPending, busy, setTheme])

  const saveSource = useCallback(() => {
    setMenu(false)
    download(doc.source, doc.name, 'text/markdown')
  }, [doc.name, doc.source])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(false); setShowProblems(false) }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveSource()
      }
      // Shift-D flips between the two monochrome themes without opening the menu.
      if (event.shiftKey && event.key === 'D' && !event.metaKey && !event.ctrlKey
          && !(event.target as HTMLElement)?.closest?.('.cm-editor, input, textarea')) {
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveSource, toggle])

  const isEmpty = restored && doc.source.trim().length === 0

  return (
    <div className={`app${dropping ? ' dropping' : ''}`}>
      <header className="chrome">
        <div className="chrome__mark">Lumen<span>{doc.name}</span></div>
        <span className="chrome__spacer" />

        <div className="tabs" role="group" aria-label="View">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="tools">
          <button className="btn btn--icon" type="button" onClick={() => setShowOutline((v) => !v)}
            title="Toggle contents" aria-pressed={showOutline} aria-label="Toggle contents">
            <Icon name="panel" />
          </button>
          <button className="btn btn--icon" type="button" onClick={pickFile} title="Open a file" aria-label="Open a file">
            <Icon name="file" />
          </button>
          <ThemeMenu />

          <div style={{ position: 'relative' }}>
          <button className="btn" type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
            Export
          </button>
          {menu ? (
            <div className="menu" style={{ right: 0, top: 'calc(100% + 6px)' }} role="menu">
              <button type="button" onClick={printDocument}>
                Print or save as PDF <kbd>⌘P</kbd>
              </button>
              <button type="button" onClick={exportStandalone}>Standalone HTML</button>
              <button type="button" onClick={saveSource}>Lumen source <kbd>⌘S</kbd></button>
            </div>
          ) : null}
          </div>
        </div>
      </header>

      <div className="workspace" data-outline={showOutline && mode !== 'write'}>
        {showOutline && mode !== 'write' ? (
          <Outline entries={compiled.outline} activeId={activeHeading} onSelect={goToHeading} />
        ) : null}

        <div className="panes" data-mode={mode}>
          {mode !== 'read' ? (
            <div className="pane pane--editor">
              <Editor
                value={doc.source}
                onChange={setSource}
                problems={problems}
                onCursorLine={scrollPreviewToLine}
                register={(api) => { editorApi.current = api }}
              />
              {problems.length > 0 || failure ? (
                <>
                  <div className="status">
                    <span>{busy ? 'Compiling' : `${compiled.elapsed} ms`}</span>
                    <span>{words.toLocaleString()} words</span>
                    <button type="button" className={errorCount ? 'status__flag' : undefined}
                      onClick={() => setShowProblems((v) => !v)}>
                      {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
                    </button>
                  </div>
                  {showProblems ? (
                    <div className="problems">
                      <ol>
                        {problems.map((problem, index) => (
                          <li key={`${problem.ruleId}-${index}`} data-severity={problem.severity}>
                            <button type="button" onClick={() => editorApi.current?.goToLine(problem.line)}>
                              {problem.line}
                            </button>
                            <span className="problems__msg">{problem.message}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="status">
                  <span>{busy ? 'Compiling' : `Rendered in ${compiled.elapsed} ms`}</span>
                  <span>{words.toLocaleString()} words</span>
                </div>
              )}
            </div>
          ) : null}

          {mode !== 'write' ? (
            <div className="pane pane--preview" ref={preview}>
              <div className="sheet-wrap">
                {isEmpty ? (
                  <EmptyState onSample={() => setDoc({ source: SAMPLE, name: SAMPLE_NAME })} onOpen={pickFile} />
                ) : (
                  <div className={`sheet${firstPaint ? ' sheet--entering' : ''}`}>
                    <DocumentView blocks={compiled.blocks} meta={compiled.meta} />
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSample, onOpen }: { onSample: () => void; onOpen: () => void }) {
  return (
    <div className="empty">
      <h2>Nothing to render yet</h2>
      <p>Paste a document into the editor, or drop an <code>.lmd</code> or <code>.md</code> file anywhere on this page.</p>
      <div className="empty__actions">
        <button className="btn" type="button" onClick={onSample}>Load the sample paper</button>
        <button className="btn" type="button" onClick={onOpen}>Open a file</button>
      </div>
    </div>
  )
}
