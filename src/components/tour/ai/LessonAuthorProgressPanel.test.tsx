import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LessonAuthorProgressPanel } from './LessonAuthorProgressPanel'
import { classroomProgressStyles } from './ai-classroom-design'
import { appendLessonAuthorProgress } from './lesson-author-progress-state'

describe('lessonAuthorProgressPanel', () => {
  it('uses shared classroom surface styles and exposes collapsible progress', () => {
    const onToggle = vi.fn()

    render(
      <LessonAuthorProgressPanel
        visible
        progress={{ status: 'running', expanded: true, text: '读取课堂状态' }}
        onToggle={onToggle}
      />,
    )

    expect(screen.getByTestId('lesson-author-progress-panel').className).toContain(classroomProgressStyles.root)
    expect(screen.getByRole('button', { name: /LessonAuthor 编写进度/ }).getAttribute('aria-expanded')).toBe('true')
    screen.getByText('读取课堂状态')

    fireEvent.click(screen.getByRole('button', { name: /LessonAuthor 编写进度/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('caps appended stream text without changing completed panels back to expanded', () => {
    const state = appendLessonAuthorProgress({
      status: 'completed',
      expanded: false,
      text: 'old',
    }, 'new')

    expect(state).toMatchObject({
      status: 'completed',
      expanded: false,
      text: 'oldnew',
    })
  })
})
