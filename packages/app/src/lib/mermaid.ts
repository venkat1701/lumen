import type { MermaidConfig } from 'mermaid'
import { Lru } from './lru.js'
import { hash } from './hash.js'

type Mermaid = typeof import('mermaid')['default']

let loader: Promise<Mermaid> | null = null
const cache = new Lru<string, string>(64)

/** Mermaid is around half a megabyte. It is only fetched once a document
 *  actually contains a diagram, and only once per session. */
function load(): Promise<Mermaid> {
  loader ??= import('mermaid').then((module) => module.default)
  return loader
}

const read = (name: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/**
 * Mermaid is given a wholly neutral theme — paper, ink and one grey for every
 * line. Shape colour is applied afterwards, in CSS, so it can react to the
 * theme without a re-render and so the palette lives in one place with the
 * rest of the design tokens.
 */
function themeConfig(): MermaidConfig {
  const ink = read('--ink', '#16181a')
  const label = read('--fig-label', '#4a4e52')
  const line = read('--fig-line', '#8d9196')
  const paper = read('--paper', '#fcfcfa')
  const tone = read('--tone', '#f5f5f2')
  const rule = read('--rule-strong', '#c8c9c4')

  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: "'Archivo', system-ui, sans-serif",
    flowchart: { curve: 'basis', htmlLabels: true, padding: 12, nodeSpacing: 44, rankSpacing: 52, useMaxWidth: false },
    sequence: { useMaxWidth: false, actorMargin: 60 },
    gantt: { useMaxWidth: false },
    themeVariables: {
      darkMode: read('--paper', '#fff').toLowerCase() < '#800000',
      background: 'transparent',
      fontSize: '13px',
      primaryColor: paper,
      primaryTextColor: label,
      primaryBorderColor: rule,
      secondaryColor: tone,
      tertiaryColor: tone,
      mainBkg: paper,
      nodeBorder: rule,
      lineColor: line,
      textColor: label,
      edgeLabelBackground: paper,
      clusterBkg: 'transparent',
      clusterBorder: rule,
      titleColor: ink,
      labelTextColor: label,
      noteBkgColor: tone,
      noteTextColor: label,
      noteBorderColor: rule,
      actorBkg: paper,
      actorBorder: rule,
      actorTextColor: label,
      signalColor: line,
      signalTextColor: label,
    },
  }
}

export interface RenderedDiagram {
  svg: string
}

/**
 * Renders a diagram, reusing the last result for the same source and theme.
 * Scrolling, typing elsewhere, and re-rendering the document all hit the cache.
 */
export async function renderDiagram(source: string, theme: string): Promise<RenderedDiagram> {
  const key = `${theme}:${hash(source)}`
  const cached = cache.get(key)
  if (cached) return { svg: cached }

  const mermaid = await load()
  mermaid.initialize(themeConfig())
  const { svg } = await mermaid.render(`lmn-d-${key.replace(/[^\w-]/g, '')}`, source.trim())
  cache.set(key, svg)
  return { svg }
}

export const clearDiagramCache = () => cache.clear()
