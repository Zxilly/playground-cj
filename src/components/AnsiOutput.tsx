'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { lazy, Suspense } from 'react'
import { stripTerminalSequences } from '@/lib/compiler-output'

export interface AnsiOutputProps extends Omit<ComponentPropsWithoutRef<'pre'>, 'children' | 'dangerouslySetInnerHTML'> {
  text: string
}

const AnsiHtml = lazy(() => import('./AnsiHtml'))

/**
 * Render trusted terminal semantics without trusting terminal text as HTML.
 * ansi_up escapes source markup before adding its own colour spans.
 */
export function AnsiOutput({ text, ...props }: AnsiOutputProps) {
  if (!text.includes('\x1B'))
    return <pre {...props}>{text}</pre>
  return (
    <Suspense fallback={<pre {...props}>{stripTerminalSequences(text)}</pre>}>
      <AnsiHtml text={text} {...props} />
    </Suspense>
  )
}
