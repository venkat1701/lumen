import { directive } from 'micromark-extension-directive'
import { directiveFromMarkdown } from 'mdast-util-directive'
import type { Processor } from 'unified'

/**
 * Container and leaf directives, but not text directives.
 *
 * `remark-directive` also claims `:name` inside a sentence, which collides
 * head-on with Lumen cross-references: in `@thm:missing`, the `:missing` half
 * would be swallowed as a directive. Lumen gives the inline colon to
 * cross-references and keeps directives to their own lines.
 */
export function remarkLumenDirective(this: Processor) {
  const data = this.data() as {
    micromarkExtensions?: unknown[]
    fromMarkdownExtensions?: unknown[]
  }
  const syntax = directive() as { text?: unknown; flow?: unknown }
  delete syntax.text

  ;(data.micromarkExtensions ??= []).push(syntax)
  ;(data.fromMarkdownExtensions ??= []).push(directiveFromMarkdown())
}
