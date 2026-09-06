import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const core = fileURLToPath(new URL('../lumen-core/src/index.ts', import.meta.url))

// Two dependencies in the unified stack pick a browser build that reaches for
// `document` or `DOMParser`. Neither exists in a Web Worker, which is where the
// compiler runs, so both are pinned to their DOM-free builds. The behaviour is
// identical; only the implementation differs.
const nodeBuild = (specifier: string, file: string): [string, string] => [
  specifier,
  fileURLToPath(new URL(`../../node_modules/${specifier}/${file}`, import.meta.url)),
]

export default defineConfig({
  plugins: [react()],
  // The compiler is consumed as source so a single `vite dev` covers both
  // packages and the worker gets the same module graph as the app.
  resolve: {
    alias: {
      'lumen-core': core,
      ...Object.fromEntries([
        nodeBuild('decode-named-character-reference', 'index.js'),
        nodeBuild('hast-util-from-html-isomorphic', 'index.js'),
      ]),
    },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/mermaid') || id.includes('node_modules/dagre') || id.includes('node_modules/cytoscape')) return 'mermaid'
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer')) return 'editor'
          if (id.includes('node_modules/katex')) return 'katex'
        },
      },
    },
  },
})
