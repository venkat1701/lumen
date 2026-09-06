import { describe, expect, it } from 'vitest'
import { compile } from '../src/index.js'
import { parseBibtex } from '../src/bibtex.js'

const render = async (source: string, options = {}) =>
  compile(source, { highlight: false, stringify: true, ...options })

describe('blocks', () => {
  it('numbers theorem-like blocks against a shared counter', async () => {
    const { html } = await render([
      '# Paper', '',
      '::: theorem "Cauchy–Schwarz" {#thm:cs}', 'Statement.', ':::', '',
      '::: lemma {#lem:a}', 'Another.', ':::',
    ].join('\n'))
    expect(html).toContain('Theorem 1.1')
    expect(html).toContain('Lemma 1.2')
    expect(html).toContain('(Cauchy–Schwarz)')
    expect(html).toContain('id="thm:cs"')
  })

  it('restarts the counter in a new section', async () => {
    const { html } = await render([
      '# One', '', '::: theorem', 'A', ':::', '',
      '# Two', '', '::: theorem', 'B', ':::',
    ].join('\n'))
    expect(html).toContain('Theorem 1.1')
    expect(html).toContain('Theorem 2.1')
  })

  it('honours per-type numbering and continuous mode', async () => {
    const { html } = await render([
      '---', 'numbering: { theorem: continuous, theoremStyle: per-type }', '---', '',
      '# H', '', '::: theorem', 'A', ':::', '', '::: lemma', 'B', ':::', '',
      '::: theorem', 'C', ':::',
    ].join('\n'))
    expect(html).toContain('Theorem 1')
    expect(html).toContain('Lemma 1')
    expect(html).toContain('Theorem 2')
  })

  it('closes a proof with a tombstone', async () => {
    const { html } = await render('::: proof\nImmediate.\n:::')
    expect(html).toContain('lmn-proof')
    expect(html).toContain('∎')
  })

  it('takes a figure caption from the final paragraph', async () => {
    const { html } = await render([
      '::: figure {#fig:one}', '![alt](a.png)', '', 'The acquisition path.', ':::',
    ].join('\n'))
    expect(html).toContain('<figcaption')
    expect(html).toContain('Figure 1')
    expect(html).toContain('The acquisition path.')
  })

  it('reports an unknown block without dropping its content', async () => {
    const { html, diagnostics } = await render('::: nonsense\nKeep me.\n:::')
    expect(html).toContain('Keep me.')
    expect(diagnostics.some((d) => d.ruleId === 'unknown-block')).toBe(true)
  })
})

describe('math', () => {
  it('renders inline and display math', async () => {
    const { html } = await render('Let $x^2$ hold.\n\n$$\n\\int_0^1 x\\,dx\n$$')
    expect(html).toContain('katex')
    expect(html).not.toContain('$x^2$')
  })

  it('numbers only labelled equations by default', async () => {
    const { html } = await render([
      '$$', 'a = b', '$$', '',
      '$$', 'J = -D\\nabla\\phi', '$$ {#eq:flux}',
    ].join('\n'))
    expect(html).toContain('id="eq:flux"')
    expect(html).toContain('(1)')
    expect(html?.match(/lmn-eq__number/g)?.length).toBe(1)
  })

  it('leaves currency alone', async () => {
    const { html } = await render('It cost $5 and change.')
    expect(html).toContain('$5')
  })
})

