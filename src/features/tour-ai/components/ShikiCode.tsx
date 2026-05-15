'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ThemedToken } from 'shiki'
import type { CodeHighlight } from '@/lib/ai/classroom/types'
import { highlightCode, normalizeShikiLanguage } from '@/features/tour-ai/utils/shiki-highlighter'
import type { HighlightedCodeTokens } from '@/features/tour-ai/utils/shiki-highlighter'
import { cn } from '@/lib/utils'

interface ShikiCodeBlockProps {
  code: string
  language?: string
  highlights?: CodeHighlight[]
}

interface ShikiInlineCodeProps {
  code: string
  language?: string
}

type CachedHighlight = HighlightedCodeTokens & { cacheKey: string }

function tokenStyle(token: ThemedToken): CSSProperties | undefined {
  const style: CSSProperties = token.htmlStyle ? { ...token.htmlStyle } : {}

  if (token.color && style.color == null)
    style.color = token.color

  if (typeof token.fontStyle === 'number') {
    if ((token.fontStyle & 1) !== 0)
      style.fontStyle = 'italic'
    if ((token.fontStyle & 2) !== 0)
      style.fontWeight = 700
    if ((token.fontStyle & 4) !== 0)
      style.textDecoration = 'underline'
  }

  return Object.keys(style).length > 0 ? style : undefined
}

function useHighlightedCode(code: string, language?: string) {
  const normalizedLanguage = useMemo(() => normalizeShikiLanguage(language), [language])
  const cacheKey = `${normalizedLanguage}\0${code}`
  const [highlighted, setHighlighted] = useState<CachedHighlight | null>(null)

  useEffect(() => {
    let active = true

    highlightCode(code, normalizedLanguage)
      .then((result) => {
        if (active)
          setHighlighted({ ...result, cacheKey })
      })
      .catch(() => {
        if (active)
          setHighlighted({ language: 'text', tokens: [[{ content: code, offset: 0 }]], cacheKey })
      })

    return () => {
      active = false
    }
  }, [cacheKey, code, normalizedLanguage])

  const fallback: HighlightedCodeTokens = {
    language: normalizedLanguage,
    tokens: code.split(/\r?\n/u).map((line, lineIndex) => [{ content: line, offset: lineIndex }]),
  }

  return highlighted?.cacheKey === cacheKey ? highlighted : fallback
}

function renderToken(token: ThemedToken, key: string) {
  return (
    <span key={key} data-shiki-token="" style={tokenStyle(token)}>
      {token.content}
    </span>
  )
}

function highlightedLineNumbers(highlights?: CodeHighlight[]): Set<number> {
  const lines = new Set<number>()
  for (const highlight of highlights ?? []) {
    const endLine = highlight.endLine ?? highlight.startLine
    for (let line = highlight.startLine; line <= endLine; line += 1)
      lines.add(line)
  }
  return lines
}

export function ShikiCodeBlock({ code, language, highlights }: ShikiCodeBlockProps) {
  const highlighted = useHighlightedCode(code, language)
  const markedLines = useMemo(() => highlightedLineNumbers(highlights), [highlights])

  return (
    <pre
      data-testid="shiki-code-block"
      data-shiki-language={highlighted.language}
      className="shiki overflow-auto rounded-md border border-tour-border bg-tour-code-bg p-4 font-mono text-sm leading-6"
      style={{ color: highlighted.fg }}
    >
      <code>
        {highlighted.tokens.map((line, lineIndex) => {
          const lineNumber = lineIndex + 1
          return (
            <span
              key={`line:${lineNumber}`}
              data-line={lineNumber}
              data-highlighted-line={markedLines.has(lineNumber) ? '' : undefined}
              className={cn('block min-h-6', markedLines.has(lineNumber) && 'bg-tour-accent-fg/10')}
            >
              {line.length > 0
                ? line.map((token, tokenIndex) => renderToken(token, `token:${lineNumber}:${tokenIndex}`))
                : '\u00A0'}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

export function ShikiInlineCode({ code, language }: ShikiInlineCodeProps) {
  const highlighted = useHighlightedCode(code, language)
  const tokens = highlighted.tokens.flatMap((line, lineIndex) => (
    lineIndex === 0 ? line : [{ content: ' ', offset: lineIndex }, ...line]
  ))

  return (
    <code
      data-testid="shiki-inline-code"
      data-shiki-language={highlighted.language}
      className="rounded border border-tour-border bg-tour-code-bg px-1 py-0.5 font-mono text-[0.92em]"
      style={{ color: highlighted.fg }}
    >
      {tokens.map((token, tokenIndex) => renderToken(token, `inline:${tokenIndex}`))}
    </code>
  )
}
