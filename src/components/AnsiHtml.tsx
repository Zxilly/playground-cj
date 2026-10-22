'use client'

import type { AnsiOutputProps } from './AnsiOutput'
import { useMemo } from 'react'
import { AnsiUp } from 'ansi_up'

export default function AnsiHtml({ text, ...props }: AnsiOutputProps) {
  const html = useMemo(() => new AnsiUp().ansi_to_html(text), [text])
  return <pre {...props} dangerouslySetInnerHTML={{ __html: html }} />
}
