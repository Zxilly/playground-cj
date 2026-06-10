import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { useClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import type { ScrollRailMarker } from '@/features/tour-ai/utils/scroll-rail-markers'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { ClassroomScrollRail } from './ClassroomScrollRail'

vi.mock('@/features/tour-ai/context/classroom-live-scroll-surface', () => ({
  useClassroomLiveScrollSurface: vi.fn(),
}))

const mockUseClassroomLiveScrollSurface = vi.mocked(useClassroomLiveScrollSurface)

const activeExerciseMarker = {
  id: 'exercise:1',
  visibleIndex: 1,
  visibleCount: 5,
  kind: 'exercise',
  label: '练习',
  attention: 'active_exercise',
} satisfies ScrollRailMarker

const failureMarker = {
  id: 'failure:1',
  visibleIndex: 3,
  visibleCount: 5,
  kind: 'failure',
  label: '练习需要再检查',
  attention: 'failure_pending',
} satisfies ScrollRailMarker

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

function renderRail(markers: ScrollRailMarker[] = [activeExerciseMarker, failureMarker], wrapper: typeof Wrapper = Wrapper) {
  const jumpToMarker = vi.fn()
  mockUseClassroomLiveScrollSurface.mockReturnValue({
    viewportRef: { current: null },
    surface: {
      liveView: { items: [], visibleItems: [], latestRunByExercise: new Map() },
      items: [],
      visibleItems: [],
      visibleCount: markers.length,
      latestRunByExercise: new Map(),
      chapterEntries: [],
      blockTargetsByKey: new Map(),
      exerciseTargetsById: new Map(),
    },
    markers,
    chapterEntries: [],
    visibleCount: markers.length,
    watermarkIndex: -1,
    lens: null,
    follower: {
      pinned: true,
      newContentBelow: false,
      visible: false,
      scrollToBottom: vi.fn(),
    },
    jumpToMarker,
    scrollToBlockKey: vi.fn(),
    scrollToExerciseId: vi.fn(),
  } satisfies ClassroomLiveScrollSurface)

  render(<ClassroomScrollRail />, { wrapper })
  return { jumpToMarker }
}

describe('classroom scroll rail', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('exposes the rail as classroom navigation, not a fake scrollbar', () => {
    renderRail()

    screen.getByRole('navigation', { name: '课堂导航' })
    expect(screen.queryByRole('scrollbar')).toBeNull()
  })

  it('describes marker jumps with position and attention context', () => {
    const { jumpToMarker } = renderRail()

    const active = screen.getByRole('button', { name: '跳转到当前练习：练习，第 2 / 5 项' })
    const failure = screen.getByRole('button', { name: '跳转到待处理失败：练习需要再检查，第 4 / 5 项' })
    expect(active.getAttribute('title')).toBe('跳转到当前练习：练习，第 2 / 5 项')
    expect(failure.getAttribute('title')).toBe('跳转到待处理失败：练习需要再检查，第 4 / 5 项')

    fireEvent.click(failure)
    expect(jumpToMarker).toHaveBeenCalledWith(failureMarker)
    expect(active.getAttribute('data-attention')).toBe('active_exercise')
  })

  it('uses compiled English copy for attention-aware marker jumps', () => {
    const englishActiveMarker = {
      ...activeExerciseMarker,
      label: 'Practice',
    } satisfies ScrollRailMarker
    const englishFailureMarker = {
      ...failureMarker,
      label: 'Needs another check',
    } satisfies ScrollRailMarker
    const { jumpToMarker } = renderRail([englishActiveMarker, englishFailureMarker], EnWrapper)

    const active = screen.getByRole('button', { name: 'Jump to current exercise: Practice, item 2 / 5' })
    const failure = screen.getByRole('button', { name: 'Jump to pending failure: Needs another check, item 4 / 5' })
    expect(active.getAttribute('title')).toBe('Jump to current exercise: Practice, item 2 / 5')
    expect(failure.getAttribute('title')).toBe('Jump to pending failure: Needs another check, item 4 / 5')

    fireEvent.click(active)

    expect(jumpToMarker).toHaveBeenCalledWith(englishActiveMarker)
  })
})
