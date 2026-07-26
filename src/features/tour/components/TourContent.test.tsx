import type { ComponentProps, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TourContent } from '@/features/tour/components/TourContent'

function MockScrollArea({ children }: { children: ReactNode }) {
  return <section data-testid="scroll-area">{children}</section>
}

function MockMDXRemote(props: { compiledSource?: string }) {
  return <div data-testid="mdx-source">{props.compiledSource}</div>
}

function MockMarkdown({ children }: ComponentProps<'div'>) {
  return <div data-testid="markdown-source">{children}</div>
}

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: MockScrollArea,
}))

vi.mock('next-mdx-remote', () => ({
  MDXRemote: MockMDXRemote,
}))

vi.mock('react-markdown', () => ({
  default: MockMarkdown,
}))

describe('tourContent', () => {
  afterEach(cleanup)

  it('renders compiled MDX for the requested language when available', () => {
    render(
      <TourContent
        lang="en"
        section={{
          sectionName: { zh: '标题', en: 'Title' },
          mdxSource: {
            zh: { compiledSource: 'zh mdx' },
            en: { compiledSource: 'en mdx' },
          },
          markdown: { zh: '# 标题\n\n备用' },
        } as never}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Title' })).toBeTruthy()
    expect(screen.getByTestId('mdx-source').textContent).toBe('en mdx')
  })

  it('falls back to markdown and strips the duplicated top heading', () => {
    render(
      <TourContent
        lang="en"
        section={{
          sectionName: { zh: '中文标题' },
          markdown: { zh: '# 中文标题\n\n正文内容' },
        } as never}
      />,
    )

    expect(screen.getByRole('heading', { name: '中文标题' })).toBeTruthy()
    expect(screen.getByTestId('markdown-source').textContent).toContain('正文内容')
    expect(screen.getByTestId('markdown-source').textContent).not.toContain('# 中文标题')
  })

  it('falls back to compiled Chinese MDX when the requested locale is missing', () => {
    render(
      <TourContent
        lang="en"
        section={{
          sectionName: { zh: '中文标题' },
          mdxSource: {
            zh: { compiledSource: 'zh mdx' },
          },
          markdown: { zh: '# 中文标题\n\n备用' },
        } as never}
      />,
    )

    expect(screen.getByRole('heading', { name: '中文标题' })).toBeTruthy()
    expect(screen.getByTestId('mdx-source').textContent).toBe('zh mdx')
  })
})
