import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonBlockView } from './LessonBlockView'
import type { LessonContentBlock } from '@/lib/ai/classroom/types'

describe('lessonBlockView code highlighting', () => {
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

  it('highlights inline code as Cangjie by default and honors explicit language hints', async () => {
    render(
      <LessonBlockView
        block={{
          type: 'paragraph',
          body: [
            { text: 'Use ' },
            { code: 'let value = 1' },
            { text: ' and compare with ' },
            { code: 'const value = 1', lang: 'typescript' },
            { text: '.' },
          ],
        } as unknown as LessonContentBlock}
      />,
    )

    const inlineCodes = await screen.findAllByTestId('shiki-inline-code')

    expect(inlineCodes[0].getAttribute('data-shiki-language')).toBe('cangjie')
    expect(inlineCodes[1].getAttribute('data-shiki-language')).toBe('typescript')
    await waitFor(() => {
      expect(inlineCodes[0].querySelector('[data-shiki-token]')).not.toBeNull()
      expect(inlineCodes[1].querySelector('[data-shiki-token]')).not.toBeNull()
    })
  })
})
