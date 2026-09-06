# lumen-core

The Lumen format: a Markdown superset for research writing, with mathematics,
typed blocks, automatic numbering, cross-references and citations.

This package is the parser and compiler. It has no dependency on any UI
framework.

```bash
npm install lumen-core
```

```js
import { compile } from 'lumen-core'

const result = await compile(source, {
  highlight: true,      // Shiki, on by default
  stringify: false,     // also return an HTML string
  allowRawHtml: false,  // literal HTML in the source, off by default
  bibliography: undefined, // extra BibTeX, e.g. read from a sidecar file
})
```

`compile` never throws on document content. It returns:

| Field | |
| --- | --- |
| `tree` | a hast tree — the renderer's input |
| `html` | an HTML string, when `stringify` is set |
| `meta` | frontmatter, normalised |
| `diagnostics` | `{severity, ruleId, message, line, column}[]` |
| `outline` | headings with numbers and source lines |
| `registry` | everything that carries an id, with its kind and number |
| `lineMap` | source line → block index, for editor scroll sync |
| `hasDiagrams` | whether the renderer needs to load Mermaid |
| `languages` | code languages the document uses |

A hast tree is returned rather than an HTML string so a renderer can diff it
between keystrokes and no consumer needs `dangerouslySetInnerHTML`.

The full syntax, the `lmn-*` class-name contract and the diagnostic codes are
in [the specification](../../docs/spec/lumen-1.0.md).
