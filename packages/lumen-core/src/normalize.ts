/**
 * Lumen's block sugar rewritten into `remark-directive` syntax.
 *
 * Lumen is specified as `::: theorem "Cauchy–Schwarz" {#thm:cs}` because that
 * is what a person can type without consulting documentation. remark-directive
 * parses `:::theorem[Cauchy–Schwarz]{#thm:cs}`. Rather than fight a proven
 * micromark extension, we translate between the two — but only ever *within* a
 * line, never across lines, so every source line keeps its original number and
 * the editor's scroll sync and diagnostics stay accurate.
 */

export interface EquationLabel {
  identifier: string
  attributes: string
}

export interface NormalizeResult {
  source: string
  /** Keyed by the 1-based source line of a display equation's closing `$$`. */
  equationLabels: Map<number, EquationLabel>
}

const OPEN_FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/
const BLOCK_OPEN =
  /^(\s{0,3})(:{3,})[ \t]*([A-Za-z][\w-]*)[ \t]*(?:"([^"]*)"|'([^']*)')?[ \t]*(\{[^}]*\})?[ \t]*$/
/** A trailing `{#eq:flux}` on a display-math closing fence. */
const EQ_ATTRS = /^(\s*\$\$)[ \t]*(\{[^}]*\})[ \t]*$/
const INLINE_EQ = /^(\s*\$\$.*\$\$)[ \t]*(\{[^}]*\})[ \t]*$/

function identifierFrom(attributes: string): string | undefined {
  const match = /#([A-Za-z][\w:.-]*)/.exec(attributes)
  return match ? match[1] : undefined
}

export function normalize(input: string): NormalizeResult {
  const lines = input.split('\n')
  const out: string[] = new Array(lines.length)
  const equationLabels = new Map<number, EquationLabel>()

  let fence: string | null = null
  let inFrontmatter = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // YAML frontmatter is opaque; pass it through untouched.
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true
      out[i] = line
      continue
    }
    if (inFrontmatter) {
      if (line.trim() === '---' || line.trim() === '...') inFrontmatter = false
      out[i] = line
      continue
    }

    // Code fences are opaque too — `::: ` inside a sample is not a directive.
    if (fence) {
      out[i] = line
      if (new RegExp(`^\\s{0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = null
      continue
    }
    const fenceMatch = OPEN_FENCE.exec(line)
    if (fenceMatch) {
      fence = fenceMatch[2]
      out[i] = line
      continue
    }

    const block = BLOCK_OPEN.exec(line)
    if (block) {
      const [, indent, colons, name, dquote, squote, attrs] = block
      const title = dquote ?? squote
      const label = title ? `[${title.replace(/([[\]\\])/g, '\\$1')}]` : ''
      out[i] = `${indent}${colons}${name}${label}${attrs ?? ''}`
      continue
    }

    // `$$ ... $$ {#eq:x}` and a closing `$$ {#eq:x}`: strip the attributes and
    // remember the line, so remark-math still sees a well-formed fence.
    const inlineEq = INLINE_EQ.exec(line)
    if (inlineEq) {
      const id = identifierFrom(inlineEq[2])
      if (id) equationLabels.set(i + 1, { identifier: id, attributes: inlineEq[2] })
      out[i] = inlineEq[1]
      continue
    }
    const closeEq = EQ_ATTRS.exec(line)
    if (closeEq) {
      const id = identifierFrom(closeEq[2])
      if (id) equationLabels.set(i + 1, { identifier: id, attributes: closeEq[2] })
      out[i] = closeEq[1]
      continue
    }

    out[i] = line
  }

  return { source: out.join('\n'), equationLabels }
}
