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
import { visit } from 'unist-util-visit'

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
import { rehypeLumenTie } from './plugins/tie.js'
import type { CompileOptions, CompileResult } from './types.js'

export * from './types.js'
export { buildSyntaxTheme, type SyntaxPalette, type SyntaxTheme } from './theme.js'
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
  const seenMathWarnings = new Set<string>()

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
      trust: false,
      output: 'htmlAndMathml',
      // Fraction bars, radicals and rule lines are hairlines at Computer
      // Modern's default; a little more weight is what makes a formula read
      // as solid next to body text.
      minRuleThickness: 0.06,
      errorColor: 'currentColor',
      // `warn` routes KaTeX's own complaints into the document's diagnostics
      // instead of letting questionable TeX render silently.
      strict: (code: string, message: string) => {
        const key = `${code}:${message}`
        if (!seenMathWarnings.has(key)) {
          seenMathWarnings.add(key)
          context.report('warning', 'math-strict', `In a formula: ${message}`)
        }
        return 'ignore'
      },
    } as never)
    .use(rehypeLumenCode, context, options.highlight ?? true, options.codeTheme ?? 'lumen-light')
    .use(rehypeLumenTie)
    .use(rehypeLumenLineMap, sink)

  let tree: HastRoot
  try {
    const mdast = processor.parse(normalized)
    tree = (await processor.run(mdast)) as HastRoot
  } catch (error) {
    context.report('error', 'compile-failed', `The document could not be rendered: ${(error as Error).message}`)
    tree = { type: 'root', children: [] }
  }

  reportMathErrors(tree, context)

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


/** KaTeX renders a failed formula in place; this turns that into a diagnostic
 *  so the problem shows up in the editor rather than only on the page. */
function reportMathErrors(tree: HastRoot, context: Context): void {
  visit(tree, 'element', (node) => {
    const classes = node.properties?.className
    if (!Array.isArray(classes) || !classes.includes('katex-error')) return
    const detail = typeof node.properties?.title === 'string' ? node.properties.title : 'invalid TeX'
    context.report('error', 'math-invalid', `A formula could not be rendered: ${detail}`, node.position)
  })
}
