import { useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'

const KEY = 'lumen.document'

export interface StoredDocument {
  source: string
  name: string
}

/** Keeps the current document in IndexedDB so a refresh never loses work. */
export function usePersistedDoc(fallback: StoredDocument) {
  const [document, setDocument] = useState<StoredDocument>(fallback)
  const [restored, setRestored] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let live = true
    get<StoredDocument>(KEY)
      .then((stored) => { if (live && stored?.source) setDocument(stored) })
      .catch(() => undefined)
      .finally(() => { if (live) setRestored(true) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!restored) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void set(KEY, document).catch(() => undefined) }, 600)
    return () => window.clearTimeout(timer.current)
  }, [document, restored])

  return [document, setDocument, restored] as const
}
