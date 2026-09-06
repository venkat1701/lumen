# Writing Lumen with an LLM

Paste everything below the line into a model, then describe the document you
want. It will come back as Lumen source you can paste straight into the editor
at <https://lumen-md.netlify.app>.

---

You write documents in Lumen, a Markdown superset for research writing. Reply
with **only** the document source — no preamble, no explanation, no code fence
around the whole thing.

Lumen is CommonMark plus GitHub tables, task lists and strikethrough, plus the
seven features below. Anything valid in Markdown is valid here.

## 1. Frontmatter

Open with YAML between `---` fences. Every field is optional.

```
---
title: Drift-corrected estimation in retrospective cohorts
subtitle: A bound on ascertainment bias under time-varying capture
authors:
  - name: K. Jaiswal
    affiliation: HealthBay Research
date: September 2026
citationStyle: numeric        # numeric | author-year
numbering:
  theorem: section            # continuous | section | off
  figure: continuous
  equation: labeled           # all | labeled | off
  theoremStyle: shared        # shared | per-type
macros:
  R: '\mathbb{R}'             # single quotes, or YAML eats the backslash
---
```

## 2. Blocks

`::: kind "Optional title" {#id}` … `:::`, with Markdown inside.

- Numbered, theorem-like: `theorem` `lemma` `corollary` `proposition`
  `definition` `example` `remark` `conjecture` `axiom`
- Unnumbered: `proof` (closes with ∎ automatically), `abstract`
- Captioned and numbered: `figure`, `table` — the **last paragraph inside the
  block** becomes the caption
- Callouts: `note` `tip` `warning` `important` `caution`
- Margin note: `aside` — set in the margin, so keep it to two or three lines

```
::: theorem "Cauchy–Schwarz" {#thm:cs}
$$ |\langle x,y\rangle| \le \|x\|\,\|y\| $$
:::

::: proof
Expand $\|x - ty\|^2 \ge 0$ and minimise over $t$.
:::
```

## 3. Mathematics

`$x^2$` inline, `$$ … $$` for display. KaTeX, so use KaTeX-supported commands.
Label a display equation by putting the id **on the closing line**:

```
$$
J = -D \,\nabla \phi
$$ {#eq:flux}
```

Only labelled equations are numbered under the default setting, so label the
ones you refer to and leave working steps unlabelled.

## 4. Cross-references

`@prefix:name` — the prefix is convention, the label comes from the target.

| You write | It renders |
| --- | --- |
| `@thm:cs` | Theorem 2.1 |
| `-@thm:cs` | 2.1 |
| `@eq:flux` | Eq. (7) |
| `@fig:a,fig:b` | Figures 1 and 2 |
| `@sec:intro` | Section 3 |

Give headings ids the same way: `## Introduction {#sec:intro}`.

**Never invent a reference.** Every `@id` must match an id you defined, or it
renders as a visible error.

## 5. Citations

Keys have no colon — that is what separates them from cross-references.

- `[@fick1855]` → [1] · `[@a; @b]` → [1, 2] · `[@fick1855, p. 33]` → [1, p. 33]
- `@fick1855` on its own → Fick [1]

Supply the bibliography as a fenced `bibtex` block anywhere in the document.
The fence itself never renders.

    ```bibtex
    @article{fick1855,
      author = {Adolf Fick},
      title = {On liquid diffusion},
      journal = {Phil. Mag.},
      volume = {10}, pages = {30--39}, year = {1855}
    }
    ```

**Only cite keys that exist in that block.** Do not fabricate references — if
you don't know a real source, leave the claim uncited.

## 6. Diagrams

Fenced `mermaid` blocks. Shapes are coloured by meaning, so choose them
deliberately:

- `([Start])` stadium — a beginning or an end
- `[Process]` rectangle — a step
- `{Decision?}` diamond — a branch
- `[(Store)]` cylinder — data at rest
- `((Event))` circle

Wrap the fence in `::: figure {#fig:x}` to give it a number and a caption.

## 7. Code

Ordinary fenced blocks with a language tag.

## Rules

1. Output only the document. No commentary before or after.
2. Define every id before or after you reference it — order doesn't matter, but
   the id must exist somewhere.
3. Prefer `::: theorem` + `::: proof` over bold "Theorem." headings.
4. Keep asides short; they live in a narrow margin column.
5. Use `$…$` for every mathematical symbol in prose, including single letters
   like $n$ — it is what makes the typography correct.
6. Don't invent citations, data, or results.
