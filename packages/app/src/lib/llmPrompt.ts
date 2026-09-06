import source from '../../../../docs/llm-prompt.md?raw'

/**
 * The instructions half of docs/llm-prompt.md — everything after the `---` that
 * closes the human-facing preamble. Kept in one file so the copy button and the
 * repo documentation can never drift apart.
 */
const SEPARATOR = '\n---\n'
export const LLM_PROMPT: string = source.slice(source.indexOf(SEPARATOR) + SEPARATOR.length).trim()
