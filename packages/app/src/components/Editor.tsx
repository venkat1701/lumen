import { useEffect, useMemo, useRef } from 'react'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, highlightActiveLine, type DecorationSet } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { Diagnostic } from 'lumen-core'

const setProblems = StateEffect.define<Diagnostic[]>()

/** Lines with a diagnostic get a marker in the editor, so the message in the
 *  problems list always has somewhere to point. */
const problemField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let decorations = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setProblems)) continue
      const ranges = []
      const seen = new Set<number>()
      for (const problem of effect.value) {
        if (problem.severity === 'info' || seen.has(problem.line)) continue
        if (problem.line < 1 || problem.line > transaction.state.doc.lines) continue
        seen.add(problem.line)
        ranges.push(
          Decoration.line({ class: problem.severity === 'error' ? 'cm-lumen-error' : 'cm-lumen-warn' })
            .range(transaction.state.doc.line(problem.line).from),
        )
      }
      decorations = Decoration.set(ranges, true)
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

const palette = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--ink)', fontWeight: '600' },
  { tag: tags.strong, color: 'var(--ink)', fontWeight: '600' },
  { tag: tags.emphasis, color: 'var(--ink)', fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--link)' },
  { tag: tags.url, color: 'var(--link)' },
  { tag: tags.monospace, color: 'var(--ink-2)' },
  { tag: tags.quote, color: 'var(--ink-2)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--ink-3)' },
  { tag: tags.contentSeparator, color: 'var(--ink-4)' },
  { tag: tags.processingInstruction, color: 'var(--ink-4)' },
  { tag: tags.labelName, color: 'var(--link)' },
])

const theme = EditorView.theme({
  '&': { color: 'var(--ink-2)' },
  '.cm-gutters': { display: 'none' },
  '.cm-selectionMatch': { background: 'color-mix(in srgb, var(--ink) 8%, transparent)' },
  '.cm-searchMatch': { outline: '1px solid var(--ink-3)' },
  '.cm-panels': {
    background: 'var(--tone-2)', color: 'var(--ink)',
    borderTop: '1px solid var(--rule)', fontFamily: 'var(--sans)',
  },
  '.cm-panels input, .cm-panels button': {
    border: '1px solid var(--rule-strong)', borderRadius: '2px',
    background: 'var(--paper)', color: 'var(--ink)', font: 'inherit', padding: '2px 6px',
  },
})

export interface EditorProps {
  value: string
  onChange: (value: string) => void
  problems: Diagnostic[]
  onCursorLine?: (line: number) => void
  register?: (api: { goToLine: (line: number) => void }) => void
}

export function Editor({ value, onChange, problems, onCursorLine, register }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const notify = useRef(onChange)
  const notifyLine = useRef(onCursorLine)
  notify.current = onChange
  notifyLine.current = onCursorLine

  const extensions = useMemo<Extension[]>(() => [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(palette),
    highlightActiveLine(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    problemField,
    theme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) notify.current(update.state.doc.toString())
      if (update.selectionSet || update.docChanged) {
        const head = update.state.selection.main.head
        notifyLine.current?.(update.state.doc.lineAt(head).number)
      }
    }),
  ], [])

  useEffect(() => {
    if (!host.current) return
    const instance = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host.current,
    })
    view.current = instance
    register?.({
      goToLine(line) {
        const document = instance.state.doc
        const target = document.line(Math.min(Math.max(1, line), document.lines))
        instance.dispatch({
          selection: { anchor: target.from },
          effects: EditorView.scrollIntoView(target.from, { y: 'center' }),
        })
        instance.focus()
      },
    })
    return () => { instance.destroy(); view.current = null }
    // The view is created once; document and diagnostics are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions])

  // An external change (opening a file, loading the sample) replaces the text;
  // the user's own typing is already in the view and must not round-trip.
  useEffect(() => {
    const instance = view.current
    if (!instance || instance.state.doc.toString() === value) return
    instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: setProblems.of(problems) })
  }, [problems])

  return <div className="editor" ref={host} />
}
