'use client'

import { isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ReactNode } from 'react'
import type { Components } from 'react-markdown'
import { cn } from '@/lib/utils'
import { ShikiCodeBlock, ShikiInlineCode } from '@/features/tour-ai/components/ShikiCode'

// Markdown renderer for lesson body fields (paragraph, concept_card, callout
// bodies, exercise prompts). Inline code falls through to ShikiInlineCode and
// fenced code blocks become ShikiCodeBlock so highlighting stays consistent
// with the rest of the classroom (compare blocks, code_example, etc).

interface MarkdownBodyProps {
  body: string
  className?: string
}

function extractCodeChild(children: ReactNode): { code: string, language?: string } | null {
  // react-markdown nests fenced code as <pre><code className="language-xxx">...</code></pre>.
  // We unwrap the inner <code> element so we can hand its content + language to
  // ShikiCodeBlock instead of letting the default <pre> wrapper render the raw text.
  let codeEl: ReactNode = null
  if (Array.isArray(children)) {
    for (const child of children) {
      if (isValidElement(child)) {
        codeEl = child
        break
      }
    }
  }
  else if (isValidElement(children)) {
    codeEl = children
  }
  if (!isValidElement<{ className?: string, children?: ReactNode }>(codeEl))
    return null
  const props = codeEl.props
  const className = typeof props.className === 'string' ? props.className : ''
  const language = className.match(/language-([\w-]+)/)?.[1]
  const codeText = typeof props.children === 'string' ? props.children : Array.isArray(props.children) ? props.children.join('') : ''
  return { code: codeText.replace(/\n$/, ''), language }
}

const markdownComponents: Components = {
  // Override <pre> to render the fenced code block via Shiki. The default
  // path would just style the raw <pre><code>...</code></pre> with mono font.
  pre({ children }) {
    const extracted = extractCodeChild(children)
    if (!extracted)
      return <pre className="overflow-x-auto rounded-md border border-tour-border bg-tour-code-bg p-3 font-mono text-xs leading-relaxed">{children}</pre>
    return <ShikiCodeBlock code={extracted.code} language={extracted.language} />
  },
  // Inline code only — fenced block code is intercepted in `pre` above and
  // never reaches the `code` component when nested in a <pre>. We still check
  // for the language- className as a safety net for any edge case where the
  // markdown parser emits a <code> outside <pre>.
  code({ className, children }) {
    if (typeof className === 'string' && className.startsWith('language-')) {
      // Already handled by <pre>; fall back to a styled <code> in case we get here standalone.
      return <code className="overflow-x-auto rounded-md border border-tour-border bg-tour-code-bg px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    }
    const text = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : String(children ?? '')
    return <ShikiInlineCode code={text} />
  },
  p({ className, ...props }) {
    return <p className={cn('my-2 leading-7 first:mt-0 last:mb-0', className)} {...props} />
  },
  strong({ className, ...props }) {
    return <strong className={cn('font-semibold', className)} {...props} />
  },
  em({ className, ...props }) {
    return <em className={cn('italic', className)} {...props} />
  },
  ul({ className, ...props }) {
    return <ul className={cn('my-2 list-disc ps-5 marker:text-muted-foreground [&>li]:mt-1', className)} {...props} />
  },
  ol({ className, ...props }) {
    return <ol className={cn('my-2 list-decimal ps-5 marker:text-muted-foreground [&>li]:mt-1', className)} {...props} />
  },
  li({ className, ...props }) {
    return <li className={cn('leading-7', className)} {...props} />
  },
  a({ className, ...props }) {
    return <a className={cn('text-tour-link underline underline-offset-2 hover:text-tour-link/80', className)} target="_blank" rel="noreferrer" {...props} />
  },
  blockquote({ className, ...props }) {
    return <blockquote className={cn('my-2 border-s-2 border-muted-foreground/30 ps-3 italic text-muted-foreground', className)} {...props} />
  },
  h2({ className, ...props }) {
    return <h2 className={cn('mt-3 mb-1.5 text-lg font-semibold first:mt-0', className)} {...props} />
  },
  h3({ className, ...props }) {
    return <h3 className={cn('mt-3 mb-1 text-base font-semibold first:mt-0', className)} {...props} />
  },
  hr({ className, ...props }) {
    return <hr className={cn('my-3 border-muted-foreground/20', className)} {...props} />
  },
}

export function MarkdownBody({ body, className }: MarkdownBodyProps) {
  return (
    <div data-testid="markdown-body" className={cn('text-[15px] leading-7', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {body}
      </ReactMarkdown>
    </div>
  )
}
