import { useEffect, useRef, useState } from 'react'
import { THEMES } from '../lib/themes.js'
import { useTheme } from '../hooks/useTheme.js'

/** A swatch of the theme's page, ink and one accent — enough to choose by. */
function Swatch({ id }: { id: string }) {
  return (
    <span className="swatch" data-theme={id} aria-hidden="true">
      <i style={{ background: 'var(--paper)' }} />
      <i style={{ background: 'var(--ink-2)' }} />
      <i style={{ background: 'var(--fig-data-line)' }} />
      <i style={{ background: 'var(--fig-decision-line)' }} />
    </span>
  )
}

export function ThemeMenu() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const groups: Array<['light' | 'dark', string]> = [['light', 'Light'], ['dark', 'Dark']]

  return (
    <div style={{ position: 'relative' }} ref={host}>
      <button
        className="btn"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Change theme"
      >
        <Swatch id={theme.id} />
        {theme.name}
      </button>
      {open ? (
        <div className="menu menu--themes" role="menu" style={{ right: 0, top: 'calc(100% + 6px)' }}>
          {groups.map(([mode, label]) => (
            <div key={mode}>
              <div className="menu__group">{label}</div>
              {THEMES.filter((option) => option.mode === mode).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.id === theme.id}
                  onClick={() => { setTheme(option.id); setOpen(false) }}
                >
                  <Swatch id={option.id} />
                  <span className="menu__name">{option.name}</span>
                  <span className="menu__note">{option.note}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
