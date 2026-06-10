import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { useClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { ClassroomLiveChapterIndex } from './ClassroomLiveChapterIndex'

vi.mock('@/features/tour-ai/context/classroom-live-scroll-surface', () => ({
  useClassroomLiveScrollSurface: vi.fn(),
}))

const mockUseClassroomLiveScrollSurface = vi.mocked(useClassroomLiveScrollSurface)
const printlnChapter = {
  id: 'chapter:println',
  streamItemId: 'stream:println',
  blockKey: 'block:println',
  text: '标准输出 println',
  level: 2,
} satisfies ClassroomLiveScrollSurface['chapterEntries'][number]

function createSurface(chapterEntries = [printlnChapter]): ClassroomLiveScrollSurface['surface'] {
  const latestRunByExercise = new Map()
  return {
    liveView: {
      items: [],
      visibleItems: [],
      latestRunByExercise,
    },
    items: [],
    visibleItems: [],
    visibleCount: chapterEntries.length,
    latestRunByExercise,
    blockTargetsByKey: new Map(),
    exerciseTargetsById: new Map(),
    chapterEntries,
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function describedByText(element: Element): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids.map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ')
}

function renderLiveChapterIndex(overrides: Partial<ClassroomLiveScrollSurface> = {}) {
  const scrollToBlockKey = vi.fn()
  mockUseClassroomLiveScrollSurface.mockReturnValue({
    viewportRef: { current: null },
    surface: createSurface(),
    markers: [],
    chapterEntries: [printlnChapter],
    visibleCount: 1,
    watermarkIndex: -1,
    lens: null,
    follower: {
      pinned: true,
      newContentBelow: false,
      visible: false,
      scrollToBottom: vi.fn(),
    },
    jumpToMarker: vi.fn(),
    scrollToBlockKey,
    scrollToExerciseId: vi.fn(),
    ...overrides,
  } satisfies ClassroomLiveScrollSurface)

  render(<ClassroomLiveChapterIndex />, { wrapper: Wrapper })
  return { scrollToBlockKey }
}

describe('classroom live chapter index', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('opens an explanatory empty state when the live surface has no chapters', () => {
    renderLiveChapterIndex({
      chapterEntries: [],
      surface: createSurface([]),
    })

    const trigger = screen.getByRole('button', { name: '课程目录，暂无可跳转章节' }) as HTMLButtonElement
    expect(trigger.disabled).toBe(false)
    expect(trigger.className).toContain('shrink-0')
    expect(describedByText(trigger)).toBe('章节会在课堂内容生成后出现。')
    expect(trigger.getAttribute('title')).toBe('章节会在课堂内容生成后出现。')
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(trigger.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')

    fireEvent.click(trigger)

    const content = screen.getByTestId('classroom-live-chapter-index-content')
    expect(describedByText(content)).toBe('当前课堂还没有可跳转章节。')
    expect(screen.getByText('尚无章节').className).toContain('break-words')
    const emptyDescription = screen
      .getAllByText('章节会在课堂内容生成后出现。')
      .find(element => element.tagName === 'P')
    expect(emptyDescription?.className).toContain('break-words')
    expect(content.textContent).toContain('章节会在课堂内容生成后出现。')
  })

  it('describes the live chapter trigger before opening the popover', () => {
    renderLiveChapterIndex()

    const trigger = screen.getByRole('button', { name: '课程目录，1 个章节' })
    expect(trigger.className).toContain('shrink-0')
    expect(describedByText(trigger)).toBe('打开后可跳转到当前课堂中已出现的章节，不会改变课堂进度。')
    expect(trigger.getAttribute('title')).toBe('打开后可跳转到当前课堂中已出现的章节，不会改变课堂进度。')
  })

  it('keeps the live chapter popover inside narrow viewports', () => {
    renderLiveChapterIndex()

    fireEvent.click(screen.getByRole('button', { name: /课程目录/ }))

    const content = screen.getByTestId('classroom-live-chapter-index-content')
    expect(content.className).toContain('w-72')
    expect(content.className).toContain('max-w-[calc(100vw-1rem)]')
    expect(describedByText(content)).toBe('选择章节后会滚动到课堂中的对应内容。')
    const chapter = screen.getByRole('button', { name: '标准输出 println' })
    expect(describedByText(chapter)).toBe('跳转后目录会关闭，并把焦点移到对应章节；课堂进度不会改变。')
    expect(chapter.getAttribute('title')).toBe('跳转到 标准输出 println。跳转后目录会关闭，并把焦点移到对应章节；课堂进度不会改变。')
    expect(chapter.className).toContain('min-w-0')
    expect(chapter.className).toContain('truncate')
  })

  it('jumps to the selected chapter and closes the popover', async () => {
    const { scrollToBlockKey } = renderLiveChapterIndex()

    fireEvent.click(screen.getByRole('button', { name: /课程目录/ }))
    fireEvent.click(screen.getByRole('button', { name: '标准输出 println' }))

    expect(scrollToBlockKey).toHaveBeenCalledWith('block:println')
    expect(screen.getByTestId('classroom-live-chapter-jump-status').textContent).toBe('已跳转到 标准输出 println')
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-live-chapter-index-content')).toBeNull()
    })
  })
})
