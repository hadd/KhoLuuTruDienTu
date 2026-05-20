import type { Content, JSONContent } from '@tiptap/core'

/**
 * Builds TipTap JSON for inserting math from the math modal.
 *
 * - Single wrapping pair `$...$` with no `$` inside → one `inlineMath` (inner LaTeX only).
 * - Text mixed with `$...$` segments → fragment of `text` + `inlineMath` nodes.
 * - No `$...$` pairs → one `inlineMath` with the whole string (pure LaTeX, same as before).
 *
 * Escaped `\$` inside formulas is not supported; each `$...$` is one inline formula.
 */
export function buildMixedMathInsertContent(trimmed: string): Content {
  if (!trimmed) {
    return []
  }

  // Exactly one $...$ around the whole string; inner must not contain unpaired `$`
  if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
    const inner = trimmed.slice(1, -1)
    if (!inner.includes('$')) {
      return {
        type: 'inlineMath',
        attrs: { latex: inner.trim() },
      }
    }
  }

  const re = /\$([\s\S]*?)\$/g
  const parts: Array<JSONContent> = []
  let lastIndex = 0
  let found = false
  let m: RegExpExecArray | null
  while ((m = re.exec(trimmed)) !== null) {
    found = true
    if (m.index > lastIndex) {
      const text = trimmed.slice(lastIndex, m.index)
      if (text) parts.push({ type: 'text', text })
    }
    const latex = m[1].trim()
    if (latex) {
      parts.push({ type: 'inlineMath', attrs: { latex } })
    }
    lastIndex = re.lastIndex
  }

  if (!found) {
    return {
      type: 'inlineMath',
      attrs: { latex: trimmed },
    }
  }

  if (lastIndex < trimmed.length) {
    const text = trimmed.slice(lastIndex)
    if (text) parts.push({ type: 'text', text })
  }

  if (parts.length === 0) {
    return {
      type: 'inlineMath',
      attrs: { latex: trimmed },
    }
  }

  if (parts.length === 1) {
    return parts[0]
  }

  return parts
}
