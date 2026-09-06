/// <reference lib="webworker" />
import { compile, type CompileOptions } from 'lumen-core'
import type { Element, RootContent } from 'hast'
import { hash } from '../lib/hash.js'

export interface CompileRequest {
  id: number
  source: string
  options?: CompileOptions
}

export interface RenderBlock {
  key: string
  hash: string
  node: RootContent
}

export interface CompileResponse {
  id: number
  ok: boolean
  /** False for the fast first pass, which skips syntax highlighting. */
  highlighted?: boolean
  error?: string
  blocks?: RenderBlock[]
  meta?: Awaited<ReturnType<typeof compile>>['meta']
  outline?: Awaited<ReturnType<typeof compile>>['outline']
  diagnostics?: Awaited<ReturnType<typeof compile>>['diagnostics']
  lineMap?: Awaited<ReturnType<typeof compile>>['lineMap']
  hasDiagrams?: boolean
  elapsed?: number
}

/** Newer work always wins; older jobs stop before they post anything back. */
let latest = 0

self.addEventListener('message', async (event: MessageEvent<CompileRequest>) => {
  const { id, source, options } = event.data
  latest = id
  const started = performance.now()

  try {
    const result = await compile(source, options)
    if (id !== latest) return

    // Hashing here means the main thread can skip untouched blocks without
    // ever walking the tree itself.
    const blocks: RenderBlock[] = result.tree.children.map((node, index) => {
      const signature = JSON.stringify(node)
      const digest = hash(signature)
      const anchor = node.type === 'element' ? ((node as Element).properties?.id as string | undefined) : undefined
      return { key: `${anchor ?? index}-${digest}`, hash: digest, node }
    })

    const response: CompileResponse = {
      id, ok: true, blocks,
      highlighted: options?.highlight !== false,
      meta: result.meta,
      outline: result.outline,
      diagnostics: result.diagnostics,
      lineMap: result.lineMap,
      hasDiagrams: result.hasDiagrams,
      elapsed: Math.round(performance.now() - started),
    }
    self.postMessage(response)
  } catch (error) {
    if (id !== latest) return
    self.postMessage({ id, ok: false, error: (error as Error).message } satisfies CompileResponse)
  }
})
