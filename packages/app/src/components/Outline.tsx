import type { OutlineEntry } from 'lumen-core'

export interface OutlineProps {
  entries: OutlineEntry[]
  activeId: string | null
  onSelect: (entry: OutlineEntry) => void
}

export function Outline({ entries, activeId, onSelect }: OutlineProps) {
  const base = entries.length ? Math.min(...entries.map((entry) => entry.depth)) : 1

  return (
    <nav className="outline" aria-label="Document outline">
      <h2 className="outline__head">Contents</h2>
      {entries.length === 0 ? (
        <p className="outline__empty">Headings appear here as you write them.</p>
      ) : (
        entries.map((entry) => (
          <button
            key={entry.id}
            className="outline__item"
            type="button"
            aria-current={entry.id === activeId}
            style={{ paddingLeft: `${0.5 + (entry.depth - base) * 0.85}rem` }}
            onClick={() => onSelect(entry)}
          >
            <span className="outline__num">{entry.number}</span>
            <span className="outline__text">{entry.text}</span>
          </button>
        ))
      )}
    </nav>
  )
}
