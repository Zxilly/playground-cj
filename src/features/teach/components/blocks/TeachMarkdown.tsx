'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { cn } from '@/lib/utils'

/**
 * Standalone markdown renderer for lesson block bodies (prose / callout).
 *
 * The vendored `@/modules/assistant-ui/registry/MarkdownText` renders chat
 * message content via `MarkdownTextPrimitive`, which reads its text from the
 * assistant-ui thread context and therefore cannot render an arbitrary string.
 * Lesson blocks need to render a plain markdown string, so this reuses the same
 * underlying stack (`react-markdown` + `remark-gfm`) the registry is built on
 * and applies styling consistent with the rest of the workspace.
 */
interface TeachMarkdownProps {
  markdown: string
  className?: string
}

const components: Components = {
  p: ({ className, ...props }) => (
    <p className={cn('aui-md-p my-2 leading-7 first:mt-0 last:mb-0', className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn('font-semibold', className)} {...props} />
  ),
  em: ({ className, ...props }) => <em className={cn('italic', className)} {...props} />,
  a: ({ className, ...props }) => (
    <a
      className={cn('text-primary underline underline-offset-2 hover:text-primary/80', className)}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn('my-2 list-disc ps-5 marker:text-muted-foreground [&>li]:mt-1', className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn('my-2 list-decimal ps-5 marker:text-muted-foreground [&>li]:mt-1', className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn('leading-7', className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn('my-2 border-s-2 border-muted-foreground/30 ps-3 italic text-muted-foreground', className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn('mt-3 mb-1.5 text-lg font-semibold first:mt-0', className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn('mt-3 mb-1 text-base font-semibold first:mt-0', className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn('my-3 border-muted-foreground/20', className)} {...props} />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        'rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]',
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        'my-2 overflow-x-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs leading-relaxed',
        className,
      )}
      {...props}
    />
  ),
}

export function TeachMarkdown({ markdown, className }: TeachMarkdownProps) {
  return (
    <div data-testid="teach-markdown" className={cn('text-[15px] leading-7', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
