import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassroomConceptPanel } from './ClassroomConceptPanel'
import { closeClassroomTransientPanels } from './classroom-transient-panels'
import { ClassroomSessionProvider } from '@/features/tour-ai/context/classroom-session-context'
import { createEditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession, LearningEvidence } from '@/lib/ai/classroom/types'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import { messages as enMessages } from '@/locales/en/messages.mjs'

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

function withConceptStatus<T>(conceptId: string, status: 'validated' | 'read_only' | 'invalid', callback: () => T): T {
  const statuses = getDefaultCourseContentIndex().validation.conceptStatuses
  const previous = statuses[conceptId]
  statuses[conceptId] = status
  try {
    return callback()
  }
  finally {
    statuses[conceptId] = previous
  }
}

function createDemonstratedSession(): ClassroomSession {
  let session = createInitialClassroomSession({ lang: 'zh' })
  session = classroomReducer(session, {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '输出 Cangjie。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'test' },
    },
    now: 1001,
  })
  return classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
    now: 1002,
  })
}

function createAidedDemonstratedSession(): ClassroomSession {
  let session = createInitialClassroomSession({ lang: 'zh' })
  session = classroomReducer(session, {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '输出 Cangjie。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'test' },
    },
    now: 1001,
  })
  return classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
    attempt: { assistance: [{ kind: 'code_suggestion', appliedAt: 1001 }] },
    now: 1002,
  })
}

function createSeenSession(): ClassroomSession {
  return classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading', 'cj.io.println.output'],
    skillId: 'cj.io.println.print-value',
    now: 1001,
  })
}

function createActiveExerciseSession(intent: 'mainline' | 'review_check' = 'mainline'): ClassroomSession {
  return classroomReducer(createSeenSession(), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.program.main.write-entry.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.program.main.write-entry',
      conceptIds: ['cj.program.main'],
      prompt: '补全一个最小程序，让它输出 Hello。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: 'Hello',
      matchMode: 'exact',
      intent,
      personalizationInputs: { summary: 'test' },
    },
    now: 1002,
  })
}

function createMultipleSeenSession(): ClassroomSession {
  let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.io.println',
    blockIds: ['cj.io.println.heading'],
    skillId: 'cj.io.println.print-value',
    now: 1001,
  })
  session = classroomReducer(session, {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.program.main',
    blockIds: ['cj.program.main.heading'],
    skillId: 'cj.program.main.write-entry',
    now: 1002,
  })
  return session
}

function createBlockedSession(): ClassroomSession {
  let session = createInitialClassroomSession({ lang: 'zh' })
  session = classroomReducer(session, {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.io.println.print-value.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      prompt: '输出 Cangjie。',
      starterCode: 'main() {\n    // TODO\n}',
      expectedOutput: 'Cangjie',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'test' },
    },
    now: 1001,
  })
  session = classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
    attemptedCode: 'main() {\n    println("wrong")\n}',
    now: 1002,
  })
  return classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'still wrong\n', stderr: '', exitCode: 0 },
    attemptedCode: 'main() {\n    println("still wrong")\n}',
    now: 1003,
  })
}

function createStaleThenFailedSession(): ClassroomSession {
  const baseSession = createInitialClassroomSession({ lang: 'zh' })
  const evidence = (
    input: Pick<LearningEvidence, 'outcome' | 'strength' | 'createdAt'>,
  ): LearningEvidence => ({
    evidenceId: `evidence:${input.createdAt}`,
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    summary: 'test evidence',
    ...input,
  })
  return {
    ...baseSession,
    learner: {
      ...baseSession.learner,
      evidence: [
        evidence({ outcome: 'success', strength: 'mastery', createdAt: 1001 }),
        evidence({ outcome: 'self_report', strength: 'stale', createdAt: 1002 }),
        evidence({ outcome: 'failure', strength: 'independent', createdAt: 1003 }),
      ],
    },
  }
}

