'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { useMemo } from 'react'
import { AnsiUp } from 'ansi_up'

interface AnsiOutputProps extends Omit<ComponentPropsWithoutRef<'pre'>, 'children' | 'dangerouslySetInnerHTML'> {
  text: string
}

/**
 * Render trusted terminal semantics without trusting terminal text as HTML.
 * ansi_up escapes source markup before adding its own colour spans.
 */
export function AnsiOutput({ text, ...props }: AnsiOutputProps) {
  const html = useMemo(() => new AnsiUp().ansi_to_html(text), [text])

  return <pre {...props} dangerouslySetInnerHTML={{ __html: html }} />
}
