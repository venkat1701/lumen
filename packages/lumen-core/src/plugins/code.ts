import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import type { Context } from '../context.js'
import { lumenDarkTheme, lumenLightTheme } from '../theme.js'

type Highlighter = {
  codeToHast: (code: string, options: Record<string, unknown>) => Root
  getLoadedLanguages: () => string[]
  getLoadedThemes: () => string[]
  loadLanguage: (lang: string) => Promise<void>
  loadTheme: (theme: string) => Promise<void>
}

let highlighterPromise: Promise<Highlighter | null> | null = null

/**
 * Shiki, created once and taught only what a document needs: the languages it
 * uses and the theme it is being read in. Lumen's own near-monochrome pair is
 * always available; anything else is a bundled theme fetched on first use.
 */
async function getHighlighter(languages: string[], theme: string): Promise<Highlighter | null> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki')
      .then(({ createHighlighter }) =>
        createHighlighter({
          themes: [lumenLightTheme as never, lumenDarkTheme as never],
          langs: [],
        }) as unknown as Promise<Highlighter>)
      .catch(() => null)
  }
  const highlighter = await highlighterPromise
  if (!highlighter) return null

  const { bundledLanguages, bundledThemes } = await import('shiki')

  if (!highlighter.getLoadedThemes().includes(theme) && theme in bundledThemes) {
    await highlighter.loadTheme(theme).catch(() => undefined)
  }

  const loaded = new Set(highlighter.getLoadedLanguages())
  const wanted = languages.filter((lang) => lang in bundledLanguages && !loaded.has(lang))
  await Promise.all(wanted.map((lang) => highlighter.loadLanguage(lang).catch(() => undefined)))
  return highlighter
}

const textOf = (node: Element): string =>
  node.children.map((child) => (child.type === 'text' ? child.value : child.type === 'element' ? textOf(child) : '')).join('')

/** Themes ship their own page colour; Lumen's code blocks sit on the page. */
function dropBackground(style: unknown): string | undefined {
  if (typeof style !== 'string') return undefined
  const kept = style.split(';').filter((rule) => rule && !rule.trim().startsWith('background'))
  return kept.length ? kept.join(';') : undefined
}

export function rehypeLumenCode(context: Context, enabled: boolean, themeName: string) {
  return async (tree: Root) => {
    if (!enabled || context.languages.size === 0) return
    const highlighter = await getHighlighter([...context.languages], themeName)
    if (!highlighter) return

    const theme = highlighter.getLoadedThemes().includes(themeName) ? themeName : 'lumen-light'
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
          const highlighted = highlighter.codeToHast(textOf(code).replace(/\n$/, ''), { lang, theme })
          const pre = highlighted.children.find(
            (child): child is Element => child.type === 'element' && child.tagName === 'pre',
          )
          if (!pre) return
          pre.properties = {
            ...pre.properties,
            className: [...((pre.properties?.className as string[]) ?? []), 'lmn-code'],
            style: dropBackground(pre.properties?.style),
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