function renderPanel(
  session: ClassroomSession = createInitialClassroomSession({ lang: 'zh' }),
  options: {
    onReviewConcept?: (conceptId: string) => void
    onReturnToCurrentExercise?: () => void
    lang?: 'zh' | 'en'
    wrapper?: typeof Wrapper
  } = {},
) {
  const WrapperComponent = options.wrapper ?? Wrapper
  const lang = options.lang ?? 'zh'
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
        <ClassroomConceptPanel
          lang={lang}
          onReviewConcept={options.onReviewConcept}
          onReturnToCurrentExercise={options.onReturnToCurrentExercise}
        />
      </ClassroomSessionProvider>
    </WrapperComponent>,
  )
}

function describedText(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent?.trim() || '')
    .join(' ')
}

describe('classroomConceptPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps the progress popover inside narrow viewports', () => {
    renderPanel()

    const trigger = screen.getByTestId('classroom-concept-panel-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('学习进度，尚未记录概念进度')
    expect(trigger.getAttribute('title')).toBe('打开学习进度面板；开始课堂后会显示已看内容、练习提交和复习检查证据。')
    expect(describedText(trigger)).toBe('打开学习进度面板；开始课堂后会显示已看内容、练习提交和复习检查证据。')
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(trigger)

    const content = screen.getByTestId('classroom-concept-panel-content')
    expect(content.className).toContain('w-80')
    expect(content.className).toContain('max-w-[calc(100vw-1rem)]')
    screen.getByText('课堂会随着课程进展显示已看内容、练习提交和复习检查结果。')
    screen.getByText('开始第一节课后，这里会展示已看内容、练习提交和复习检查证据。')
    expect(screen.queryByText('AI 会随着课程进展自动记录你掌握的概念。')).toBeNull()
    expect(screen.queryByText('开始第一节课，AI 会在这里记录你的进度。')).toBeNull()
    expect(screen.getByTestId('concept-panel-evidence-policy').textContent).toBe('进度来自已看内容、练习提交和复习检查；AI 只能记录观察，不能直接判定掌握。')
  })

  it('uses compiled English copy for the empty progress popover', () => {
    renderPanel(createInitialClassroomSession({ lang: 'en' }), { wrapper: EnWrapper, lang: 'en' })

    const trigger = screen.getByTestId('classroom-concept-panel-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('Learning progress, no concept progress recorded yet')
    expect(trigger.getAttribute('title')).toBe('Open the learning progress panel. After you start the classroom, it will show viewed content, exercise submissions, and review-check evidence.')
    expect(describedText(trigger)).toBe('Open the learning progress panel. After you start the classroom, it will show viewed content, exercise submissions, and review-check evidence.')

    fireEvent.click(trigger)

    screen.getByText('Learning progress')
    screen.getByText('As the classroom progresses, viewed content, exercise submissions, and review-check results will appear here.')
    expect(screen.getByTestId('concept-panel-evidence-policy').textContent).toBe('Progress comes from viewed content, exercise submissions, and review checks. AI can record observations, but it cannot directly determine mastery.')
    screen.getByText('After the first lesson starts, viewed content, exercise submissions, and review-check evidence will appear here.')
    expect(screen.queryByText('课堂会随着课程进展显示已看内容、练习提交和复习检查结果。')).toBeNull()
  })

  it('closes when another classroom transient panel opens', async () => {
    renderPanel(createActiveExerciseSession())

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))
    expect(screen.getByTestId('classroom-concept-panel-content')).not.toBeNull()

    act(() => {
      closeClassroomTransientPanels()
    })

    await waitFor(() => {
      expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
    })
  })

  it('closes before learners interact with exercise transient targets', async () => {
    renderPanel(createActiveExerciseSession())

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))
    expect(screen.getByTestId('classroom-concept-panel-content')).not.toBeNull()

    const exerciseTarget = document.createElement('button')
    exerciseTarget.setAttribute('data-classroom-transient-panel-close-target', '')
    document.body.append(exerciseTarget)

    try {
      fireEvent.pointerDown(exerciseTarget)

      await waitFor(() => {
        expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
      })
    }
    finally {
      exerciseTarget.remove()
    }
  })

  it('does not label demonstrated-only progress as mastered', () => {
    renderPanel(createDemonstratedSession())

    const trigger = screen.getByTestId('classroom-concept-panel-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('学习进度，已证明或掌握 1 / 1 个接触过的概念')
    expect(trigger.getAttribute('title')).toBe('打开学习进度面板；已证明或掌握 1 / 1 个接触过的概念。')
    expect(describedText(trigger)).toBe('打开学习进度面板；已证明或掌握 1 / 1 个接触过的概念。')

    fireEvent.click(trigger)

    screen.getByText(/已证明或掌握\s+1\s+个概念/)
    expect(screen.getByTestId('concept-panel-evidence-policy').textContent).toBe('进度来自已看内容、练习提交和复习检查；AI 只能记录观察，不能直接判定掌握。')
    expect(screen.queryByText(/已掌握\s+1\s+个概念/)).toBeNull()
    const demonstrated = screen.getByTestId('concept-group-demonstrated')
    expect(demonstrated.textContent).toContain('通过练习证明理解的概念')
    expect(demonstrated.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByTestId('concept-progress-reason-cj.io.println').textContent).toContain('最近一次练习已通过，进度来自练习提交。')
    expect(screen.queryByTestId('concept-group-mastered')).toBeNull()
  })

  it('explains seen progress as exposure rather than proof', () => {
    renderPanel(createSeenSession())

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    const seen = screen.getByTestId('concept-group-seen')
    expect(seen.textContent).toContain('已在课堂中看过核心内容，还没有通过练习证据。')
    expect(seen.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByTestId('concept-group-demonstrated')).toBeNull()
  })

  it('does not count read-only seen concepts as pending practice', () => {
    withConceptStatus('cj.io.println', 'read_only', () => {
      renderPanel(createSeenSession())

      const trigger = screen.getByTestId('classroom-concept-panel-trigger')
      expect(trigger.textContent).not.toContain('待处理')
      expect(trigger.getAttribute('aria-label')).toBe('学习进度，已证明或掌握 0 / 1 个接触过的概念')
      expect(trigger.getAttribute('title')).toBe('打开学习进度面板；已证明或掌握 0 / 1 个接触过的概念。')
      expect(describedText(trigger)).toBe('打开学习进度面板；已证明或掌握 0 / 1 个接触过的概念。')

      fireEvent.click(trigger)

      expect(screen.queryByTestId('concept-panel-next-step')).toBeNull()
      const seen = screen.getByTestId('concept-group-seen')
      expect(seen.textContent).toContain('此概念目前只读：内容可复习，但还没有验证练习闭环。')
    })
  })

  it('does not count invalid seen concepts as actionable progress', () => {
    withConceptStatus('cj.io.println', 'invalid', () => {
      renderPanel(createSeenSession())

      const trigger = screen.getByTestId('classroom-concept-panel-trigger')
      expect(trigger.textContent).not.toContain('待处理')
      expect(trigger.getAttribute('aria-label')).toBe('学习进度，已证明或掌握 0 / 1 个接触过的概念')

      fireEvent.click(trigger)

      expect(screen.queryByTestId('concept-panel-next-step')).toBeNull()
      const seen = screen.getByTestId('concept-group-seen')
      expect(seen.textContent).toContain('此概念尚未通过 AI Classroom 内容验证，不能作为主线进度目标。')
    })
  })

  it('distinguishes aided success from independent proof in progress details', () => {
    renderPanel(createAidedDemonstratedSession())

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    expect(screen.getByTestId('concept-progress-reason-cj.io.println').textContent).toContain('最近一次练习在帮助后通过，后续仍建议做独立检查。')
  })

  it('keeps stale progress framed as a review-check need after a later failed attempt', () => {
    renderPanel(createStaleThenFailedSession())

    const trigger = screen.getByTestId('classroom-concept-panel-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('学习进度，1 个待处理概念')

    fireEvent.click(trigger)

    const stale = screen.getByTestId('concept-group-stale')
    expect(stale.textContent).toContain('标准输出 println')
    expect(stale.textContent).toContain('已有证据需要复查，先做一次复习检查再继续。')
    expect(stale.textContent).not.toContain('最近一次提交未通过，需要继续练习这个概念。')
    expect(screen.getByTestId('concept-panel-next-step').textContent).toContain('做一次复习检查')
  })

  it('prioritizes actionable progress and routes a concept into review', async () => {
    const onReviewConcept = vi.fn()
    const onReturnToCurrentExercise = vi.fn()
    renderPanel(createBlockedSession(), { onReviewConcept, onReturnToCurrentExercise })

    const trigger = screen.getByTestId('classroom-concept-panel-trigger')
    expect(trigger.textContent).toContain('待处理')
    expect(trigger.textContent).toContain('1')
    expect(trigger.getAttribute('aria-label')).toBe('学习进度，1 个待处理概念')
    expect(trigger.getAttribute('title')).toBe('打开学习进度面板；有 1 个概念需要复习、练习或复查。')
    expect(describedText(trigger)).toBe('打开学习进度面板；有 1 个概念需要复习、练习或复查。')
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(trigger)

    const nextStep = screen.getByTestId('concept-panel-next-step')
    expect(nextStep.textContent).toContain('标准输出 println')
    expect(nextStep.textContent).toContain('先查看提示，再重新练习')
    expect(nextStep.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    screen.getByText('这项练习已连续 2 次未通过，建议先看相关提示再试一次。')

    const nextReview = screen.getByRole('button', { name: '打开下一步复习 标准输出 println' })
    expect(nextReview.getAttribute('title')).toBe('打开 标准输出 println 的复习页查看内容、证据和建议；不会排队新的课堂内容或改变学习进度。')
    fireEvent.click(nextReview)

    expect(onReviewConcept).toHaveBeenCalledWith('cj.io.println')
    expect(onReturnToCurrentExercise).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
    })
  })

  it('uses the active learning track order when equally actionable concepts compete', () => {
    renderPanel(createMultipleSeenSession(), { onReviewConcept: vi.fn() })

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    const nextStep = screen.getByTestId('concept-panel-next-step')
    expect(nextStep.textContent).toContain('程序入口与 main')
    expect(nextStep.textContent).toContain('做一次练习验证')
    const nextReview = screen.getByRole('button', { name: '打开下一步复习 程序入口与 main' })
    expect(nextReview.getAttribute('title')).toBe('打开 程序入口与 main 的复习页查看内容、证据和建议；不会排队新的课堂内容或改变学习进度。')
    expect(nextStep.textContent).not.toContain('标准输出 println')
  })

  it('prioritizes returning to the active exercise over routing next step to review', async () => {
    const onReviewConcept = vi.fn()
    const onReturnToCurrentExercise = vi.fn()
    renderPanel(createActiveExerciseSession(), { onReviewConcept, onReturnToCurrentExercise })

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    const nextStep = screen.getByTestId('concept-panel-next-step')
    expect(nextStep.textContent).toContain('程序入口与 main')
    expect(nextStep.textContent).toContain('继续当前练习')
    expect(nextStep.textContent).not.toContain('做一次练习验证')
    expect(screen.queryByRole('button', { name: '打开下一步复习 程序入口与 main' })).toBeNull()

    const returnToExercise = screen.getByRole('button', { name: '回到当前练习 程序入口与 main' })
    expect(returnToExercise.getAttribute('title')).toBe('回到当前练习 程序入口与 main；不会打开复习页、提交代码或改变已记录进度。')
    fireEvent.click(returnToExercise)

    expect(onReturnToCurrentExercise).toHaveBeenCalledTimes(1)
    expect(onReviewConcept).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
    })
  })

  it('uses compiled English copy when returning to the active exercise', async () => {
    const onReviewConcept = vi.fn()
    const onReturnToCurrentExercise = vi.fn()
    renderPanel(createActiveExerciseSession(), {
      onReviewConcept,
      onReturnToCurrentExercise,
      wrapper: EnWrapper,
      lang: 'en',
    })

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    const nextStep = screen.getByTestId('concept-panel-next-step')
    expect(nextStep.textContent).toContain('Next step')
    expect(nextStep.textContent).toContain('Program entry and main')
    expect(nextStep.textContent).toContain('Continue current exercise')
    const returnToExercise = screen.getByRole('button', { name: 'Return to current exercise Program entry and main' })
    expect(returnToExercise.getAttribute('title')).toBe('Return to the current exercise Program entry and main. This will not open Review, submit code, or change recorded progress.')
    expect(screen.queryByRole('button', { name: 'Open next review Program entry and main' })).toBeNull()

    fireEvent.click(returnToExercise)

    expect(onReturnToCurrentExercise).toHaveBeenCalledTimes(1)
    expect(onReviewConcept).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
    })
  })

  it('uses review-check copy when the active next step is a review check', () => {
    const onReturnToCurrentExercise = vi.fn()
    renderPanel(createActiveExerciseSession('review_check'), { onReviewConcept: vi.fn(), onReturnToCurrentExercise })

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    const nextStep = screen.getByTestId('concept-panel-next-step')
    expect(nextStep.textContent).toContain('继续当前复习检查')
    const returnToReviewCheck = screen.getByRole('button', { name: '回到当前复习检查 程序入口与 main' })
    expect(returnToReviewCheck.getAttribute('title')).toBe('回到当前复习检查 程序入口与 main；不会打开复习页、提交代码或改变已记录进度。')
    fireEvent.click(returnToReviewCheck)
    expect(onReturnToCurrentExercise).toHaveBeenCalledTimes(1)
  })

  it('uses compiled English copy for routing blocked concepts to Review', async () => {
    const onReviewConcept = vi.fn()
    renderPanel(createBlockedSession(), { onReviewConcept, wrapper: EnWrapper, lang: 'en' })

    const trigger = screen.getByTestId('classroom-concept-panel-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('Learning progress, 1 pending concepts')
    expect(trigger.getAttribute('title')).toBe('Open the learning progress panel. 1 concepts need review, practice, or re-checking.')

    fireEvent.click(trigger)

    const nextStep = screen.getByTestId('concept-panel-next-step')
    expect(nextStep.textContent).toContain('Standard output println')
    expect(nextStep.textContent).toContain('Review the hint, then practice again')
    const nextReview = screen.getByRole('button', { name: 'Open next review Standard output println' })
    expect(nextReview.getAttribute('title')).toBe('Open Review for Standard output println to view content, evidence, and recommendations. This will not queue new classroom content or change learning progress.')

    fireEvent.click(nextReview)

    expect(onReviewConcept).toHaveBeenCalledWith('cj.io.println')
    await waitFor(() => {
      expect(screen.queryByTestId('classroom-concept-panel-content')).toBeNull()
    })
  })

  it('hides group review button icons from assistive labels', () => {
    const onReviewConcept = vi.fn()
    renderPanel(createSeenSession(), { onReviewConcept })

    fireEvent.click(screen.getByTestId('classroom-concept-panel-trigger'))

    const review = screen.getByRole('button', { name: '在复习页查看 标准输出 println' })
    expect(review.getAttribute('title')).toBe('在复习页查看 标准输出 println 的内容、证据和建议；不会改变学习进度。')
    expect(review.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(review)

    expect(onReviewConcept).toHaveBeenCalledWith('cj.io.println')
  })
})
