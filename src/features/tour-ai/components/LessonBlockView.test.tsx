import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LessonBlockView } from './LessonBlockView'
import type { LessonContentBlock } from '@/lib/ai/classroom/types'

describe('lessonBlockView code highlighting', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders code examples with Shiki tokens and the configured language', async () => {
    render(
      <LessonBlockView
        block={{
          type: 'code_example',
          title: 'TypeScript',
          code: 'const answer = 42',
          language: 'typescript',
        } as unknown as LessonContentBlock}
      />,
    )

    const block = await screen.findByTestId('shiki-code-block')

    expect(block.getAttribute('data-shiki-language')).toBe('typescript')
    await waitFor(() => {
      expect(block.querySelector('[data-shiki-token]')).not.toBeNull()
    })
  })

  it('renders a compare side as a Shiki code block when it is a single {code} part', async () => {
    render(
      <LessonBlockView
        block={{
          type: 'compare',
          leftTitle: 'Cangjie',
          left: [{ type: 'code', code: 'main() {\n    println("Hello")\n}', lang: 'cangjie' }],
          rightTitle: 'Python',
          right: [{ type: 'code', code: 'def main():\n    print("Hello")\n\nif __name__ == "__main__":\n    main()', lang: 'python' }],
        } as unknown as LessonContentBlock}
      />,
    )

    const blocks = await screen.findAllByTestId('shiki-code-block')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].getAttribute('data-shiki-language')).toBe('cangjie')
    expect(blocks[1].getAttribute('data-shiki-language')).toBe('python')
    // Multi-line code preserves separate <span data-line> rows when rendered as a block.
    expect(blocks[0].querySelectorAll('[data-line]').length).toBeGreaterThan(1)
    expect(blocks[1].querySelectorAll('[data-line]').length).toBeGreaterThan(1)
  })

  it('falls back to inline RichTextView when a compare side mixes text and code', async () => {
    render(
      <LessonBlockView
        block={{
          type: 'compare',
          leftTitle: 'Mixed',
          left: [
            { type: 'text', text: 'Use ' },
            { type: 'code', code: 'let x = 1' },
            { type: 'text', text: '.' },
          ],
          rightTitle: 'Python',
          right: [{ type: 'code', code: 'x = 1' }],
        } as unknown as LessonContentBlock}
      />,
    )

    // Left side mixes text + code → inline (no block element on that card).
    const blocks = await screen.findAllByTestId('shiki-code-block')
    expect(blocks).toHaveLength(1) // only the right side becomes a block
    // Inline code from the left side is still rendered.
    const inlineCodes = await screen.findAllByTestId('shiki-inline-code')
    expect(inlineCodes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders inline code inside a paragraph (markdown body) through Shiki', async () => {
    render(
      <LessonBlockView
        block={{
          type: 'paragraph',
          body: 'Use `let value = 1` to declare an immutable binding.',
        } as unknown as LessonContentBlock}
      />,
    )

    const inlineCodes = await screen.findAllByTestId('shiki-inline-code')
    expect(inlineCodes.length).toBeGreaterThanOrEqual(1)
    expect(inlineCodes[0].getAttribute('data-shiki-language')).toBe('cangjie')
    await waitFor(() => {
      expect(inlineCodes[0].querySelector('[data-shiki-token]')).not.toBeNull()
    })
  })

  it('renders a fenced markdown code block inside a paragraph through ShikiCodeBlock', async () => {
    render(
      <LessonBlockView
        block={{
          type: 'paragraph',
          body: '看下面这段:\n\n```typescript\nconst answer = 42\n```',
        } as unknown as LessonContentBlock}
      />,
    )

    const block = await screen.findByTestId('shiki-code-block')
    expect(block.getAttribute('data-shiki-language')).toBe('typescript')
  })
})
