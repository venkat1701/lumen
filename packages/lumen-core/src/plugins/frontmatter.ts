import { parse as parseYaml } from 'yaml'
import type { Root } from 'mdast'
import type { Context } from '../context.js'
import { defaultNumbering, type Author, type LumenMeta } from '../types.js'

function toAuthors(input: unknown): Author[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : [input]
  return list.flatMap((entry): Author[] => {
    if (typeof entry === 'string') return [{ name: entry }]
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>
      const name = typeof record.name === 'string' ? record.name : undefined
      if (!name) return []
      return [{
        name,
        affiliation: typeof record.affiliation === 'string' ? record.affiliation : undefined,
        email: typeof record.email === 'string' ? record.email : undefined,
        orcid: typeof record.orcid === 'string' ? record.orcid : undefined,
      }]
    }
    return []
  })
}

/** Reads YAML frontmatter into `context.meta` and removes it from the tree. */
export function remarkLumenFrontmatter(context: Context) {
  return (tree: Root) => {
    const index = tree.children.findIndex((child) => child.type === 'yaml')
    if (index === -1) return
    const raw = (tree.children[index] as { value: string }).value
    tree.children.splice(index, 1)

    let data: Record<string, unknown>
    try {
      data = (parseYaml(raw) ?? {}) as Record<string, unknown>
    } catch (error) {
      context.report('error', 'frontmatter-invalid', `Frontmatter isn't valid YAML: ${(error as Error).message}`, { start: { line: 1, column: 1 } })
      return
    }
    if (typeof data !== 'object' || data === null) return

    const meta = context.meta
    const str = (key: keyof LumenMeta) => {
      const value = data[key]
      if (typeof value === 'string') (meta as unknown as Record<string, unknown>)[key] = value
      else if (typeof value === 'number' || value instanceof Date) {
        (meta as unknown as Record<string, unknown>)[key] = String(value)
      }
    }
    str('title'); str('subtitle'); str('date'); str('abstract'); str('bib'); str('lang')

    meta.authors = toAuthors(data.authors ?? data.author)
    if (data.citationStyle === 'author-year' || data.citationStyle === 'numeric') {
      meta.citationStyle = data.citationStyle
    }
    if (typeof data.toc === 'boolean') meta.toc = data.toc
    if (data.macros && typeof data.macros === 'object') {
      for (const [name, value] of Object.entries(data.macros as Record<string, unknown>)) {
        if (typeof value === 'string') meta.macros[name.startsWith('\\') ? name : `\\${name}`] = value
      }
    }
    if (data.numbering && typeof data.numbering === 'object') {
      const numbering = data.numbering as Record<string, unknown>
      const modes = ['continuous', 'section', 'off']
      for (const key of ['theorem', 'figure', 'table'] as const) {
        if (typeof numbering[key] === 'string' && modes.includes(numbering[key] as string)) {
          meta.numbering[key] = numbering[key] as never
        }
      }
      if (['all', 'labeled', 'off'].includes(numbering.equation as string)) {
        meta.numbering.equation = numbering.equation as never
      }
      if (numbering.theoremStyle === 'shared' || numbering.theoremStyle === 'per-type') {
        meta.numbering.theoremStyle = numbering.theoremStyle
      }
    } else {
      meta.numbering = { ...defaultNumbering }
    }
  }
}
