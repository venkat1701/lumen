/**
 * A small BibTeX reader.
 *
 * Full BibTeX is a macro language; research documents use a thin slice of it.
 * This handles that slice — entries, brace- and quote-delimited fields, nested
 * braces, and `and`-separated author lists — and ignores the rest rather than
 * pulling in a citation toolkit an order of magnitude larger than this parser.
 */

export interface BibEntry {
  key: string
  type: string
  fields: Record<string, string>
  authors: string[]
  year?: string
  /** Surname of the first author, for author-year citations and sorting. */
  primary: string
}

const LATEX_ESCAPES: Array<[RegExp, string]> = [
  [/\\'\{?([aeiounAEIOUN])\}?/g, '$1'],
  [/\\`\{?([aeiouAEIOU])\}?/g, '$1'],
  [/\\"\{?([aeiouyAEIOUY])\}?/g, '$1'],
  [/\\\^\{?([aeiouAEIOU])\}?/g, '$1'],
  [/\\~\{?([anoANO])\}?/g, '$1'],
  [/\\c\{?([cC])\}?/g, '$1'],
  [/\\ss\b/g, 'ss'],
  [/\\&/g, '&'],
  [/\\%/g, '%'],
  [/\\_/g, '_'],
  [/--/g, '–'],
  [/\\[a-zA-Z]+\s*/g, ''],
]

function clean(value: string): string {
  let out = value.replace(/\s+/g, ' ').trim()
  for (const [pattern, replacement] of LATEX_ESCAPES) out = out.replace(pattern, replacement)
  return out.replace(/[{}]/g, '').trim()
}

/** "Fick, Adolf" and "Adolf Fick" both yield surname "Fick". */
function surname(author: string): string {
  const name = author.trim()
  if (name.includes(',')) return clean(name.split(',')[0])
  const parts = clean(name).split(/\s+/)
  return parts[parts.length - 1] ?? name
}

function splitAuthors(raw: string): string[] {
  return raw
    .split(/\s+and\s+/i)
    .map((a) => clean(a))
    .filter(Boolean)
}

/** Reads a `{...}` or `"..."` value starting at `i`, tracking nesting. */
function readValue(src: string, i: number): { value: string; next: number } {
  while (i < src.length && /\s/.test(src[i])) i++
  const open = src[i]

  if (open === '{') {
    let depth = 0
    const start = ++i
    for (; i < src.length; i++) {
      if (src[i] === '\\') { i++; continue }
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        if (depth === 0) return { value: src.slice(start, i), next: i + 1 }
        depth--
      }
    }
    return { value: src.slice(start), next: src.length }
  }

  if (open === '"') {
    const start = ++i
    for (; i < src.length; i++) {
      if (src[i] === '\\') { i++; continue }
      if (src[i] === '"') return { value: src.slice(start, i), next: i + 1 }
    }
    return { value: src.slice(start), next: src.length }
  }

  const start = i
  while (i < src.length && !/[,}\n]/.test(src[i])) i++
  return { value: src.slice(start, i), next: i }
}

export function parseBibtex(source: string): Map<string, BibEntry> {
  const entries = new Map<string, BibEntry>()
  if (!source) return entries

  const entryStart = /@([A-Za-z]+)\s*[{(]\s*([^,\s}]+)\s*,/g
  let match: RegExpExecArray | null

  while ((match = entryStart.exec(source))) {
    const [, type, key] = match
    if (/^(comment|preamble|string)$/i.test(type)) continue

    const fields: Record<string, string> = {}
    let i = entryStart.lastIndex
    let depth = 0

    while (i < source.length) {
      if (source[i] === '}' && depth === 0) { i++; break }

      const nameMatch = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*=/.exec(source.slice(i, i + 200))
      if (!nameMatch) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') depth = Math.max(0, depth - 1)
        i++
        continue
      }

      i += nameMatch[0].length
      const { value, next } = readValue(source, i)
      fields[nameMatch[1].toLowerCase()] = clean(value)
      i = next
      while (i < source.length && /[\s,]/.test(source[i])) i++
    }

    const authorField = fields.author ?? fields.editor ?? ''
    const authors = splitAuthors(authorField)
    entries.set(key, {
      key,
      type: type.toLowerCase(),
      fields,
      authors,
      year: fields.year ?? fields.date?.slice(0, 4),
      primary: authors.length ? surname(authors[0]) : (fields.title ?? key),
    })
    entryStart.lastIndex = i
  }

  return entries
}

/** "Fick", "Fick and Adams", "Fick et al." — the author part of a citation. */
export function shortAuthors(entry: BibEntry): string {
  const names = entry.authors.map(surname)
  if (names.length === 0) return entry.key
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names[0]} et al.`
}

/** A reference-list line. Deliberately close to a plain author–date style. */
export function formatReference(entry: BibEntry): string {
  const parts: string[] = []
  const names = entry.authors.map((a) => (a.includes(',') ? clean(a) : formatSurnameFirst(a)))

  if (names.length === 1) parts.push(names[0])
  else if (names.length > 1) parts.push(`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

  if (entry.year) parts.push(`(${entry.year})`)
  if (entry.fields.title) parts.push(`${entry.fields.title}.`)

  const venue = entry.fields.journal ?? entry.fields.booktitle ?? entry.fields.publisher
  if (venue) parts.push(`${venue}${entry.fields.volume ? ' ' + entry.fields.volume : ''}${entry.fields.number ? '(' + entry.fields.number + ')' : ''}${entry.fields.pages ? ', ' + entry.fields.pages : ''}.`)
  if (entry.fields.doi) parts.push(`doi:${entry.fields.doi}`)
  else if (entry.fields.url) parts.push(entry.fields.url)

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function formatSurnameFirst(author: string): string {
  const parts = clean(author).split(/\s+/)
  if (parts.length < 2) return parts.join(' ')
  const last = parts.pop() as string
  const initials = parts.map((p) => `${p[0]}.`).join(' ')
  return `${last}, ${initials}`
}