describe('cross-references', () => {
  it('resolves a reference to its kind and number', async () => {
    const { html } = await render([
      '# Intro {#sec:intro}', '',
      '::: theorem {#thm:cs}', 'S.', ':::', '',
      'By @thm:cs and @sec:intro.',
    ].join('\n'))
    expect(html).toContain('>Theorem 1.1</a>')
    expect(html).toContain('>Section 1</a>')
  })

  it('renders a bare number for -@', async () => {
    const { html } = await render('# H\n\n::: theorem {#thm:a}\nS.\n:::\n\nsee -@thm:a')
    expect(html).toContain('>1.1</a>')
  })

  it('groups several references of one kind', async () => {
    const { html } = await render([
      '::: figure {#fig:a}', 'x', '', 'c', ':::', '',
      '::: figure {#fig:b}', 'y', '', 'c', ':::', '',
      'See @fig:a,fig:b.',
    ].join('\n'))
    expect(html).toContain('Figures ')
    expect(html).toContain('>1</a>')
    expect(html).toContain('>2</a>')
  })

  it('flags an unresolved reference instead of hiding it', async () => {
    const { html, diagnostics } = await render('See @thm:missing.')
    expect(html).toContain('?@thm:missing')
    expect(diagnostics.some((d) => d.ruleId === 'xref-unresolved')).toBe(true)
  })

  it('leaves email addresses and handles alone', async () => {
    const { html } = await render('Write to krish@healthbay.ai about it.')
    expect(html).toContain('krish@healthbay.ai')
    expect(html).not.toContain('lmn-xref')
  })
})

const BIB = [
  '```bibtex',
  '@article{fick1855, author = {Adolf Fick}, title = {On liquid diffusion}, journal = {Phil. Mag.}, year = {1855}, volume = {10}, pages = {30--39}}',
  '@book{crank1975, author = {John Crank and Ann Adams}, title = {The Mathematics of Diffusion}, publisher = {OUP}, year = {1975}}',
  '```',
].join('\n')

describe('citations', () => {
  it('numbers citations in order of appearance', async () => {
    const { html } = await render(`${BIB}\n\nAs shown [@crank1975] and [@fick1855].`)
    expect(html).toContain('>1</a>')
    expect(html).toContain('>2</a>')
    expect(html).toContain('lmn-bib')
    expect(html).toContain('Mathematics of Diffusion')
  })

  it('supports author-year style and locators', async () => {
    const { html } = await render(`---\ncitationStyle: author-year\n---\n\n${BIB}\n\nSee [@fick1855, p. 33].`)
    expect(html).toContain('1855')
    expect(html).toContain('p. 33')
    expect(html).toContain('Fick')
  })

  it('renders a narrative citation with the author outside the bracket', async () => {
    const { html } = await render(`${BIB}\n\n@fick1855 measured it.`)
    expect(html).toContain('Fick')
    expect(html).toContain('lmn-cite')
  })

  it('flags an unknown key', async () => {
    const { diagnostics } = await render(`${BIB}\n\n[@ghost]`)
    expect(diagnostics.some((d) => d.ruleId === 'citation-unknown')).toBe(true)
  })

  it('never renders the bibtex fence itself', async () => {
    const { html } = await render(`${BIB}\n\n[@fick1855]`)
    expect(html).not.toContain('@article{')
  })
})

describe('diagrams', () => {
  it('carries mermaid source through as a placeholder', async () => {
    const { html, hasDiagrams } = await render('```mermaid\nflowchart LR\n  A --> B\n```')
    expect(hasDiagrams).toBe(true)
    expect(html).toContain('data-lumen-diagram="mermaid"')
    expect(html).toContain('flowchart LR')
    expect(html).toContain('data-source')
  })

  it('does not treat ::: inside a code fence as a block', async () => {
    const { html } = await render('```\n::: theorem "x"\n:::\n```')
    expect(html).toContain('::: theorem')
    expect(html).not.toContain('lmn-theorem')
  })
})

