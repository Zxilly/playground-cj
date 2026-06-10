import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import { createEditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { ClassroomSessionProvider } from '@/features/tour-ai/context/classroom-session-context'
import { ViewportRefProvider } from '@/features/tour-ai/context/classroom-viewport-context'
import { deriveChapterIndex } from '@/lib/ai/classroom/selectors'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { ClassroomChapterIndex } from './ClassroomChapterIndex'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function EnWrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'en', messages: { en: enMessages } })
  i18n.activate('en')
  globalI18n.load({ en: enMessages })
  globalI18n.activate('en')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function renderWith(
  session: ReturnType<typeof createInitialClassroomSession>,
  options: { viewport?: HTMLDivElement | null, wrapper?: typeof Wrapper } = {},
) {
  const ref: { current: HTMLDivElement | null } = { current: options.viewport ?? null }
  const WrapperComponent = options.wrapper ?? Wrapper
  return render(
    <WrapperComponent>
      <ClassroomSessionProvider value={{
        session,
        dispatch: () => {},
        hydrated: true,
        hydrationIssue: null,
        saveIssue: null,
        retrySave: () => {},
        resetSession: () => {},
        annotationState: createEditorAnnotationState(),
      }}
      >
        <ViewportRefProvider value={ref}>
          <ClassroomChapterIndex />
        </ViewportRefProvider>
      </ClassroomSessionProvider>
    </WrapperComponent>,
  )
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

describe('classroom chapter index', () => {
  afterEach(() => {
    cleanup()
    document.querySelectorAll('[data-chapter-index-test-viewport]').forEach(element => element.remove())
    vi.restoreAllMocks()
  })

  it('opens an explanatory empty state when stream has no headings', () => {
    renderWith(createInitialClassroomSession({ lang: 'zh' }))
    const trigger = screen.getByRole('button', { name: '课程目录，暂无可跳转章节' }) as HTMLButtonElement

    expect(trigger.disabled).toBe(false)
    expect(trigger.className).toContain('shrink-0')
    expect(describedByText(trigger)).toBe('章节会在课堂内容生成后出现。')
    expect(trigger.getAttribute('title')).toBe('章节会在课堂内容生成后出现。')
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(trigger.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')

    fireEvent.click(trigger)

    const content = screen.getByTestId('classroom-chapter-index-content')
    expect(describedByText(content)).toBe('当前课堂还没有可跳转章节。')
    expect(screen.getByText('尚无章节').className).toContain('break-words')
    const emptyDescription = screen
      .getAllByText('章节会在课堂内容生成后出现。')
      .find(element => element.tagName === 'P')
    expect(emptyDescription?.className).toContain('break-words')
    expect(content.textContent).toContain('章节会在课堂内容生成后出现。')
  })

  it('enables the trigger when content references include heading blocks', () => {
    const session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1,
    })

    renderWith(session)

    const trigger = screen.getByRole('button', { name: '课程目录，1 个章节' }) as HTMLButtonElement
    expect(trigger.disabled).toBe(false)
    expect(describedByText(trigger)).toBe('打开后可跳转到当前课堂中已出现的章节，不会改变课堂进度。')
    expect(trigger.getAttribute('title')).toBe('打开后可跳转到当前课堂中已出现的章节，不会改变课堂进度。')
  })

  it('keeps the chapter popover inside narrow viewports', () => {
    const session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1,
    })

    renderWith(session)
    fireEvent.click(screen.getByRole('button', { name: /课程目录/ }))

    const content = screen.getByTestId('classroom-chapter-index-content')
    expect(content.className).toContain('w-72')
    expect(content.className).toContain('max-w-[calc(100vw-1rem)]')
    expect(content.getAttribute('aria-labelledby')).toBeTruthy()
    expect(content.getAttribute('aria-describedby')).toBeTruthy()
    const chapter = screen.getByRole('button', { name: '标准输出 println' })
    expect(describedByText(chapter)).toBe('跳转后目录会关闭，并把焦点移到对应章节；课堂进度不会改变。')
    expect(chapter.getAttribute('title')).toBe('跳转到 标准输出 println。跳转后目录会关闭，并把焦点移到对应章节；课堂进度不会改变。')
    expect(chapter.className).toContain('min-w-0')
    expect(chapter.className).toContain('truncate')
  })

  it('uses compiled English copy for chapter navigation guardrails', () => {
    const session = classroomReducer(createInitialClassroomSession({ lang: 'en' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1,
    })

    renderWith(session, { wrapper: EnWrapper })

    const trigger = screen.getByRole('button', { name: 'Course index, 1 chapters' })
    expect(describedByText(trigger)).toBe('Open to jump to chapters that have appeared in the current classroom. This will not change classroom progress.')
    expect(trigger.getAttribute('title')).toBe('Open to jump to chapters that have appeared in the current classroom. This will not change classroom progress.')

    fireEvent.click(trigger)

    const content = screen.getByTestId('classroom-chapter-index-content')
    expect(describedByText(content)).toBe('Selecting a chapter scrolls to the matching content in the classroom.')
    const chapter = screen.getByRole('button', { name: 'Standard output println' })
    expect(describedByText(chapter)).toBe('After jumping, the index will close and focus will move to the matching chapter. Classroom progress will not change.')
    expect(chapter.getAttribute('title')).toBe('Jump to Standard output println. After jumping, the index will close and focus will move to the matching chapter. Classroom progress will not change.')
    expect(screen.queryByText('打开后可跳转到当前课堂中已出现的章节，不会改变课堂进度。')).toBeNull()
  })

  it('closes the chapter popover and announces the target after selecting a chapter', async () => {
    const session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1,
    })
    const chapter = deriveChapterIndex(session)[0]
    const viewport = document.createElement('div')
    viewport.setAttribute('data-chapter-index-test-viewport', '')
    const target = document.createElement('section')
    target.setAttribute('data-chapter-id', chapter.blockKey)
    target.tabIndex = -1
    viewport.append(target)
    document.body.append(viewport)
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView

    renderWith(session, { viewport })
    fireEvent.click(screen.getByRole('button', { name: /课程目录/ }))
    fireEvent.click(screen.getByRole('button', { name: '标准输出 println' }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(screen.getByTestId('classroom-chapter-jump-status').textContent).toBe('已跳转到 标准输出 println')
    await waitFor(() => {
      expect(document.activeElement).toBe(target)
    })
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-chapter-index-content')).toBeNull()
    })
  })

  it('does not announce a chapter jump when the target heading is unavailable', async () => {
    const session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1,
    })
    const viewport = document.createElement('div')
    viewport.setAttribute('data-chapter-index-test-viewport', '')
    document.body.append(viewport)

    renderWith(session, { viewport })
    fireEvent.click(screen.getByRole('button', { name: /课程目录/ }))
    fireEvent.click(screen.getByRole('button', { name: '标准输出 println' }))

    expect(screen.getByTestId('classroom-chapter-jump-status').textContent).toBe('')
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-chapter-index-content')).toBeNull()
    })
  })
})
