import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import type { Context } from '../context.js'

type Highlighter = {
  codeToHast: (code: string, options: Record<string, unknown>) => Root
  getLoadedLanguages: () => string[]
  loadLanguage: (lang: string) => Promise<void>
}

let highlighterPromise: Promise<Highlighter | null> | null = null

/**
 * Shiki, loaded once and taught only the languages a document actually uses.
 * Both themes are emitted as CSS variables in one pass, so switching the app
 * between light and dark never re-highlights anything.
 */
async function getHighlighter(languages: string[]): Promise<Highlighter | null> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki')
      .then(({ createHighlighter }) =>
        createHighlighter({
          themes: ['github-light', 'github-dark-dimmed'],
          langs: [],
        }) as unknown as Promise<Highlighter>)
      .catch(() => null)
  }
  const highlighter = await highlighterPromise
  if (!highlighter) return null

  const { bundledLanguages } = await import('shiki')
  const loaded = new Set(highlighter.getLoadedLanguages())
  const wanted = languages.filter((lang) => lang in bundledLanguages && !loaded.has(lang))
  await Promise.all(wanted.map((lang) => highlighter.loadLanguage(lang).catch(() => undefined)))
  return highlighter
}

const textOf = (node: Element): string =>
  node.children.map((child) => (child.type === 'text' ? child.value : child.type === 'element' ? textOf(child) : '')).join('')

export function rehypeLumenCode(context: Context, enabled: boolean) {
  return async (tree: Root) => {
    if (!enabled || context.languages.size === 0) return
    const highlighter = await getHighlighter([...context.languages])
    if (!highlighter) return
    const available = new Set(highlighter.getLoadedLanguages())

    const jobs: Array<() => void> = []
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !parent || typeof index !== 'number') return
      const code = node.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'code',
      )
      if (!code) return
      const classes = (code.properties?.className as string[] | undefined) ?? []
      const lang = classes.map((c) => /^language-(.+)$/.exec(c)?.[1]).find(Boolean)
      if (!lang || !available.has(lang)) return

      jobs.push(() => {
        try {
          const highlighted = highlighter.codeToHast(textOf(code).replace(/\n$/, ''), {
            lang,
            themes: { light: 'github-light', dark: 'github-dark-dimmed' },
            defaultColor: false,
            cssVariablePrefix: '--lmn-tok-',
          })
          const pre = highlighted.children.find(
            (child): child is Element => child.type === 'element' && child.tagName === 'pre',
          )
          if (!pre) return
          pre.properties = {
            ...pre.properties,
            className: [...((pre.properties?.className as string[]) ?? []), 'lmn-code'],
            dataLang: lang,
          }
          parent.children[index] = pre
        } catch {
          context.report('warning', 'highlight-failed', `Couldn't highlight a ${lang} block.`, node.position)
        }
      })
    })
    for (const job of jobs) job()
  }
}