describe('safety', () => {
  it('strips script and event handlers by default', async () => {
    const { html } = await render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })

  it('still strips scripts when raw HTML is allowed', async () => {
    const { html } = await render('<div class="ok">fine</div><script>alert(1)</script>', { allowRawHtml: true })
    expect(html).toContain('fine')
    expect(html).not.toContain('<script')
  })

  it('rejects javascript: links', async () => {
    const { html } = await render('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })
})

describe('document surface', () => {
  it('reports frontmatter, outline and a line map', async () => {
    const { meta, outline, lineMap } = await render([
      '---', 'title: Diffusion limits', 'authors: [K. Jaiswal, A. Rao]', '---', '',
      '# Intro', '', 'Body.', '', '## Method',
    ].join('\n'))
    expect(meta.title).toBe('Diffusion limits')
    expect(meta.authors.map((a) => a.name)).toEqual(['K. Jaiswal', 'A. Rao'])
    expect(outline.map((o) => o.number)).toEqual(['1', '1.1'])
    expect(lineMap.length).toBeGreaterThan(0)
  })

  it('survives malformed frontmatter', async () => {
    const { diagnostics, html } = await render('---\ntitle: [unclosed\n---\n\nBody.')
    expect(html).toContain('Body.')
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })
})

describe('bibtex', () => {
  it('reads nested braces and author lists', () => {
    const entries = parseBibtex('@article{k, author = {Ann {van der} Berg and B. Cox}, title = {A {Study}}, year = {2001}}')
    const entry = entries.get('k')!
    expect(entry.authors).toHaveLength(2)
    expect(entry.year).toBe('2001')
    expect(entry.fields.title).toBe('A Study')
  })
})

describe('formula diagnostics', () => {
  it('reports a formula that could not be rendered', async () => {
    const { diagnostics, html } = await render('Broken: $\\frac{1}{$ and more.')
    expect(diagnostics.some((d) => d.ruleId === 'math-invalid' || d.ruleId === 'math-strict')).toBe(true)
    expect(html).toContain('more.')
  })

  it('warns about questionable TeX instead of rendering it silently', async () => {
    const { diagnostics } = await render('Unicode in maths: $ä + 1$')
    expect(diagnostics.some((d) => d.ruleId === 'math-strict')).toBe(true)
  })

  it('leaves valid formulas alone', async () => {
    const { diagnostics } = await render('$$\\int_0^1 x^2\\,dx = \\tfrac{1}{3}$$')
    expect(diagnostics.filter((d) => d.ruleId.startsWith('math-'))).toHaveLength(0)
  })
})

describe('typography', () => {
  it('keeps punctuation on the same line as the formula it follows', async () => {
    const { html } = await render('Let it hold at time $t$, and let $Y$ be the outcome.')
    expect(html).toContain('lmn-tie')
    // The comma is inside the tie, not left loose in the following text node.
    expect(html).toMatch(/lmn-tie[\s\S]*?,<\/span>/)
    expect(html).toContain('and let')
  })

  it('leaves display maths alone', async () => {
    const { html } = await render('$$\na = b\n$$')
    expect(html).not.toContain('lmn-tie')
  })

  it('does nothing when no punctuation follows', async () => {
    const { html } = await render('The value $x$ is fine here.')
    expect(html).not.toContain('lmn-tie')
  })
})

describe('repairing malformed input', () => {
  it('reads a three-dollar fence as display maths and says so', async () => {
    const { html, diagnostics } = await render('$$$\na = b\n$$\n\nAfter.')
    expect(html).toContain('katex')
    expect(html).not.toContain('$$')
    expect(diagnostics.some((d) => d.ruleId === 'math-fence-length')).toBe(true)
  })

  it('stops one bad fence from cascading through later formulas', async () => {
    const source = ['$$$', 'a = b', '$$', '', 'Text.', '', '$$', 'c = d', '$$'].join('\n')
    const { html } = await render(source)
    expect(html?.match(/class="katex/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).not.toContain('$$')
  })

  it('accepts * as a YAML list marker and reports it', async () => {
    const { meta, diagnostics } = await render('---\ntitle: T\nauthors:\n\n* name: A. Rao\n---\n\nBody.')
    expect(meta.title).toBe('T')
    expect(meta.authors.map((a) => a.name)).toEqual(['A. Rao'])
    expect(diagnostics.some((d) => d.ruleId === 'frontmatter-list-marker')).toBe(true)
  })

  it('warns when display fences do not pair up', async () => {
    const { diagnostics } = await render('$$\na = b\n$$\n\nText.\n\n$$\nc = d')
    expect(diagnostics.some((d) => d.ruleId === 'math-fence-unbalanced')).toBe(true)
  })

  it('leaves blank lines inside display maths alone', async () => {
    const { html, diagnostics } = await render('$$\n\nq \\rightarrow x\n\n$$')
    expect(html).toContain('katex')
    expect(diagnostics.filter((d) => d.ruleId.startsWith('math-fence'))).toHaveLength(0)
  })
})
