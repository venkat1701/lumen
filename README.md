# Lumen

Markdown can't render mathematics, has no idea what a theorem is, and turns
diagrams into flat pictures. So research writing ends up in LaTeX, which is
slow to preview, or in Markdown plus a pile of conventions no two tools agree
on.

Lumen is a Markdown superset for research writing, and a reader that displays
it well and fast.

```
::: theorem "Cauchy–Schwarz" {#thm:cs}
$$ |\langle x,y\rangle| \le \|x\|\,\|y\| $$
:::

By @thm:cs the bound in @eq:flux holds for all $t > 0$ [@fick1855].
```

Renders as **Theorem 2.1 (Cauchy–Schwarz)**, with `@thm:cs` becoming a link
that shows the theorem when you hover it, `@eq:flux` becoming "Eq. (7)", and
`[@fick1855]` becoming "[1]" with a reference list built for you.

## Run it

```bash
npm install
npm run dev
```

The app opens with a sample paper loaded. Paste over it, or drop a `.lmd` or
`.md` file anywhere on the page.

```bash
npm run build     # both packages
npm test          # compiler test suite
```

## What it does

**Mathematics** — `$x$` and `$$…$$`, rendered with KaTeX during compilation,
never on the main thread. Label a display equation and it gets a number in the
margin and a citable id.

**Typed blocks** — theorem, lemma, definition, proof, figure, table, callouts
and margin asides, written as `::: kind "Title" {#id}`. Numbered automatically,
by section or continuously, following AMS conventions by default.

**Cross-references** — `@thm:cs` resolves to "Theorem 2.1" and links to it.
Hovering shows the target inline, so following a reference never means losing
your place. A reference that points at nothing says so instead of vanishing.

**Citations** — `[@key]` against a BibTeX block, numeric or author-year, with
the bibliography assembled in the right order.

**Diagrams** — Mermaid, with pan, zoom, fit-to-view,
hover-to-trace-connections, click-to-focus, fullscreen, and SVG or PNG export.
Node shapes are coloured by what they mean — decision, terminal, store,
process — read from the diagram source rather than guessed from the drawing.

**Export** — print to a PDF that looks typeset, or save one self-contained HTML
file with the diagrams and mathematics baked in.

## The look

Prose is set in **Newsreader**. That is a technical choice as much as an
aesthetic one: KaTeX sets mathematics in Computer Modern — high contrast,
vertical stress, sharp terminals — and a body face has to share that colour or
every equation looks pasted in from another document. Newsreader also carries
an optical size axis, so the title is set from the display cut and the body
from the text cut rather than one drawing scaled to both. Chrome is Archivo,
whose job is to disappear at 13px, and code is IBM Plex Mono, which has a true
bold — the syntax theme leans on weight rather than colour, so a synthesised
one would undo it.

The page is monochrome: one ink, three greys, hairline rules, and a blue-black
for links that reads as near-black at text size. Dark mode is grounded on
#111 with a warmed ink, because cool grey text on a neutral black reads flat
over a long passage. Nothing in the prose is
tinted, filled or shadowed — a theorem is a rule and a small-caps label, a
callout is a rule and a run-in italic, a code block is a rule and a change of
weight. The syntax theme is deliberately near-monochrome for the same reason.

Colour is spent in exactly one place: figures, where a flowchart's shapes mean
different things and are allowed to look different. Against a grey page that
distinction is legible at a glance, which is the whole point of spending it
there and nowhere else.

## How it stays fast

The whole compiler runs in a Web Worker, so parsing never competes with typing.
Each top-level block is hashed during compilation and keyed by that hash, so
editing one paragraph of a long paper re-renders that paragraph and nothing
else. Mermaid — half a megabyte — loads only if a document contains a diagram,
and rendered diagrams are cached by source. The syntax highlighter loads only
the languages a document actually uses.

There is deliberately no virtual scrolling: it breaks in-page find, printing
and anchor links, all of which this audience uses. `content-visibility` does
most of the same work without breaking any of them.

## Layout

```
packages/lumen-core   the format: parser, plugins, compiler. No React.
packages/app          the reader and editor: Vite, React 19, TypeScript
docs/spec/lumen-1.0.md the format specification
```

`lumen-core` has no dependency on the application and can be used on its own:

```js
import { compile } from 'lumen-core'

const { tree, diagnostics, outline, meta } = await compile(source)
```

It returns a hast tree rather than an HTML string, so React can diff it and
nothing needs `dangerouslySetInnerHTML`. See
[the specification](docs/spec/lumen-1.0.md) for the full syntax, the class-name
contract and the diagnostic codes.

## Built on

remark and rehype for Markdown that is actually CommonMark-correct, KaTeX for
mathematics, Shiki for code, Mermaid for diagrams, CodeMirror 6 for the editor.
