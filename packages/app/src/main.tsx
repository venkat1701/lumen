import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './styles/tokens.css'
import './styles/themes.css'
import './styles/app.css'
import './styles/prose.css'
import './styles/print.css'
import { App } from './App.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
