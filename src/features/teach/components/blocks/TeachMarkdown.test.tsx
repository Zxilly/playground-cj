import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TeachMarkdown } from './TeachMarkdown'

const highlighting = vi.hoisted(() => ({ highlight: vi.fn(), loaded: vi.fn() }))

vi.mock('@/lib/shiki/cangjie-highlighter', () => {
  highlighting.loaded()
  return { highlightCangjie: highlighting.highlight }
})

afterEach(() => {
  cleanup()
  highlighting.highlight.mockReset()
})

describe('teach Markdown trust boundary', () => {
  it('never creates image requests and renders generated links as inert text', () => {
    const { container } = render(
      <TeachMarkdown markdown={'[encoded editor](https://attacker.invalid/?code=secret)\n\n![pixel](https://attacker.invalid/pixel)'} />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('encoded editor')).toBeTruthy()
    expect(screen.getByText('[pixel]')).toBeTruthy()
    expect(highlighting.loaded).not.toHaveBeenCalled()
  })

  it('allows safe links from validated content but still omits images', () => {
    const { container } = render(
      <TeachMarkdown
        source="validated"
        markdown={'[docs](https://developer.huawei.com/)\n\n![diagram](https://example.com/diagram.png)'}
      />,
    )

    expect(screen.getByRole('link', { name: 'docs' }).getAttribute('href'))
      .toBe('https://developer.huawei.com/')
    expect(container.querySelector('img')).toBeNull()
  })

  it('rejects protocol-relative, credential-bearing, and script links from validated content', () => {
    const { container } = render(
      <TeachMarkdown
        source="validated"
        markdown={[
          '[protocol relative](//attacker.invalid/path)',
          '[credentials](https://learner:secret@attacker.invalid/path)',
          '[script](javascript:alert(1))',
        ].join('\n\n')}
      />,
    )

    expect(container.querySelector('a')).toBeNull()
    expect(screen.getByText('protocol relative')).toBeTruthy()
    expect(screen.getByText('credentials')).toBeTruthy()
    expect(screen.getByText('script')).toBeTruthy()
  })

  it('keeps embedded document headings subordinate to the workspace view title', () => {
    render(<TeachMarkdown source="validated" markdown={'# Lesson\n\n## Detail\n\n### Note'} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Lesson' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Detail' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Note' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('keeps code readable when the optional syntax highlighter fails', async () => {
    highlighting.highlight.mockRejectedValue(new Error('offline'))
    const { container } = render(<TeachMarkdown markdown={'```cangjie\nlet answer = 42\n```'} />)

    expect(container.querySelector('pre code')?.textContent).toBe('let answer = 42')
    await waitFor(() => expect(highlighting.highlight).toHaveBeenCalledOnce())
    expect(container.querySelector('pre code')?.textContent).toBe('let answer = 42')
  })
})
