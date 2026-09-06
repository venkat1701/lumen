/**
 * Standalone export.
 *
 * The file is built from what is actually on screen — including diagrams,
 * which are already inline SVG by the time they are rendered — so the export
 * is a faithful copy rather than a second rendering path that can drift.
 */
function collectStyles(): string {
  const parts: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) parts.push(rule.cssText)
    } catch {
      // A cross-origin sheet (the web font) can't be read; it is linked instead.
    }
  }
  return parts.join('\n')
}

const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;0,7..72,700;1,7..72,400;1,7..72,500;1,7..72,600&display=swap'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

export function buildStandalone(title: string): string {
  const article = document.querySelector('.lmn-doc')
  if (!article) throw new Error('Nothing to export yet.')

  const clone = article.cloneNode(true) as HTMLElement
  // Pan and zoom are interactive state; the exported file starts from a clean view.
  for (const canvas of clone.querySelectorAll<HTMLElement>('.diagram__canvas')) {
    canvas.style.transform = ''
    canvas.removeAttribute('data-focused')
  }
  for (const stage of clone.querySelectorAll<HTMLElement>('.diagram__stage')) {
    stage.style.height = 'auto'
    stage.style.overflow = 'visible'
  }
  for (const bar of clone.querySelectorAll('.diagram__bar, .diagram__hint')) bar.remove()

  const theme = document.documentElement.dataset.theme ?? 'light'

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${FONTS.replace(/&/g, '&amp;')}">
<style>
${collectStyles()}
body { margin: 0; background: var(--paper); }
.export-sheet { container: prose / inline-size; max-width: 52rem; margin: 0 auto; padding: 4.5rem 3rem 7rem; min-height: 100vh; }
.diagram__stage { height: auto !important; cursor: default; }
</style>
</head>
<body>
<main class="export-sheet">
${clone.outerHTML}
</main>
</body>
</html>`
}

export function download(content: string, filename: string, type = 'text/html'): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
