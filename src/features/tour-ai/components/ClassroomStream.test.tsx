/* eslint-disable react/component-hook-factories */
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { useClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { projectClassroomLiveViewSurface } from '@/lib/ai/classroom/view-projections'
import { createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ClassroomEvent, ClassroomSession, ClassroomStreamItem } from '@/lib/ai/classroom/types'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { ClassroomStream } from './ClassroomStream'

vi.mock('@/features/tour-ai/context/classroom-live-scroll-surface', () => ({
  useClassroomLiveScrollSurface: vi.fn(),
}))

vi.mock('@/features/tour-ai/components/ExercisePracticeCard', () => ({
  ExercisePracticeCard: () => <div data-testid="exercise-card" />,
}))

const mockUseClassroomLiveScrollSurface = vi.mocked(useClassroomLiveScrollSurface)

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

function sessionWithStream(stream: ClassroomStreamItem[], eventQueue: ClassroomEvent[] = [], lang: 'zh' | 'en' = 'zh'): ClassroomSession {
  return {
    ...createInitialClassroomSession({ lang }),
    stream,
    eventQueue,
  }
}

function mockLiveSurface(session: ClassroomSession) {
  const surface = projectClassroomLiveViewSurface(session)
  mockUseClassroomLiveScrollSurface.mockReturnValue({
    viewportRef: { current: null },
    surface,
    markers: [],
    chapterEntries: surface.chapterEntries,
    visibleCount: surface.visibleCount,
    watermarkIndex: -1,
    lens: null,
    follower: {
      pinned: true,
      newContentBelow: false,
      visible: false,
      scrollToBottom: vi.fn(),
    },
    jumpToMarker: vi.fn(),
    scrollToBlockKey: vi.fn(),
    scrollToExerciseId: vi.fn(),
  } satisfies ClassroomLiveScrollSurface)
}

function renderStream(
  session: ClassroomSession,
  options: {
    footer?: ReactNode
    focusGenerationRequestKey?: number
    focusContinueRequestKey?: number
    generationFocusBlockedReason?: 'api_key' | 'shared_quota'
    suppressGenerationErrorMarkers?: boolean
    lang?: 'zh' | 'en'
    wrapper?: typeof Wrapper
    onReviewConcept?: (conceptId: string) => void
  } = {},
) {
  mockLiveSurface(session)
  const WrapperComponent = options.wrapper ?? Wrapper
  const lang = options.lang ?? 'zh'
  render(
    <WrapperComponent>
      <ClassroomStream
        session={session}
        lang={lang}
        dispatch={vi.fn()}
        bridge={{} as AIClassroomBridgeValue}
        footer={options.footer}
        focusGenerationRequestKey={options.focusGenerationRequestKey}
        focusContinueRequestKey={options.focusContinueRequestKey}
        generationFocusBlockedReason={options.generationFocusBlockedReason}
        suppressGenerationErrorMarkers={options.suppressGenerationErrorMarkers}
        onReviewConcept={options.onReviewConcept}
      />
    </WrapperComponent>,
  )
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

describe('classroom stream status markers', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('announces learning evidence as a named status and hides the decorative icon', () => {
    renderStream(sessionWithStream([{
      id: 'evidence-marker:1:0',
      type: 'learning_evidence_marker',
      evidenceId: 'evidence:1:0',
      conceptId: 'cj.io.println',
      skillId: 'cj.io.println.print-value',
      exerciseIntent: 'mainline',
      outcome: 'success',
      strength: 'independent',
      summary: 'Exercise completed successfully.',
      createdAt: 1,
    }]))

    const marker = screen.getByRole('status', { name: '学习记录：练习完成已记录' })
    expect(marker.textContent).toBe('练习完成已记录')
    expect(marker.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('describes a passed review check as mastery evidence rather than direct mastery assignment', () => {
    renderStream(sessionWithStream([{
      id: 'evidence-marker:2:0',
      type: 'learning_evidence_marker',
      evidenceId: 'evidence:2:0',
      conceptId: 'cj.io.println',
      skillId: 'cj.io.println.print-value',
      exerciseIntent: 'review_check',
      outcome: 'success',
      strength: 'mastery',
      summary: 'Review check passed independently.',
      createdAt: 2,
    }]))

    const marker = screen.getByRole('status', { name: '学习记录：复习检查通过，已记录掌握证据' })
    expect(marker.textContent).toBe('复习检查通过，已记录掌握证据')
    expect(screen.queryByText('复习检查通过，已记录掌握')).toBeNull()
  })

  it('announces retained, skipped, and failure stream markers with stable labels', () => {
    renderStream(sessionWithStream([
      {
        id: 'skip:1:0',
        type: 'skip_marker',
        conceptId: 'cj.io.println',
        blockIds: ['cj.io.println.output'],
        reason: '已有独立练习证据',
        createdAt: 1,
      },
      {
        id: 'retention:2:1',
        type: 'retention_marker',
        artifactId: 'artifact:1',
        conceptId: 'cj.io.println',
        kind: 'remediation',
        summary: 'println 的输出换行容易漏看',
        createdAt: 2,
      },
      {
        id: 'generation-error:3:2',
        type: 'system_event',
        event: { type: 'lesson_generation_error', summary: 'network failed', createdAt: 3 },
        createdAt: 3,
      },
      {
        id: 'exercise-failure:4:3',
        type: 'system_event',
        event: {
          type: 'exercise_failure',
          exerciseInstanceId: 'exercise:1',
          exerciseIntent: 'review_check',
          templateId: 'cj.io.println.print-value.cangjie',
          skillId: 'cj.io.println.print-value',
          conceptIds: ['cj.io.println'],
          prompt: '再用 println 输出一次。',
          attemptedCode: 'main() {}',
          expectedOutput: 'Cangjie',
          actualOutput: '',
          summary: 'Review check failed.',
          createdAt: 4,
        },
        createdAt: 4,
      },
    ]))

    screen.getByRole('status', { name: '跳过内容：已有独立练习证据' })
    screen.getByRole('status', { name: '已保存到复习：println 的输出换行容易漏看' })
    screen.getByRole('status', { name: '准备下一步失败。请重试。' })
    screen.getByRole('status', { name: '复习检查未通过，AI 会给出复习建议。' })
  })

  it('renders queued chat intents as explicit AI request markers instead of generic state updates', () => {
    const event: ClassroomEvent = {
      type: 'chat_intent',
      intent: 'advance',
      summary: 'Learner wants to continue.',
      createdAt: 5,
    }
    renderStream(sessionWithStream([
      {
        id: 'event:5:0',
        type: 'system_event',
        event,
        createdAt: 5,
      },
    ], [event]))

    const marker = screen.getByRole('status', { name: 'AI 请求已排队：继续下一步' })
    expect(marker).toBe(screen.getByTestId('classroom-stream-chat-intent-marker'))
    expect(marker.getAttribute('aria-busy')).toBe('true')
    expect(marker.textContent).toContain('已收到：继续下一步')
    expect(marker.textContent).toContain('AI 正在准备下一步')
    expect(marker.textContent).toContain('不会直接改变学习进度')
    expect(marker.textContent).toContain('练习提交、复习检查等学习证据')
    expect(marker.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(marker.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    expect(screen.queryByText('课堂状态已更新。')).toBeNull()
  })

  it('discloses the concept scope for queued AI requests', () => {
    const event: ClassroomEvent = {
      type: 'chat_intent',
      intent: 'go_deeper',
      summary: 'Learner wants more depth for println.',
      activeConceptId: 'cj.io.println',
      createdAt: 7,
    }
    renderStream(sessionWithStream([
      {
        id: 'event:7:0',
        type: 'system_event',
        event,
        createdAt: 7,
      },
    ], [event]))

    const marker = screen.getByRole('status', { name: 'AI 请求已排队：再深入讲讲，范围 标准输出 println' })
    expect(marker.textContent).toContain('已收到：再深入讲讲')
    expect(marker.textContent).toContain('范围：标准输出 println')
    expect(marker.textContent).toContain('不会直接改变学习进度')
  })

  it('uses compiled English copy for queued AI request markers', () => {
    const event: ClassroomEvent = {
      type: 'chat_intent',
      intent: 'go_deeper',
      summary: 'Learner wants more depth for println.',
      activeConceptId: 'cj.io.println',
      createdAt: 7,
    }
    renderStream(sessionWithStream([
      {
        id: 'event:7:0',
        type: 'system_event',
        event,
        createdAt: 7,
      },
    ], [event], 'en'), { wrapper: EnWrapper, lang: 'en' })

    const marker = screen.getByRole('status', { name: 'AI request queued: Go deeper, scope Standard output println' })
    expect(marker.textContent).toContain('Received: Go deeper')
    expect(marker.textContent).toContain('Scope: Standard output println')
    expect(marker.textContent).toContain('AI is preparing the next step')
    expect(marker.textContent).toContain('learning evidence such as exercise submissions and review checks')
    expect(marker.textContent).not.toContain('已收到')
    expect(marker.textContent).not.toContain('不会直接改变学习进度')
  })

  it('keeps consumed chat intent markers readable without a stale busy state', () => {
    const event: ClassroomEvent = {
      type: 'chat_intent',
      intent: 'go_deeper',
      summary: 'Learner wants more depth.',
      createdAt: 6,
    }
    renderStream(sessionWithStream([
      {
        id: 'event:6:0',
        type: 'system_event',
        event,
        createdAt: 6,
      },
    ]))

    const marker = screen.getByRole('status', { name: 'AI 请求已记录：再深入讲讲' })
    expect(marker.getAttribute('aria-busy')).toBeNull()
    expect(marker.textContent).toContain('已收到：再深入讲讲')
    expect(marker.textContent).toContain('如果已经生成新内容，它会出现在这条记录之后')
    expect(marker.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
  })

  it('can suppress stale lesson generation errors while a retry is running', () => {
    renderStream(sessionWithStream([
      {
        id: 'generation-error:3:0',
        type: 'system_event',
        event: { type: 'lesson_generation_error', summary: 'network failed', createdAt: 3 },
        createdAt: 3,
      },
      {
        id: 'exercise-failure:4:1',
        type: 'system_event',
        event: {
          type: 'exercise_failure',
          exerciseInstanceId: 'exercise:1',
          exerciseIntent: 'review_check',
          templateId: 'cj.io.println.print-value.cangjie',
          skillId: 'cj.io.println.print-value',
          conceptIds: ['cj.io.println'],
          prompt: '再用 println 输出一次。',
          attemptedCode: 'main() {}',
          expectedOutput: 'Cangjie',
          actualOutput: '',
          summary: 'Review check failed.',
          createdAt: 4,
        },
        createdAt: 4,
      },
    ]), { suppressGenerationErrorMarkers: true })

    expect(screen.queryByTestId('classroom-stream-generation-error')).toBeNull()
    screen.getByRole('status', { name: '复习检查未通过，AI 会给出复习建议。' })
  })

  it('discloses when a live classroom content reference now renders a newer content version', () => {
    renderStream(sessionWithStream([{
      id: 'content-group:1:0',
      type: 'content_reference_group',
      groupId: 'group:1:0',
      conceptId: 'cj.program.main',
      references: [{
        packId: 'default-entry',
        contentVersion: '2026-01-01',
        blockId: 'cj.program.main.heading',
        conceptId: 'cj.program.main',
      }],
      createdAt: 1,
    }]))

    const badge = screen.getByText('内容已更新')
    const notice = screen.getByTestId('live-block-version-notice')
    expect(badge.getAttribute('aria-describedby')).toBe(notice.id)
    expect(notice.textContent).toContain('课堂记录版本')
    expect(notice.textContent).toContain('2026-01-01')
    expect(notice.textContent).toContain('当前显示版本')
    expect(notice.textContent).toContain('2026-05-28')
    screen.getByRole('heading', { name: '程序入口与 main' })
  })

  it('marks visible stream items as stable programmatic focus targets', () => {
    renderStream(sessionWithStream([{
      id: 'content-group:1:0',
      type: 'content_reference_group',
      groupId: 'group:1:0',
      conceptId: 'cj.program.main',
      references: [{
        packId: 'default-entry',
        contentVersion: '2026-05-28',
        blockId: 'cj.program.main.heading',
        conceptId: 'cj.program.main',
      }],
      createdAt: 1,
    }]))

    const item = screen.getByTestId('classroom-stream-item')
    expect(item.getAttribute('tabindex')).toBe('-1')
    expect(item.getAttribute('data-live-stream-item-id')).toBe('content-group:1:0')
    expect(item.getAttribute('data-live-stream-visible-index')).toBe('0')
  })

  it('renders live content through a stable list without depending on virtualization', () => {
    renderStream(sessionWithStream([{
      id: 'content-group:1:0',
      type: 'content_reference_group',
      groupId: 'group:1:0',
      conceptId: 'cj.program.main',
      references: [{
        packId: 'default-entry',
        contentVersion: '2026-05-28',
        blockId: 'cj.program.main.heading',
        conceptId: 'cj.program.main',
      }],
      createdAt: 1,
    }]))

    expect(screen.getByTestId('classroom-stream-list')).toBeTruthy()
    expect(screen.queryByTestId('virtuoso-mock')).toBeNull()
    screen.getByRole('heading', { name: '程序入口与 main' })
  })

  it('announces the focused generation footer with the default recovery copy', () => {
    renderStream(sessionWithStream([]), {
      footer: <div>课堂准备进度</div>,
      focusGenerationRequestKey: 1,
    })

    expect(screen.getByTestId('classroom-generation-focus-notice').textContent)
      .toBe('已回到课堂准备状态。可以继续等待、重试或检查 AI 设置。')
  })

  it('uses API key setup copy when the focused generation footer is blocked by config', () => {
    renderStream(sessionWithStream([]), {
      footer: <div>课堂准备进度</div>,
      focusGenerationRequestKey: 1,
      generationFocusBlockedReason: 'api_key',
    })

    expect(screen.getByTestId('classroom-generation-focus-notice').textContent)
      .toBe('已回到课堂准备状态。需要先完成 AI 服务配置，才会继续准备课堂。')
  })

  it('uses shared quota recovery copy when the focused generation footer is waiting for quota', () => {
    renderStream(sessionWithStream([]), {
      footer: <div>课堂准备进度</div>,
      focusGenerationRequestKey: 1,
      generationFocusBlockedReason: 'shared_quota',
    })

    const notice = screen.getByTestId('classroom-generation-focus-notice')
    expect(notice.textContent).toBe('已回到课堂准备状态。可以继续等待共享额度刷新，或使用自己的 API Key 后继续。')
    expect(notice.textContent).not.toContain('检查 AI 设置')
  })

  it('uses compiled English copy for footer focus recovery states', () => {
    const { rerender } = (() => {
      mockLiveSurface(sessionWithStream([], [], 'en'))
      return render(
        <EnWrapper>
          <ClassroomStream
            session={sessionWithStream([], [], 'en')}
            lang="en"
            dispatch={vi.fn()}
            bridge={{} as AIClassroomBridgeValue}
            footer={<div>Classroom preparation progress</div>}
            focusGenerationRequestKey={1}
            generationFocusBlockedReason="shared_quota"
          />
        </EnWrapper>,
      )
    })()

    expect(screen.getByTestId('classroom-generation-focus-notice').textContent)
      .toBe('Back at classroom preparation. You can keep waiting for shared quota refresh, or continue after using your own API Key.')

    mockLiveSurface(sessionWithStream([], [], 'en'))
    rerender(
      <EnWrapper>
        <ClassroomStream
          session={sessionWithStream([], [], 'en')}
          lang="en"
          dispatch={vi.fn()}
          bridge={{} as AIClassroomBridgeValue}
          footer={<div>Continue</div>}
          focusContinueRequestKey={1}
        />
      </EnWrapper>,
    )

    expect(screen.getByTestId('classroom-continue-focus-notice').textContent)
      .toBe('Back in the classroom. Use the actions below to continue, slow down, or ask a question.')
  })

  it('announces the focused continue footer after returning from review', () => {
    renderStream(sessionWithStream([{
      id: 'content-group:1:0',
      type: 'content_reference_group',
      groupId: 'group:1:0',
      conceptId: 'cj.program.main',
      references: [{
        packId: 'default-entry',
        contentVersion: '2026-05-28',
        blockId: 'cj.program.main.heading',
        conceptId: 'cj.program.main',
      }],
      createdAt: 1,
    }]), {
      footer: <div>继续下一步</div>,
      focusContinueRequestKey: 1,
    })

    expect(screen.getByTestId('classroom-continue-focus-notice').textContent)
      .toBe('已回到课堂。可以用下方操作继续下一步、放慢节奏或提问。')
    expect(screen.queryByTestId('classroom-generation-focus-notice')).toBeNull()
  })

  it('warns instead of silently dropping a live content reference that cannot be resolved', () => {
    const missingBlockId = `missing.block.${'x'.repeat(72)}`
    const onReviewConcept = vi.fn()

    renderStream(sessionWithStream([{
      id: 'content-group:1:0',
      type: 'content_reference_group',
      groupId: 'group:1:0',
      conceptId: 'cj.program.main',
      references: [{
        packId: 'default-entry',
        contentVersion: '2026-01-01',
        blockId: missingBlockId,
        conceptId: 'cj.program.main',
      }],
      createdAt: 1,
    }]), { onReviewConcept })

    const status = screen.getByRole('status', { name: `缺失课堂内容：${missingBlockId}` })
    expect(status).toBe(screen.getByTestId('live-block-missing-content'))
    expect(status.className).toContain('min-w-0')
    expect(status.className).toContain('break-words')
    expect(status.textContent).toContain('部分课堂内容暂时无法显示')
    expect(status.textContent).toContain('这条历史课堂记录引用的内容块在当前内容包中找不到')
    expect(status.textContent).toContain('课堂记录仍会保留')
    expect(status.textContent).toContain(missingBlockId)
    expect(status.getAttribute('aria-describedby')).toBeTruthy()
    const detailId = status.getAttribute('aria-describedby')!.split(/\s+/)[0]
    const detail = document.getElementById(detailId)
    expect(detail?.className).toContain('break-words')

    const reviewAction = screen.getByRole('button', { name: '去复习' })
    expect(reviewAction.className).toContain('w-full')
    expect(reviewAction.className).toContain('max-w-full')
    expect(reviewAction.className).toContain('sm:w-auto')
    expect(reviewAction.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(reviewAction.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(reviewAction.querySelector('span')?.className).toContain('break-words')
    expect(describedByText(reviewAction)).toContain('这条历史课堂记录引用的内容块在当前内容包中找不到')
    expect(describedByText(reviewAction)).toContain('不会改变学习进度或排队新的 AI 请求。')
    expect(reviewAction.getAttribute('title')).toBe('切换到复习视图，查看概念掌握和保留练习；不会改变学习进度或排队新的 AI 请求。')

    fireEvent.click(reviewAction)

    expect(onReviewConcept).toHaveBeenCalledTimes(1)
    expect(onReviewConcept).toHaveBeenCalledWith('cj.program.main')
  })

  it('uses compiled English copy for missing historical content recovery', () => {
    const missingBlockId = `missing.block.${'x'.repeat(72)}`
    const onReviewConcept = vi.fn()

    renderStream(sessionWithStream([{
      id: 'content-group:1:0',
      type: 'content_reference_group',
      groupId: 'group:1:0',
      conceptId: 'cj.program.main',
      references: [{
        packId: 'default-entry',
        contentVersion: '2026-01-01',
        blockId: missingBlockId,
        conceptId: 'cj.program.main',
      }],
      createdAt: 1,
    }], [], 'en'), { wrapper: EnWrapper, lang: 'en', onReviewConcept })

    const status = screen.getByRole('status', { name: `Missing classroom content: ${missingBlockId}` })
    expect(status.textContent).toContain('Some classroom content cannot be shown right now')
    expect(status.textContent).toContain('This historical classroom record references a content block that cannot be found in the current content pack.')
    expect(status.textContent).toContain('The classroom record will be kept.')
    expect(status.textContent).toContain(missingBlockId)
    expect(status.textContent).not.toContain('部分课堂内容')

    const reviewAction = screen.getByRole('button', { name: 'Review' })
    expect(describedByText(reviewAction)).toContain('This historical classroom record references a content block that cannot be found in the current content pack.')
    expect(describedByText(reviewAction)).toContain('This will not change learning progress or queue a new AI request.')
    expect(reviewAction.getAttribute('title')).toBe('Switch to Review to inspect concept mastery and retained practice. This will not change learning progress or queue a new AI request.')

    fireEvent.click(reviewAction)

    expect(onReviewConcept).toHaveBeenCalledTimes(1)
    expect(onReviewConcept).toHaveBeenCalledWith('cj.program.main')
  })
})
