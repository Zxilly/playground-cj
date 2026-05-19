import type { RichText, RichTextSpan } from './types'

// Backslash-escape the markdown metacharacters that have meaning *inline*:
// emphasis (* _), code (`), link/image brackets ([ ]), and the escape char
// itself. Other markdown metachars (#, >, +, -, |, parens) only matter at line
// boundaries or inside link syntax, so we leave them alone to avoid littering
// the rendered text with stray backslashes.
const MARKDOWN_ESCAPE_RE = /[\\`*_[\]]/g

function escapeMarkdownText(text: string): string {
  return text.replace(MARKDOWN_ESCAPE_RE, m => `\\${m}`)
}

function spanToMarkdown(span: RichTextSpan): string {
  if (span.type === 'text')
    return escapeMarkdownText(span.text)
  if (span.type === 'code')
    return codeSpanToMarkdown(span.code, span.lang)
  return `**${escapeMarkdownText(span.text)}**`
}

function codeSpanToMarkdown(code: string, lang?: string): string {
  // Multi-line code can't survive an inline `code` span — emit a fenced block
  // so newlines and indentation render. Single-line code stays inline.
  if (code.includes('\n')) {
    const language = lang ?? ''
    return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`
  }
  // Inline backtick fencing: use as many backticks as needed to dodge any
  // backticks inside the code, and pad with a space when the code starts or
  // ends with a backtick (CommonMark §6.1).
  let fence = '`'
  while (code.includes(fence))
    fence += '`'
  const padded = code.startsWith('`') || code.endsWith('`') ? ` ${code} ` : code
  return `${fence}${padded}${fence}`
}

export function richTextToMarkdown(body: RichText): string {
  return body.map(spanToMarkdown).join('')
}

export function richTextPlainText(body: RichText): string {
  return body.map((span) => {
    if (span.type === 'code')
      return span.code
    return span.text
  }).join('')
}
