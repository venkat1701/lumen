import type { Element, Root } from 'hast'
import type { CompileResult } from '../types.js'

/**
 * Stamps every top-level element with the source line it came from. The editor
 * uses this to keep the preview aligned while scrolling, which is why it has to
 * be the last thing to touch the tree.
 */
export function rehypeLumenLineMap(sink: { lineMap: CompileResult['lineMap'] }) {
  return (tree: Root) => {
    let index = 0
    for (const child of tree.children) {
      if (child.type !== 'element') continue
      const line = child.position?.start.line
      const element = child as Element
      element.properties = { ...element.properties, 'data-line': line ?? null, 'data-block': index }
      if (line !== undefined) sink.lineMap.push({ line, index })
      index++
    }
  }
}
