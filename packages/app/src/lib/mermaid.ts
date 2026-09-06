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

/** Mermaid needs resolved colours, so the app's tokens are read out of the
 *  document and handed over as a theme rather than left as `var(...)`. */
function themeConfig(): MermaidConfig {
  const ink = read('--ink', '#17191c')
  const ink2 = read('--ink-2', '#4c535b')
  const ink3 = read('--ink-3', '#7f868f')
  const page = read('--page-bg', '#ffffff')
  const sunken = read('--sunken-bg', '#f1f2ee')
  const raised = read('--raised-bg', '#f7f7f4')
  const rule = read('--rule-strong', '#c7c9c2')
  const accent = read('--accent', '#17518c')
  const accentWash = read('--accent-wash', '#e6edf7')

  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    flowchart: { curve: 'basis', htmlLabels: true, padding: 14, useMaxWidth: false },
    sequence: { useMaxWidth: false, actorMargin: 60 },
    gantt: { useMaxWidth: false },
    themeVariables: {
      darkMode: read('--page-bg', '#fff').toLowerCase() < '#800000',
      background: 'transparent',
      fontSize: '14px',
      primaryColor: page,
      primaryTextColor: ink,
      primaryBorderColor: rule,
      secondaryColor: sunken,
      tertiaryColor: accentWash,
      mainBkg: page,
      nodeBorder: rule,
      lineColor: ink3,
      textColor: ink,
      edgeLabelBackground: raised,
      clusterBkg: sunken,
      clusterBorder: rule,
      titleColor: ink,
      labelTextColor: ink2,
      noteBkgColor: accentWash,
      noteTextColor: ink,
      noteBorderColor: accent,
      actorBkg: page,
      actorBorder: rule,
      actorTextColor: ink,
      signalColor: ink2,
      signalTextColor: ink2,
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
