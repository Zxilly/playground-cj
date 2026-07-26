'use client'

import { isValidElement, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { cn } from '@/lib/utils'
import { highlightCangjie } from '@/lib/shiki/cangjie-highlighter'
import { useRootDarkMode } from '@/lib/theme/useRootDarkMode'

/**
 * ```cangjie 围栏代码块：以纯文本为初始/回退状态，异步用 Shiki 高亮后替换。
 */
function CangjieFence({ code }: { code: string }) {
  const [highlight, setHighlight] = useState<{
    key: string
    html: string
  } | null>(null)
  const dark = useRootDarkMode()
  const highlightKey = `${dark ? 'dark' : 'light'}\0${code}`

  useEffect(() => {
    let cancelled = false
    void highlightCangjie(code, { dark }).then((result) => {
      if (!cancelled)
        setHighlight({ key: highlightKey, html: result })
    })
    return () => {
      cancelled = true
    }
  }, [code, dark, highlightKey])

  if (highlight?.key === highlightKey) {
    return (
      <div
        className="teach-shiki my-2 overflow-x-auto rounded-md border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed [&_pre]:!bg-transparent [&_pre]:font-mono"
        dangerouslySetInnerHTML={{ __html: highlight.html }}
      />
    )
  }

  return (
    <pre className="my-2 overflow-x-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs leading-relaxed">
      <code className="font-mono">{code}</code>
    </pre>
  )
}

/**
 * Standalone markdown renderer for validated core content and retained notes.
 *
 * The vendored `@/modules/assistant-ui/registry/MarkdownText` renders chat
 * message content via `MarkdownTextPrimitive`, which reads its text from the
 * assistant-ui thread context and therefore cannot render an arbitrary string.
 * These surfaces render plain markdown strings, so this reuses the same
 * underlying stack (`react-markdown` + `remark-gfm`) the registry is built on
 * and applies styling consistent with the rest of the workspace.
 */
interface TeachMarkdownProps {
  markdown: string
  className?: string
  source?: 'generated' | 'validated'
}

const components: Components = {
  p: ({ className, ...props }) => (
    <p className={cn('aui-md-p my-2 leading-7 first:mt-0 last:mb-0', className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn('font-semibold', className)} {...props} />
  ),
  em: ({ className, ...props }) => <em className={cn('italic', className)} {...props} />,
  a: ({ children, className, href, title }) => {
    const safeHref = safeValidatedUrl(href ?? '')
    if (!safeHref) {
      return (
        <span className={className} title={title}>
          {children}
        </span>
      )
    }
    const external = /^https?:\/\//iu.test(safeHref)
    return (
      <a
        className={cn('text-primary underline underline-offset-2 hover:text-primary/80', className)}
        href={safeHref}
        title={title}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    )
  },
  img: ({ alt }) => (
    <span className="text-sm text-muted-foreground">
      {alt ? `[${alt}]` : '[image omitted]'}
    </span>
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
  pre: ({ className, children, ...props }) => {
    const fence = extractCangjieFence(children)
    if (fence != null) {
      return <CangjieFence code={fence} />
    }
    return (
      <pre
        className={cn(
          'my-2 overflow-x-auto rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs leading-relaxed',
          className,
        )}
        {...props}
      >
        {children}
      </pre>
    )
  },
}

/**
 * 若 `<pre>` 的子节点是一个 ```cangjie 围栏代码 `<code>`，返回其纯文本代码，
 * 否则返回 null（交由默认 `<pre>` 渲染）。
 */
function extractCangjieFence(children: ReactNode): string | null {
  if (!isValidElement(children))
    return null
  const props = children.props as { className?: string, children?: ReactNode }
  const lang = /language-(\w+)/.exec(props.className ?? '')?.[1]
  if (lang !== 'cangjie' && lang !== 'cj')
    return null
  const code = props.children
  return typeof code === 'string' ? code.replace(/\n$/, '') : null
}

const generatedComponents: Components = {
  ...components,
  // Generated links are rendered as inert text. Otherwise a prompt-injected
  // model could encode editor contents in a URL and ask the learner to open it.
  a: ({ children }) => <span>{children}</span>,
}

function safeValidatedUrl(url: string): string {
  const href = url.trim()
  if (!href || [...href].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1F || codePoint === 0x7F || character === '\\'
  })) {
    return ''
  }
  if (href.startsWith('#') || href.startsWith('./') || href.startsWith('../')) {
    return href
  }
  if (href.startsWith('/') && !href.startsWith('//')) {
    return href
  }
  try {
    const parsed = new URL(href)
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && !parsed.username
      && !parsed.password
    )
      ? href
      : ''
  }
  catch {
    return ''
  }
}

export function TeachMarkdown({
  markdown,
  className,
  source = 'generated',
}: TeachMarkdownProps) {
  return (
    <div data-testid="teach-markdown" className={cn('text-[15px] leading-7', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={source === 'validated' ? components : generatedComponents}
        urlTransform={source === 'validated' ? safeValidatedUrl : () => ''}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
