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

**Themes** — eight of them, and a theme is the whole page rather than a syntax
palette bolted onto a document: links, labels, callouts, diagram shapes and
code all move together. Two are Lumen's own monochrome pair, Paper and Ink.
The rest take their colours from editors you already read code in — One Light,
Solarized, Tokyo Night, One Dark, Nord, Gruvbox — and carry them through the
whole document.

**Export** — print to a PDF that looks typeset, or save one self-contained HTML
file with the diagrams, mathematics and your current theme baked in.

## The look

Prose is set in **Literata**, drawn for reading books on screens: large
x-height, sturdy stems, low contrast. It carries an optical size axis, so the
title is set from the display cut and the body from the text cut rather than
one drawing scaled to both. Body text is 18px on a 1.7 line.

Its lower contrast sits lighter than KaTeX's Computer Modern, so formulas are
set a little larger to bring the two to the same colour, and KaTeX's rule
thickness is raised from 0.04em to 0.06em — fraction bars and radicals are
hairlines at the default and read as flimsy next to Literata. On dark themes
those hairlines thin further, so maths there takes a hundredth of an em of
stroke to hold its weight.

Chrome is Archivo, whose job is to disappear at 13px. Code is IBM Plex Mono,
which has a true bold — the monochrome syntax palettes lean on weight rather
than colour, so a synthesised one would undo them.

Structure never changes with the palette: a theorem is always a rule and a
small-caps label, a callout is always a rule and a run-in italic, a code block
is always a rule and a change of weight. Nor does the highlighting scheme —
Lumen fixes the scope-to-role mapping once (keyword violet, string green,
number orange, function blue, type yellow, operator cyan, tag red) and each
theme supplies colours for those roles from its own family, so code reads the
same way in all eight rather than in eight editors' unrelated schemes. What a theme changes is colour, and
how much of it — a single `--wash` token decides whether callouts are tinted at
all, which is the whole difference between the monochrome themes and the rest.
Figure fills are mixed from each theme's own line colours against its own page,
so a diagram sits at the same distance from the paper in all seven.

Paper and Ink spend colour in exactly one place: figures, where a flowchart's
shapes mean different things and are allowed to look different. Ink is grounded
on #111 with a warmed text colour, because cool grey on a neutral black reads
flat over a long passage. Nothing in the prose is
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

## Licence

AGPL-3.0-only. You can use, modify and redistribute this freely; if you run a
modified version as a network service, that version's source has to be
available to its users too.
