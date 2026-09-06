import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import rehypeRaw from 'rehype-raw'
import { toHtml } from 'hast-util-to-html'
import type { Root as HastRoot } from 'hast'

import { Context } from './context.js'
import { normalize } from './normalize.js'
import { lumenHandlers } from './handlers.js'
import { lumenSchema } from './sanitize.js'
import { remarkLumenDirective } from './plugins/directive.js'
import { remarkLumenFrontmatter } from './plugins/frontmatter.js'
import { remarkLumenBlocks } from './plugins/blocks.js'
import { remarkLumenHeadings } from './plugins/headings.js'
import { remarkLumenNumbering } from './plugins/numbering.js'
import { remarkLumenXref } from './plugins/xref.js'
import { remarkLumenCite } from './plugins/cite.js'
import { rehypeLumenCode } from './plugins/code.js'
import { rehypeLumenLineMap } from './plugins/linemap.js'
import type { CompileOptions, CompileResult } from './types.js'

export * from './types.js'
export { normalize } from './normalize.js'
export { parseBibtex, formatReference, shortAuthors, type BibEntry } from './bibtex.js'
export { lumenSchema } from './sanitize.js'

/**
 * Compiles a Lumen document.
 *
 * Returns a hast tree rather than an HTML string: the renderer turns it into
 * React elements directly, which keeps `dangerouslySetInnerHTML` out of the
 * application entirely and lets React diff the document between keystrokes.
 *
 * This never throws on document content. Anything wrong with the source comes
 * back in `diagnostics` alongside a best-effort render.
 */
export async function compile(source: string, options: CompileOptions = {}): Promise<CompileResult> {
  const context = new Context()
  context.allowRawHtml = options.allowRawHtml ?? false

  const { source: normalized, equationLabels } = normalize(source)
  context.equationLabels = equationLabels

  const sink = { lineMap: [] as CompileResult['lineMap'] }

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath, { singleDollarTextMath: true })
    .use(remarkLumenDirective)
    .use(remarkLumenFrontmatter, context)
    .use(remarkLumenBlocks, context)
    .use(remarkLumenHeadings, context)
    .use(remarkLumenNumbering, context)
    .use(remarkLumenXref, context)
    .use(remarkLumenCite, context, options.bibliography)
    .use(remarkRehype, {
      handlers: lumenHandlers(context) as never,
      allowDangerousHtml: context.allowRawHtml,
    })

  if (context.allowRawHtml) processor.use(rehypeRaw)

  processor
    .use(rehypeSanitize, lumenSchema)
    .use(rehypeKatex, {
      macros: context.meta.macros,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'htmlAndMathml',
    } as never)
    .use(rehypeLumenCode, context, options.highlight ?? true)
    .use(rehypeLumenLineMap, sink)

  let tree: HastRoot
  try {
    const mdast = processor.parse(normalized)
    tree = (await processor.run(mdast)) as HastRoot
  } catch (error) {
    context.report('error', 'compile-failed', `The document could not be rendered: ${(error as Error).message}`)
    tree = { type: 'root', children: [] }
  }

  return {
    tree,
    html: options.stringify ? toHtml(tree) : undefined,
    meta: context.meta,
    diagnostics: context.diagnostics,
    outline: context.outline,
    registry: [...context.registry.values()],
    lineMap: sink.lineMap,
    hasDiagrams: context.hasDiagrams,
    languages: [...context.languages],
  }
}
