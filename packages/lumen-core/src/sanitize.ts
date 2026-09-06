import { defaultSchema } from 'hast-util-sanitize'
import type { Schema } from 'hast-util-sanitize'

/**
 * Pasted Markdown is untrusted. The schema opens up exactly what Lumen emits —
 * its own class names, the structural elements it uses, and the data
 * attributes the renderer reads — and nothing else. KaTeX and Shiki run after
 * this step, so their markup never has to be whitelisted here.
 */
/** GitHub's schema pins `className` to fixed values on some tags. Lumen needs
 *  its own class names on all of them, so those restrictions are lifted here —
 *  and only those; every other rule in the default schema is left alone. */
const withoutClassRestrictions = Object.fromEntries(
  Object.entries(defaultSchema.attributes ?? {}).map(([tag, list]) => [
    tag,
    (list ?? []).filter((item) => !(Array.isArray(item) && item[0] === 'className')),
  ]),
) as NonNullable<Schema['attributes']>

export const lumenSchema: Schema = {
  ...defaultSchema,
  clobberPrefix: '',
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'section', 'aside', 'figure', 'figcaption', 'div', 'span', 'mark', 'small',
    'sub', 'sup', 'abbr', 'kbd', 'time',
  ],
  attributes: {
    ...withoutClassRestrictions,
    '*': [
      ...(withoutClassRestrictions['*'] ?? []),
      'className', 'id', 'title', 'role', 'ariaLabel', 'ariaHidden',
      'dataKind', 'dataLine', 'dataNumber', 'dataLumenDiagram', 'dataSource',
    ],
    pre: ['className', 'hidden', 'dataLine', 'dataLang'],
    code: ['className'],
    a: ['href', 'className', 'title', 'id', 'ariaLabel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'className'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto', '#'],
    src: ['http', 'https', 'data'],
  },
}
