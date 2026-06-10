import type { ReactNode } from 'react'
import { useState } from 'react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassroomReviewView } from './ClassroomReviewView'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession, ExerciseIntent } from '@/lib/ai/classroom/types'
import { createCodeSuggestionAssistance } from '@/lib/ai/classroom/exercise-attempt-evidence'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'

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

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

function expectPoliteStatus(element: HTMLElement) {
  expect(element.getAttribute('role')).toBe('status')
  expect(element.getAttribute('aria-live')).toBe('polite')
  expect(element.getAttribute('aria-atomic')).toBe('true')
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

function createReviewSession(): ClassroomSession {
  let session = createInitialClassroomSession({ lang: 'zh' })
  session = classroomReducer(session, {
    type: 'APPEND_CONTENT_REFERENCE_GROUP',
    conceptId: 'cj.program.main',
    blockIds: ['cj.program.main.heading'],
    now: 1001,
  })
  return classroomReducer(session, {
    type: 'SAVE_REVIEW_ARTIFACT',
    artifact: {
      artifactId: 'main-note',
      kind: 'clarification',
      conceptId: 'cj.program.main',
      title: 'main 入口提醒',
      body: 'main 是程序入口。',
      summary: '记住 main 入口',
      evidenceIds: [],
    },
    emitMarker: false,
    now: 1002,
  })
}

function createGroupedClarificationReviewSession(): ClassroomSession {
  return classroomReducer(createReviewSession(), {
    type: 'SAVE_REVIEW_ARTIFACT',
    artifact: {
      artifactId: 'main-note-2',
      kind: 'clarification',
      conceptId: 'cj.program.main',
      title: 'main 入口提醒',
      body: 'main 只能有一个入口。',
      summary: '记住 main 入口',
      evidenceIds: [],
    },
    emitMarker: false,
    now: 1003,
  })
}

function createEvidenceLinkedReviewSession(): ClassroomSession {
  return classroomReducer(createReviewSession(), {
    type: 'SAVE_REVIEW_ARTIFACT',
    artifact: {
      artifactId: 'main-remediation',
      kind: 'remediation',
      conceptId: 'cj.program.main',
      skillId: 'cj.program.main.write-entry',
      title: 'main 练习提示',
      body: '保留 main 练习里的错误模式。',
      summary: 'main 练习错误模式',
      evidenceIds: ['evidence:main:1'],
    },
    emitMarker: false,
    now: 1003,
  })
}

function createBlockedReviewSession(): ClassroomSession {
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

function createBlockedReviewSessionWithoutActiveExercise(): ClassroomSession {
  let session = createBlockedReviewSession()
  session = classroomReducer(session, { type: 'EXERCISE_SKIP', now: 1004 })
  session = classroomReducer(session, { type: 'CONSUME_EVENT', now: 1005 })
  return classroomReducer(session, { type: 'CONSUME_EVENT', now: 1006 })
}

function createActiveExerciseReviewSession(intent: ExerciseIntent = 'mainline'): ClassroomSession {
  return classroomReducer(createReviewSession(), {
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
      intent,
      personalizationInputs: { summary: 'test' },
    },
    now: 1003,
  })
}

function createReadyForNextReviewSession(): ClassroomSession {
  let session = classroomReducer(createReviewSession(), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.program.main.entry-shape.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.program.main.define-entry',
      conceptIds: ['cj.program.main'],
      prompt: '写出 main 入口。',
      starterCode: 'main() {\n    println("ready")\n}',
      expectedOutput: 'ready',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'test' },
    },
    now: 1003,
  })
  session = classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'ready\n', stderr: '', exitCode: 0 },
    now: 1004,
  })
  return classroomReducer(session, { type: 'CONSUME_EVENT', now: 1005 })
}

function createAidedSuccessReviewSession(): ClassroomSession {
  let session = classroomReducer(createReviewSession(), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.program.main.entry-shape.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.program.main.define-entry',
      conceptIds: ['cj.program.main'],
      prompt: '写出 main 入口。',
      starterCode: 'main() {\n    println("ready")\n}',
      expectedOutput: 'ready',
      matchMode: 'exact',
      intent: 'mainline',
      personalizationInputs: { summary: 'test' },
    },
    now: 1003,
  })
  session = classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'ready\n', stderr: '', exitCode: 0 },
    attempt: { assistance: [createCodeSuggestionAssistance(1004)] },
    now: 1005,
  })
  return classroomReducer(session, { type: 'CONSUME_EVENT', now: 1006 })
}

function createCompletedReviewCheckSession(): ClassroomSession {
  let session = classroomReducer(createReviewSession(), {
    type: 'CREATE_EXERCISE_INSTANCE',
    exercise: {
      templateId: 'cj.program.main.entry-shape.cangjie',
      templateVersion: '2026-05-28',
      skillId: 'cj.program.main.define-entry',
      conceptIds: ['cj.program.main'],
      prompt: '写出 main 入口。',
      starterCode: 'main() {\n    println("ready")\n}',
      expectedOutput: 'ready',
      matchMode: 'exact',
      intent: 'review_check',
      personalizationInputs: { summary: 'review check' },
    },
    now: 1003,
  })
  session = classroomReducer(session, {
    type: 'EXERCISE_SUBMIT_FINISHED',
    result: { ok: true, stdout: 'ready\n', stderr: '', exitCode: 0 },
    now: 1004,
  })
  return classroomReducer(session, { type: 'CONSUME_EVENT', now: 1005 })
}

function createSelfReportReviewSession(): ClassroomSession {
  const session = createReviewSession()
  return {
    ...session,
    learner: {
      ...session.learner,
      evidence: [
        ...session.learner.evidence,
        {
          evidenceId: 'evidence:self-report:main',
          skillId: 'cj.program.main.write-entry',
          conceptIds: ['cj.program.main'],
          outcome: 'self_report',
          strength: 'self_report',
          summary: 'Learner said they understand main.',
          createdAt: 1004,
        },
      ],
    },
  }
}

function createQueuedReviewSession(): ClassroomSession {
  return classroomReducer(createReviewSession(), {
    type: 'EMIT_CHAT_INTENT',
    intent: 'go_deeper',
    summary: 'Learner is waiting for more detail.',
    activeConceptId: 'cj.program.main',
    now: 1003,
  })
}

function createVersionMismatchReviewSession(): ClassroomSession {
  const session = createReviewSession()
  const headingExposure = session.learner.reviewExposures['cj.program.main.heading']
  return {
    ...session,
    learner: {
      ...session.learner,
      reviewExposures: {
        ...session.learner.reviewExposures,
        'cj.program.main.heading': {
          ...headingExposure,
          contentVersion: '2026-01-01',
        },
      },
    },
  }
}

function ReviewHarness() {
  const [session, setSession] = useState(createReviewSession)
  const dispatch = (action: ClassroomAction) => {
    setSession(current => classroomReducer(current, action))
  }
  return (
    <Wrapper>
      <ClassroomReviewView
        session={session}
        dispatch={dispatch}
        lang="zh"
        onOpenChat={vi.fn()}
      />
    </Wrapper>
  )
}

function EnReviewHarness() {
  const [session, setSession] = useState(createReviewSession)
  const dispatch = (action: ClassroomAction) => {
    setSession(current => classroomReducer(current, action))
  }
  return (
    <EnWrapper>
      <ClassroomReviewView
        session={session}
        dispatch={dispatch}
        lang="en"
        onOpenChat={vi.fn()}
      />
    </EnWrapper>
  )
}

function GroupedClarificationReviewHarness() {
  const [session, setSession] = useState(createGroupedClarificationReviewSession)
  const dispatch = (action: ClassroomAction) => {
    setSession(current => classroomReducer(current, action))
  }
  return (
    <Wrapper>
      <ClassroomReviewView
        session={session}
        dispatch={dispatch}
        lang="zh"
        onOpenChat={vi.fn()}
      />
    </Wrapper>
  )
}

function BlockedReviewHarness() {
  const [session, setSession] = useState(createBlockedReviewSession)
  const dispatch = (action: ClassroomAction) => {
    setSession(current => classroomReducer(current, action))
  }
  return (
    <Wrapper>
      <ClassroomReviewView
        session={session}
        dispatch={dispatch}
        lang="zh"
        onOpenChat={vi.fn()}
      />
    </Wrapper>
  )
}

function EvidenceLinkedReviewHarness() {
  const [session, setSession] = useState(createEvidenceLinkedReviewSession)
  const dispatch = (action: ClassroomAction) => {
    setSession(current => classroomReducer(current, action))
  }
  return (
    <Wrapper>
      <ClassroomReviewView
        session={session}
        dispatch={dispatch}
        lang="zh"
        onOpenChat={vi.fn()}
      />
    </Wrapper>
  )
}

describe('classroom review view', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useLLMConfigStore.getState().reset()
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    useLLMConfigStore.getState().reset()
  })

  it('lets learners undo removing retained review content', async () => {
    render(<ReviewHarness />)

    const noteKind = screen.getByText('补充说明').parentElement
    expect(noteKind?.className).toContain('max-w-full')
    expect(noteKind?.className).toContain('flex-wrap')
    const noteTitle = screen.getByRole('heading', { name: 'main 入口提醒' })
    expect(noteTitle.className).toContain('break-words')
    expect(screen.getByText('记住 main 入口').className).toContain('break-words')
    expect(screen.getByText('main 是程序入口。').className).toContain('break-words')

    const remove = screen.getByRole('button', { name: '移除复习内容：main 入口提醒' })
    expect(remove.className).toContain('shrink-0')
    expect(describedByText(remove)).toBe('只会从复习页移除这条笔记，教程内容和学习进度不会改变。')
    expect(remove.getAttribute('title')).toBe('只会从复习页移除这条笔记，教程内容和学习进度不会改变。')
    expect(remove.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(remove)

    screen.getByText('已移除复习内容。')
    screen.getByText('main 入口提醒')
    const removedRegion = screen.getByRole('region', { name: '已移除复习内容。' })
    const removedStatus = removedRegion.querySelector('[role="status"]') as HTMLElement
    expect(removedStatus).toBeTruthy()
    expect(removedRegion.getAttribute('aria-describedby')).toBe(removedStatus.id)
    expect(removedStatus.getAttribute('aria-live')).toBe('polite')
    expect(removedStatus.getAttribute('aria-atomic')).toBe('true')
    expect(removedStatus.textContent).toContain('main 入口提醒')
    expect(screen.queryByText('相关练习记录仍会保留。')).toBeNull()
    expect(screen.queryByText('main 是程序入口。')).toBeNull()
    screen.getByText('当前概念暂无个人笔记')
    screen.getByText('已移除的内容可以先撤销；上方教程内容和学习进度仍会保留。')

    const undo = screen.getByRole('button', { name: '撤销' })
    await waitFor(() => expect(document.activeElement).toBe(undo))
    expect(undo.className).toContain('w-full')
    expect(undo.className).toContain('sm:w-auto')
    expect(undo.getAttribute('aria-describedby')).toBe(removedStatus.id)
    expect(describedByText(undo)).toContain('main 入口提醒')
    expect(undo.getAttribute('title')).toBe('撤销移除，恢复这条复习内容；教程内容和学习进度一直保留。')
    expect(undo.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(undo)

    screen.getByText('main 是程序入口。')
    expect(screen.queryByText('已移除复习内容。')).toBeNull()
    const restoredCard = screen.getByText('main 是程序入口。').closest('article')
    expect(restoredCard?.getAttribute('tabindex')).toBe('-1')
    await waitFor(() => expect(document.activeElement).toBe(restoredCard))
  })

  it('explains when removing a grouped review note affects multiple retained notes', () => {
    render(<GroupedClarificationReviewHarness />)

    screen.getByText('main 是程序入口。', { exact: false })
    screen.getByText('main 只能有一个入口。', { exact: false })

    const remove = screen.getByRole('button', { name: '移除复习内容：main 入口提醒' })
    expect(describedByText(remove)).toBe('会从复习页移除这组 2 条合并后的笔记，教程内容和学习进度不会改变。')
    expect(remove.getAttribute('title')).toBe('会从复习页移除这组 2 条合并后的笔记，教程内容和学习进度不会改变。')
    expect(screen.getByText('x2').className).toContain('shrink-0')
    const removeDescription = screen.getByText('会从复习页移除这组 2 条合并后的笔记，教程内容和学习进度不会改变。')
    expect(removeDescription.className).toContain('break-words')
    expect(removeDescription.className).toContain('leading-5')
    expect(removeDescription.className).toContain('text-muted-foreground')

    fireEvent.click(remove)

    screen.getByText('已移除复习内容。')
    screen.getByText('当前概念暂无个人笔记')
    expect(screen.queryByText('main 是程序入口。', { exact: false })).toBeNull()
    expect(screen.queryByText('main 只能有一个入口。', { exact: false })).toBeNull()
  })

  it('shows a contextual empty state when the active concept has no personal notes yet', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createInitialClassroomSession({ lang: 'zh' })}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    const empty = screen.getByTestId('classroom-review-empty-notes')
    expect(empty.className).toContain('border-dashed')
    screen.getByText('当前概念暂无个人笔记')
    screen.getByText('先看上方建议；需要保留的说明会出现在这里。')
  })

  it('discloses when review content is newer than the version the learner saw', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createVersionMismatchReviewSession()}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    const badge = screen.getByText('内容已更新')
    const notice = screen.getByTestId('review-block-version-notice')
    expect(badge.getAttribute('aria-describedby')).toBe(notice.id)
    expect(notice.textContent).toContain('最初学习版本')
    expect(notice.textContent).toContain('2026-01-01')
    expect(notice.textContent).toContain('当前复习显示版本')
    expect(notice.textContent).toContain('2026-05-28')
  })

  it('gives source tutorial links distinct accessible names', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReviewSession()}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    const source = screen.getByRole('link', { name: '打开来源教程：程序入口与 main，welcome / intro / 1' })
    expect(source.textContent).toBe('来源教程')
    expect(source.getAttribute('title')).toBe('打开来源教程：程序入口与 main，welcome / intro / 1')
    expect(source.getAttribute('href')).toBe('/zh/tour/welcome/1')
    expect(source.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('explains retained evidence only when removing review content linked to practice records', () => {
    render(<EvidenceLinkedReviewHarness />)

    screen.getByText('保留 main 练习里的错误模式。')

    const clarificationRemove = screen.getByRole('button', { name: '移除复习内容：main 入口提醒' })
    expect(describedByText(clarificationRemove)).toBe('只会从复习页移除这条笔记，教程内容和学习进度不会改变。')
    expect(clarificationRemove.getAttribute('title')).toBe('只会从复习页移除这条笔记，教程内容和学习进度不会改变。')

    const remediationRemove = screen.getByRole('button', { name: '移除复习内容：main 练习提示' })
    expect(describedByText(remediationRemove)).toBe('只会从复习页移除这条笔记，相关练习记录仍会保留。')
    expect(remediationRemove.getAttribute('title')).toBe('只会从复习页移除这条笔记，相关练习记录仍会保留。')

    fireEvent.click(remediationRemove)

    screen.getByText('已移除复习内容。')
    screen.getByText('main 练习提示')
    screen.getByText('相关练习记录仍会保留。')
    expect(screen.getByRole('button', { name: '撤销' }).getAttribute('title')).toBe('撤销移除，恢复这条复习内容；相关练习记录一直保留。')
    expect(screen.queryByText('保留 main 练习里的错误模式。')).toBeNull()
  })

  it('surfaces derived progress and blocker guidance for the active review concept', () => {
    render(<BlockedReviewHarness />)

    expect(screen.getAllByRole('heading', { name: '标准输出 println' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('卡住').length).toBeGreaterThan(0)
    screen.getByText('下一步建议')
    screen.getByText('先查看提示，再重新提交')
    const action = screen.getByRole('button', { name: '查看当前练习' })
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    const reason = screen.getByTestId('review-progress-reason')
    expect(reason.className).toContain('rounded-md')
    expect(reason.className).toContain('break-words')
    expect(reason.textContent).toContain('建议依据')
    expect(reason.textContent).toContain('最近练习没有通过，先查看针对性提示比直接继续更有效。')
    expect(action.getAttribute('aria-describedby')).toContain(reason.id)
    const progressSource = screen.getByTestId('review-progress-source')
    expect(progressSource.id).toBeTruthy()
    expect(progressSource.className).toContain('break-words')
    expect(progressSource.textContent).toContain('进度来源')
    expect(progressSource.textContent).toContain('由课堂内容记录和 2 条练习证据自动推导，不由 AI 聊天直接判定。')
    expect(action.getAttribute('aria-describedby')).toContain(progressSource.id)
    const overview = screen.getByTestId('review-progress-evidence-overview')
    expect(overview.id).toBeTruthy()
    expect(overview.className).toContain('break-words')
    expect(overview.textContent).toContain('证据概览')
    expect(overview.textContent).toContain('总计2')
    expect(overview.textContent).toContain('通过0')
    expect(overview.textContent).toContain('未通过2')
    expect(overview.textContent).toContain('跳过0')
    expect(overview.textContent).toContain('未通过记录会保留，并用于安排提示或复查。')
    expect(action.getAttribute('aria-describedby')).toContain(overview.id)
    expect(describedByText(action)).toContain('最近练习没有通过，先查看针对性提示比直接继续更有效。')
    expect(describedByText(action)).toContain('不由 AI 聊天直接判定。')
    expect(describedByText(action)).toContain('证据概览')
    expect(describedByText(action)).toContain('未通过记录会保留')
    expect(describedByText(action)).toContain('先完成、跳过或提交当前练习，再使用复习页操作。')
    expect(action.getAttribute('title')).toContain('建议依据：最近练习没有通过，先查看针对性提示比直接继续更有效。')
    expect(action.getAttribute('title')).toContain('进度来源：由课堂内容记录和 2 条练习证据自动推导，不由 AI 聊天直接判定。')
    expect(action.getAttribute('title')).toContain('证据概览：总计 2，通过 0，未通过 2，跳过 0。')
    expect(action.getAttribute('title')).toContain('先完成、跳过或提交当前练习，再使用复习页操作。')
    expect(action.getAttribute('title')).toContain('这项练习已连续 2 次未通过，建议先看相关提示再试一次。')
    const actionDetails = screen.getByTestId('review-progress-action-details')
    expectPoliteStatus(actionDetails)
    expect(action.getAttribute('aria-describedby')?.split(' ')).toContain(actionDetails.id)
    expect(actionDetails.textContent).toContain('先完成、跳过或提交当前练习，再使用复习页操作。')
    expect(actionDetails.textContent).toContain('这项练习已连续 2 次未通过，建议先看相关提示再试一次。')
    screen.getByText('先完成、跳过或提交当前练习，再使用复习页操作。')
    screen.getByText('这项练习已连续 2 次未通过，建议先看相关提示再试一次。')
    expect(describedByText(action)).toContain('这项练习已连续 2 次未通过，建议先看相关提示再试一次。')
    screen.getByText('最近记录')
    screen.getByText('最近一次练习未通过，已作为需要提示或再练习的证据记录。')
  })

  it('explains the latest review-check evidence in the progress summary', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createCompletedReviewCheckSession()}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    expect(screen.getAllByText('已掌握').length).toBeGreaterThan(0)
    screen.getByText('可以继续下一步')
    screen.getByText('已有通过证据，当前概念可以先回到课堂继续推进。')
    const evidence = screen.getByTestId('review-progress-evidence')
    expect(evidence.className).toContain('border-t')
    expect(evidence.className).toContain('break-words')
    const overview = screen.getByTestId('review-progress-evidence-overview')
    expect(overview.textContent).toContain('证据概览')
    expect(overview.textContent).toContain('总计1')
    expect(overview.textContent).toContain('通过1')
    expect(overview.textContent).toContain('复习检查1')
    expect(overview.textContent).toContain('掌握证据1')
    expect(overview.textContent).toContain('包含 1 条独立复习检查掌握证据。')
    const totalPill = screen.getByText('总计').parentElement
    expect(totalPill?.className).toContain('max-w-full')
    expect(totalPill?.className).toContain('whitespace-normal')
    expect(totalPill?.className).toContain('leading-5')
    expect(screen.getByText('总计').className).toContain('break-words')
    expect(totalPill?.querySelectorAll('span')[1]?.className).toContain('shrink-0')
    screen.getByText('最近记录')
    screen.getByText('最近一次复习检查独立通过，已作为掌握证据记录。')
  })

  it('shows self-reported understanding as provisional evidence in the overview', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createSelfReportReviewSession()}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    screen.getByText('继续完成练习')
    const action = screen.getByRole('button', { name: '开始练习验证' })
    const overview = screen.getByTestId('review-progress-evidence-overview')
    expect(overview.textContent).toContain('总计1')
    expect(overview.textContent).toContain('自述1')
    expect(overview.textContent).toContain('自我反馈需要后续练习验证。')
    expect(describedByText(action)).toContain('自我反馈需要后续练习验证。')
    screen.getByText('最近记录')
    screen.getByText('最近记录来自自我反馈，还需要练习验证。')
  })

  it('calls out AI-assisted evidence as weaker in the review progress overview', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createAidedSuccessReviewSession()}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    const action = screen.getByRole('button', { name: '返回课堂继续' })
    const overview = screen.getByTestId('review-progress-evidence-overview')
    expect(overview.textContent).toContain('总计1')
    expect(overview.textContent).toContain('通过1')
    expect(overview.textContent).toContain('AI 帮助后1')
    expect(overview.textContent).toContain('有 1 条是在 AI 帮助后产生，作为较弱证据保留。')
    expect(describedByText(action)).toContain('AI 帮助后产生')
    screen.getByText('最近一次练习在 AI 帮助后通过，已记录为较弱证据。')
  })

  it('queues a concept-scoped practice check from Review View', () => {
    const dispatch = vi.fn()
    const onReviewCheckQueued = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReviewSession()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
        />
      </Wrapper>,
    )

    const action = screen.getByRole('button', { name: '开始练习验证' })
    expect(describedByText(action)).toContain('建议依据')
    expect(describedByText(action)).toContain('已看过核心内容，但还没有通过练习证据。')
    expect(describedByText(action)).toContain('由已看过的课堂内容自动推导；还没有练习证据，不由 AI 聊天直接判定。')
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(action.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    expect(action.querySelector('span')?.className).toContain('break-words')

    fireEvent.click(action)

    screen.getByText('已看过核心内容，但还没有通过练习证据。')
    const requestedStatus = screen.getByTestId('review-action-requested-status')
    expect(requestedStatus.getAttribute('role')).toBe('status')
    expect(requestedStatus.getAttribute('aria-live')).toBe('polite')
    expect(requestedStatus.getAttribute('aria-atomic')).toBe('true')
    expect(requestedStatus.className).toContain('break-words')
    expect(requestedStatus.textContent).toBe('已收到：开始练习验证。正在准备课堂内容。')
    const preparingAction = screen.getByRole('button', { name: '正在准备...' }) as HTMLButtonElement
    expect(preparingAction.disabled).toBe(true)
    expect(preparingAction.getAttribute('aria-busy')).toBe('true')
    expect(preparingAction.getAttribute('aria-describedby')?.split(' ')).toContain(requestedStatus.id)
    expect(preparingAction.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(preparingAction.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')

    fireEvent.click(preparingAction)

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'review_check',
      activeConceptId: 'cj.program.main',
      summary: '请为 程序入口与 main 安排一次练习验证。',
    }))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(onReviewCheckQueued).toHaveBeenCalledTimes(1)
  })

  it('re-enables the review action after queued preparation returns to the same recommendation', () => {
    const dispatch = vi.fn()
    const onReviewCheckQueued = vi.fn()
    const baseSession = createReviewSession()
    const queuedSession = classroomReducer(baseSession, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'review_check',
      summary: '请为 程序入口与 main 安排一次练习验证。',
      activeConceptId: 'cj.program.main',
      now: 1003,
    })
    const { rerender } = render(
      <Wrapper>
        <ClassroomReviewView
          session={baseSession}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '开始练习验证' }))
    expect((screen.getByRole('button', { name: '正在准备...' }) as HTMLButtonElement).disabled).toBe(true)

    rerender(
      <Wrapper>
        <ClassroomReviewView
          session={queuedSession}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
        />
      </Wrapper>,
    )

    screen.getByText('课堂正在准备下一步，完成后再开始练习验证。')
    expect(screen.getByRole('button', { name: '查看准备进度' })).toBeTruthy()

    rerender(
      <Wrapper>
        <ClassroomReviewView
          session={baseSession}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
        />
      </Wrapper>,
    )

    expect(screen.queryByTestId('review-action-requested-status')).toBeNull()
    expect((screen.getByRole('button', { name: '开始练习验证' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('returns to preparation instead of queuing review actions while lesson generation is pending', () => {
    const dispatch = vi.fn()
    const onReviewCheckQueued = vi.fn()
    const onReturnToLive = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReviewSession()}
          dispatch={dispatch}
          lang="zh"
          lessonGenerationPending
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
          onReturnToLive={onReturnToLive}
        />
      </Wrapper>,
    )

    screen.getByText('课堂准备正在进行或等待恢复，完成后再开始练习验证。')
    const action = screen.getByRole('button', { name: '查看准备进度' })
    expect(describedByText(action)).toContain('课堂准备正在进行或等待恢复')
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('lucide-circle-dashed')
    expect(action.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    fireEvent.click(action)

    expect(dispatch).not.toHaveBeenCalled()
    expect(onReviewCheckQueued).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'generation' })
  })

  it('keeps read-only concepts in review without queuing practice or progress actions', () => {
    withConceptStatus('cj.program.main', 'read_only', () => {
      const dispatch = vi.fn()
      const onReviewCheckQueued = vi.fn()
      render(
        <Wrapper>
          <ClassroomReviewView
            session={createReviewSession()}
            dispatch={dispatch}
            lang="zh"
            onOpenChat={vi.fn()}
            onReviewCheckQueued={onReviewCheckQueued}
          />
        </Wrapper>,
      )

      screen.getByText('只读教程内容')
      screen.getByText('只读复习')
      screen.getByText('这部分内容可用于复习和提问，但没有验证练习，不能作为主线进度推进。')
      screen.getByText('此概念只有已验证说明，缺少可验证的学习技能和练习模板；可以复习内容或聊天提问，但不会排队练习，也不会改变概念进度。')
      expectPoliteStatus(screen.getByTestId('review-progress-action-details'))

      const action = screen.getByRole('button', { name: '仅复习内容' }) as HTMLButtonElement
      expect(action.disabled).toBe(true)
      expect(describedByText(action)).toContain('这部分内容可用于复习和提问')
      expect(describedByText(action)).toContain('不会排队练习，也不会改变概念进度')

      fireEvent.click(action)

      expect(dispatch).not.toHaveBeenCalled()
      expect(onReviewCheckQueued).not.toHaveBeenCalled()
    })
  })

  it('keeps invalid concepts visible but unavailable for progress-driving review actions', () => {
    withConceptStatus('cj.program.main', 'invalid', () => {
      const dispatch = vi.fn()
      const onReviewCheckQueued = vi.fn()
      render(
        <Wrapper>
          <ClassroomReviewView
            session={createReviewSession()}
            dispatch={dispatch}
            lang="zh"
            onOpenChat={vi.fn()}
            onReviewCheckQueued={onReviewCheckQueued}
          />
        </Wrapper>,
      )

      expect(screen.getAllByText('内容不可用').length).toBeGreaterThan(0)
      screen.getByText('此概念尚未通过 AI Classroom 内容验证，不能作为主线课堂、练习或复习检查目标。')
      screen.getByText('内容验证未通过；即使存在历史记录，也不会由 AI 聊天或复习页操作直接生成主线进度。')
      screen.getByText('此概念尚未通过 AI Classroom 内容验证；可以临时聊天提问或查看来源教程，但不会排队课堂内容、练习或概念进度。')
      expectPoliteStatus(screen.getByTestId('review-progress-action-details'))

      const action = screen.getByRole('button', { name: '内容不可用' }) as HTMLButtonElement
      expect(action.disabled).toBe(true)
      expect(describedByText(action)).toContain('不能作为主线课堂、练习或复习检查目标')
      expect(describedByText(action)).toContain('不会排队课堂内容、练习或概念进度')

      fireEvent.click(action)

      expect(dispatch).not.toHaveBeenCalled()
      expect(onReviewCheckQueued).not.toHaveBeenCalled()
    })
  })

  it('keeps preview actions from starting review checks directly', () => {
    const dispatch = vi.fn()
    const onOpenChat = vi.fn()
    const onReturnToLive = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReviewSession()}
          dispatch={dispatch}
          lang="zh"
          previewOnly
          onOpenChat={onOpenChat}
          onReturnToLive={onReturnToLive}
        />
      </Wrapper>,
    )

    screen.getByText('预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。')
    expectPoliteStatus(screen.getByTestId('review-progress-action-details'))
    expect(screen.queryByRole('button', { name: '开始练习验证' })).toBeNull()

    const start = screen.getByRole('button', { name: '开始 AI 课堂' })
    expect(describedByText(start)).toContain('预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。')
    expect(start.getAttribute('title')).toContain('预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。')
    fireEvent.click(start)

    expect(dispatch).not.toHaveBeenCalled()
    expect(onOpenChat).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'generation', conceptId: 'cj.program.main' })

    onReturnToLive.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /标准输出 println/ }))
    const previewChat = screen.getByRole('button', { name: '开始课堂后提问' })
    expect(describedByText(previewChat)).toBe('先进入 AI 课堂，再打开当前复习概念的聊天；不会直接排队复习检查。')
    expect(previewChat.getAttribute('title')).toBe('先进入 AI 课堂，再打开当前复习概念的聊天；不会直接排队复习检查。')
    fireEvent.click(previewChat)

    expect(onOpenChat).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'generation', conceptId: 'cj.io.println' })
  })

  it('uses compiled English copy for preview review navigation and guardrails', () => {
    const dispatch = vi.fn()
    const onOpenChat = vi.fn()
    const onReturnToLive = vi.fn()
    render(
      <EnWrapper>
        <ClassroomReviewView
          session={createInitialClassroomSession({ lang: 'en' })}
          dispatch={dispatch}
          lang="en"
          previewOnly
          onOpenChat={onOpenChat}
          onReturnToLive={onReturnToLive}
        />
      </EnWrapper>,
    )

    screen.getByRole('navigation', { name: 'Review concept navigation' })
    screen.getByText('Recommendation reason')
    screen.getByText('Progress source')
    screen.getByText('No personal notes for this concept yet')
    expect(screen.queryByText('预览模式只展示已验证课程内容。开始课堂后再使用聊天、练习验证和个性化讲解。')).toBeNull()

    const activeStatus = screen.getByTestId('classroom-review-active-concept-status')
    expect(activeStatus.textContent).toContain('Viewing review concept Program entry and main')
    expect(activeStatus.textContent).toContain('progress Not started')

    const start = screen.getByRole('button', { name: 'Start AI Classroom' })
    expect(describedByText(start)).toContain(
      'Preview mode only shows validated course content. Start the classroom before using chat, practice verification, and personalized explanations.',
    )
    expect(start.getAttribute('title')).toContain(
      'Recommendation reason: This content is not in the classroom path yet. Study the core content first.',
    )
    expect(start.getAttribute('title')).toContain(
      'Progress source: No classroom content record or exercise evidence yet. AI chat does not directly determine progress.',
    )
    fireEvent.click(start)
    expect(dispatch).not.toHaveBeenCalled()
    expect(onOpenChat).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'generation', conceptId: 'cj.program.main' })

    onReturnToLive.mockClear()
    const previewChat = screen.getByRole('button', { name: 'Ask after starting classroom' })
    expect(describedByText(previewChat)).toBe(
      'Start AI Classroom before opening chat for the current review concept. This will not queue a review check directly.',
    )
    expect(previewChat.getAttribute('title')).toBe(
      'Start AI Classroom before opening chat for the current review concept. This will not queue a review check directly.',
    )
    fireEvent.click(previewChat)
    expect(onOpenChat).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'generation', conceptId: 'cj.program.main' })

    const source = screen.getByRole('link', { name: /Open source tutorial: Program entry and main/ })
    expect(source.getAttribute('title')).toContain('Open source tutorial: Program entry and main')
  })

  it('uses compiled English copy for removing and restoring retained review content', async () => {
    render(<EnReviewHarness />)

    const remove = screen.getByRole('button', { name: 'Remove review content: main 入口提醒' })
    expect(describedByText(remove)).toBe('This only removes this note from Review. Tutorial content and learning progress will not change.')
    expect(remove.getAttribute('title')).toBe('This only removes this note from Review. Tutorial content and learning progress will not change.')
    expect(screen.queryByText('只会从复习页移除这条笔记，教程内容和学习进度不会改变。')).toBeNull()

    fireEvent.click(remove)

    screen.getByText('Review content removed.')
    screen.getByText('No personal notes for this concept yet')
    screen.getByText('Removed content can be undone first. The tutorial content above and learning progress are still kept.')
    expect(screen.queryByText('已移除复习内容。')).toBeNull()

    const removedRegion = screen.getByRole('region', { name: 'Review content removed.' })
    const removedStatus = removedRegion.querySelector('[role="status"]') as HTMLElement
    const undo = screen.getByRole('button', { name: 'Undo' })
    await waitFor(() => expect(document.activeElement).toBe(undo))
    expect(undo.getAttribute('aria-describedby')).toBe(removedStatus.id)
    expect(undo.getAttribute('title')).toBe('Undo removal and restore this review content. Tutorial content and learning progress have been kept.')

    fireEvent.click(undo)

    screen.getByText('main 是程序入口。')
    expect(screen.queryByText('Review content removed.')).toBeNull()
  })

  it('uses compiled English copy for AI-assisted review evidence', () => {
    const dispatch = vi.fn()
    render(
      <EnWrapper>
        <ClassroomReviewView
          session={createAidedSuccessReviewSession()}
          dispatch={dispatch}
          lang="en"
          onOpenChat={vi.fn()}
        />
      </EnWrapper>,
    )

    const action = screen.getByRole('button', { name: 'Return to classroom' })
    const overview = screen.getByTestId('review-progress-evidence-overview')
    expect(overview.textContent).toContain('Evidence overview')
    expect(overview.textContent).toContain('Total1')
    expect(overview.textContent).toContain('Passed1')
    expect(overview.textContent).toContain('AI-assisted1')
    expect(overview.textContent).toContain('1 item(s) were produced after AI help and are kept as weaker evidence.')
    expect(describedByText(action)).toContain('produced after AI help')
    screen.getByText('The latest exercise passed with AI help and was recorded as weaker evidence.')
  })

  it('uses compiled English copy for read-only review concepts', () => {
    withConceptStatus('cj.program.main', 'read_only', () => {
      const dispatch = vi.fn()
      const onReviewCheckQueued = vi.fn()
      render(
        <EnWrapper>
          <ClassroomReviewView
            session={createReviewSession()}
            dispatch={dispatch}
            lang="en"
            onOpenChat={vi.fn()}
            onReviewCheckQueued={onReviewCheckQueued}
          />
        </EnWrapper>,
      )

      screen.getByText('Read-only tutorial content')
      screen.getByText('Read-only review')
      screen.getByText('This content can be used for review and questions, but it has no validated practice and cannot advance mainline progress.')
      screen.getByText('This concept only has validated explanation content and lacks verifiable skills or exercise templates. You can review content or ask in chat, but this will not queue practice or change concept progress.')
      expect(screen.queryByText('只读教程内容')).toBeNull()
      expectPoliteStatus(screen.getByTestId('review-progress-action-details'))

      const action = screen.getByRole('button', { name: 'Review-only content' }) as HTMLButtonElement
      expect(action.disabled).toBe(true)
      expect(describedByText(action)).toContain('This content can be used for review and questions')
      expect(describedByText(action)).toContain('This concept only has validated explanation content')

      fireEvent.click(action)

      expect(dispatch).not.toHaveBeenCalled()
      expect(onReviewCheckQueued).not.toHaveBeenCalled()
    })
  })

  it('uses compiled English copy for invalid review concepts', () => {
    withConceptStatus('cj.program.main', 'invalid', () => {
      const dispatch = vi.fn()
      const onReviewCheckQueued = vi.fn()
      render(
        <EnWrapper>
          <ClassroomReviewView
            session={createReviewSession()}
            dispatch={dispatch}
            lang="en"
            onOpenChat={vi.fn()}
            onReviewCheckQueued={onReviewCheckQueued}
          />
        </EnWrapper>,
      )

      expect(screen.getAllByText('Content unavailable').length).toBeGreaterThan(0)
      screen.getByText('This concept has not passed AI Classroom content validation, so it cannot be used as a mainline classroom, practice, or review-check target.')
      screen.getByText('Content validation did not pass. Even if history exists, AI chat or Review actions will not directly generate mainline progress.')
      screen.getByText('This concept has not passed AI Classroom content validation. You can temporarily ask in chat or view the source tutorial, but this will not queue classroom content, practice, or concept progress.')
      expect(screen.queryByText('内容不可用')).toBeNull()
      expectPoliteStatus(screen.getByTestId('review-progress-action-details'))

      const action = screen.getByRole('button', { name: 'Content unavailable' }) as HTMLButtonElement
      expect(action.disabled).toBe(true)
      expect(describedByText(action)).toContain('cannot be used as a mainline classroom, practice, or review-check target')
      expect(describedByText(action)).toContain('will not queue classroom content, practice, or concept progress')
      expect(action.getAttribute('title')).toContain('Content validation did not pass.')
      expect(action.getAttribute('title')).toContain('will not queue classroom content, practice, or concept progress')

      fireEvent.click(action)

      expect(dispatch).not.toHaveBeenCalled()
      expect(onReviewCheckQueued).not.toHaveBeenCalled()
    })
  })

  it('queues a concept-scoped topic change when the concept has not been exposed', () => {
    const dispatch = vi.fn()
    const onReviewCheckQueued = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createInitialClassroomSession({ lang: 'zh' })}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
        />
      </Wrapper>,
    )

    screen.getByText('先学习核心内容')
    screen.getByText('这部分内容还没有进入课堂主线，先学习核心内容。')
    fireEvent.click(screen.getByRole('button', { name: '开始学习此概念' }))

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'change_topic',
      activeConceptId: 'cj.program.main',
      summary: '请从 程序入口与 main 开始讲解。',
    }))
    expect(onReviewCheckQueued).toHaveBeenCalled()
  })

  it('keeps the review action button wrap-safe on narrow screens', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createInitialClassroomSession({ lang: 'zh' })}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    const action = screen.getByRole('button', { name: '开始学习此概念' })
    expect(action.className).toContain('w-full')
    expect(action.className).toContain('max-w-full')
    expect(action.className).toContain('whitespace-normal')
    expect(action.className).toContain('sm:w-auto')
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps review navigation and chat action mobile-safe', () => {
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createInitialClassroomSession({ lang: 'zh' })}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    const conceptRail = screen.getByTestId('classroom-review-concept-rail')
    expect(screen.getByRole('navigation', { name: '复习概念导航' })).toBe(conceptRail)
    expect(conceptRail.className).toContain('overflow-x-auto')
    expect(conceptRail.className).toContain('overscroll-x-contain')
    expect(conceptRail.className).toContain('snap-x')

    const conceptPosition = screen.getByTestId('classroom-review-concept-position')
    expect(conceptPosition.className).toContain('md:hidden')
    expect(conceptPosition.textContent).toMatch(/^概念 1 \/ \d+$/)

    const validatedBadge = screen.getByText('已验证教程内容').closest('span')
    expect(validatedBadge?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    const conceptButton = screen.getByRole('button', { name: /程序入口与 main/ })
    expect(conceptButton.className).toContain('shrink-0')
    expect(conceptButton.className).toContain('snap-start')
    expect(conceptButton.className).toContain('w-44')
    expect(conceptButton.className).toContain('max-w-[72vw]')
    expect(conceptButton.className).toContain('md:w-full')
    expect(conceptButton.getAttribute('aria-current')).toBe('true')
    expect(conceptButton.getAttribute('aria-label')).toContain('当前选中')
    expect(conceptButton.getAttribute('aria-label')).toContain('进度 未开始')
    expect(conceptButton.getAttribute('title')).toBe(conceptButton.getAttribute('aria-label'))
    expect(conceptButton.querySelector('.truncate')).not.toBeNull()
    conceptButton.querySelectorAll('svg').forEach((icon) => {
      expect(icon.getAttribute('aria-hidden')).toBe('true')
    })

    const activeStatus = screen.getByTestId('classroom-review-active-concept-status')
    const activeMain = screen.getByRole('main', { name: '程序入口与 main' })
    expect(activeMain.getAttribute('aria-describedby')).toBe(activeStatus.id)
    const activeHeading = activeMain.querySelector('h2')
    expect(activeHeading).toBeTruthy()
    if (!activeHeading)
      throw new Error('missing active review heading')
    expect(activeHeading?.textContent).toBe('程序入口与 main')
    expect(activeHeading.className).toContain('break-words')
    const activeSummary = activeHeading.parentElement?.querySelector('p')
    expect(activeSummary?.className).toContain('break-words')
    expect(activeStatus.getAttribute('role')).toBe('status')
    expect(activeStatus.getAttribute('aria-live')).toBe('polite')
    expect(activeStatus.getAttribute('aria-atomic')).toBe('true')
    expect(activeStatus.className).toContain('sr-only')
    expect(activeStatus.textContent).toContain('正在查看复习概念 程序入口与 main')
    expect(activeStatus.textContent).toContain('概念 1 /')
    expect(activeStatus.textContent).toContain('进度 未开始')

    const nextConceptButton = screen.getByRole('button', { name: /标准输出 println/ })
    expect(nextConceptButton.getAttribute('aria-label')).toContain('可切换')
    expect(nextConceptButton.getAttribute('title')).toBe(nextConceptButton.getAttribute('aria-label'))
    fireEvent.click(nextConceptButton)
    expect(conceptPosition.textContent).toMatch(/^概念 2 \/ \d+$/)
    expect(nextConceptButton.getAttribute('aria-current')).toBe('true')
    expect(conceptButton.getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('main', { name: '标准输出 println' }).getAttribute('aria-describedby')).toBe(activeStatus.id)
    expect(activeStatus.textContent).toContain('正在查看复习概念 标准输出 println')
    expect(activeStatus.textContent).toContain('概念 2 /')

    const chat = screen.getByRole('button', { name: '围绕此概念聊天' })
    expect(chat.className).toContain('w-full')
    expect(chat.className).toContain('justify-center')
    expect(chat.className).toContain('sm:w-auto')
    expect(describedByText(chat)).toBe('打开只围绕当前复习概念的聊天；不会改变复习进度或排队新的课堂内容。')
    expect(chat.getAttribute('title')).toBe('打开只围绕当前复习概念的聊天；不会改变复习进度或排队新的课堂内容。')
    expect(chat.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('reports the active review concept when selection changes', async () => {
    const onActiveConceptChange = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createInitialClassroomSession({ lang: 'zh' })}
          dispatch={vi.fn()}
          lang="zh"
          onOpenChat={vi.fn()}
          onActiveConceptChange={onActiveConceptChange}
        />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(onActiveConceptChange).toHaveBeenCalledWith('cj.program.main')
    })

    fireEvent.click(screen.getByRole('button', { name: /标准输出 println/ }))

    await waitFor(() => {
      expect(onActiveConceptChange).toHaveBeenLastCalledWith('cj.io.println')
    })
  })

  it('keeps the active review concept visible in the horizontal rail', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView

    try {
      render(
        <Wrapper>
          <ClassroomReviewView
            session={createInitialClassroomSession({ lang: 'zh' })}
            dispatch={vi.fn()}
            lang="zh"
            focusConceptId="cj.var.immutable"
            onOpenChat={vi.fn()}
          />
        </Wrapper>,
      )

      const focusedConcept = screen.getByRole('button', { name: /不可变绑定 let/ })
      expect(focusedConcept.getAttribute('aria-current')).toBe('true')
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' })
      })
    }
    finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('honors a new external focus even after the learner selected another concept', async () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    const { rerender } = render(
      <Wrapper>
        <ClassroomReviewView
          session={session}
          dispatch={vi.fn()}
          lang="zh"
          focusConceptId="cj.io.println"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: '标准输出 println' }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: /程序入口与 main/ }))
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: '程序入口与 main' }).length).toBeGreaterThan(0)
    })

    rerender(
      <Wrapper>
        <ClassroomReviewView
          session={session}
          dispatch={vi.fn()}
          lang="zh"
          focusConceptId="cj.var.immutable"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: '不可变绑定 let' }).length).toBeGreaterThan(0)
    })
  })

  it('honors a repeated external focus request for the same concept', async () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    const { rerender } = render(
      <Wrapper>
        <ClassroomReviewView
          session={session}
          dispatch={vi.fn()}
          lang="zh"
          focusConceptId="cj.program.main"
          focusRequestKey={1}
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: '程序入口与 main' }).length).toBeGreaterThan(0)
    })
    const firstFocusedMain = screen.getByRole('main', { name: '程序入口与 main' })
    const firstFocusedHeading = firstFocusedMain.querySelector('h2')
    const firstFocusNotice = screen.getByTestId('classroom-review-focus-notice')
    expectPoliteStatus(firstFocusNotice)
    expect(firstFocusNotice.textContent).toContain('已打开 程序入口与 main 的复习。')
    await waitFor(() => expect(document.activeElement).toBe(firstFocusedHeading))
    expect(firstFocusedHeading?.getAttribute('tabindex')).toBe('-1')

    fireEvent.click(screen.getByRole('button', { name: /标准输出 println/ }))
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: '标准输出 println' }).length).toBeGreaterThan(0)
    })

    rerender(
      <Wrapper>
        <ClassroomReviewView
          session={session}
          dispatch={vi.fn()}
          lang="zh"
          focusConceptId="cj.program.main"
          focusRequestKey={2}
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: '程序入口与 main' }).length).toBeGreaterThan(0)
    })
    const refocusedMain = screen.getByRole('main', { name: '程序入口与 main' })
    const refocusedHeading = refocusedMain.querySelector('h2')
    const refocusNotice = screen.getByTestId('classroom-review-focus-notice')
    expectPoliteStatus(refocusNotice)
    expect(refocusNotice.textContent).toContain('已打开 程序入口与 main 的复习。')
    await waitFor(() => expect(document.activeElement).toBe(refocusedHeading))
  })

  it('queues targeted help instead of a review check for blocked concepts without an active exercise', () => {
    const dispatch = vi.fn()
    const onReviewCheckQueued = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createBlockedReviewSessionWithoutActiveExercise()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
        />
      </Wrapper>,
    )

    screen.getByText('先查看提示，再重新提交')
    fireEvent.click(screen.getByRole('button', { name: '请求针对性提示' }))

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'explain_error',
      activeConceptId: 'cj.io.println',
      summary: '请围绕 标准输出 println 的未通过练习给出针对性提示。',
    }))
    expect(onReviewCheckQueued).toHaveBeenCalled()
  })

  it('returns to Live View instead of queuing another review check for ready concepts', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })
    const dispatch = vi.fn()
    const onReturnToLive = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReadyForNextReviewSession()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReturnToLive={onReturnToLive}
        />
      </Wrapper>,
    )

    screen.getByText('可以继续下一步')
    screen.getByText('已有通过证据，当前概念可以先回到课堂继续推进。')
    screen.getByText('最近一次练习独立通过，已记录为学习证据。')
    fireEvent.click(screen.getByRole('button', { name: '返回课堂继续' }))

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(false)
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'continue' })
  })

  it('opens AI settings instead of queuing a review check when config is incomplete', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReviewSession()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    screen.getByText('完成 AI 服务配置后再开始练习验证。')
    const action = screen.getByRole('button', { name: '配置 AI 服务' })
    expect(describedByText(action)).toContain('完成 AI 服务配置后再开始练习验证。')
    expect(action.getAttribute('title')).toContain('完成 AI 服务配置后再开始练习验证。')
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('lucide-key-round')
    expect(action.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    fireEvent.click(action)

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('keeps the review action available after AI service config is completed', () => {
    useLLMConfigStore.getState().setConfig({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'test-key',
      model: '',
    })
    const dispatch = vi.fn()
    const onReviewCheckQueued = vi.fn()

    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReviewSession()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReviewCheckQueued={onReviewCheckQueued}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '配置 AI 服务' }))

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)

    act(() => {
      useLLMConfigStore.getState().setConfig({
        provider: 'openai-compatible',
        baseURL: 'https://api.example.test/v1',
        apiKey: 'test-key',
        model: 'test-model',
      })
      useLLMConfigStore.getState().setSettingsDialogOpen(false)
    })

    fireEvent.click(screen.getByRole('button', { name: '开始练习验证' }))

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'review_check',
      activeConceptId: 'cj.program.main',
      summary: '请为 程序入口与 main 安排一次练习验证。',
    }))
    expect(onReviewCheckQueued).toHaveBeenCalledTimes(1)
  })

  it('opens AI settings instead of queuing a review check when shared quota is exhausted', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ClassroomReviewView
          session={createReviewSession()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
        />
      </Wrapper>,
    )

    screen.getByText(/共享额度已用完。下次刷新：/)
    screen.getByText(/刷新后再开始练习验证；使用自己的 API Key 可立刻继续。/)
    expectPoliteStatus(screen.getByTestId('review-progress-action-details'))
    const action = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(describedByText(action)).toContain('共享额度已用完。下次刷新：')
    expect(describedByText(action)).toContain('使用自己的 API Key 可立刻继续。')
    expect(action.getAttribute('title')).toContain('共享额度已用完。下次刷新：')
    expect(action.getAttribute('title')).toContain('使用自己的 API Key 可立刻继续。')
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('lucide-key-round')
    expect(action.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    fireEvent.click(action)

    expect(dispatch).not.toHaveBeenCalled()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('returns to the active exercise instead of queuing a review check over it', () => {
    const dispatch = vi.fn()
    const onReturnToLive = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createActiveExerciseReviewSession()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReturnToLive={onReturnToLive}
        />
      </Wrapper>,
    )

    screen.getByText('先完成、跳过或提交当前练习，再使用复习页操作。')
    expectPoliteStatus(screen.getByTestId('review-progress-action-details'))
    const action = screen.getByRole('button', { name: '查看当前练习' })
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(action.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    fireEvent.click(action)

    expect(dispatch).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'current_exercise' })
  })

  it('returns to the active review check with review-specific copy', () => {
    const dispatch = vi.fn()
    const onReturnToLive = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createActiveExerciseReviewSession('review_check')}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReturnToLive={onReturnToLive}
        />
      </Wrapper>,
    )

    screen.getByText('先完成、跳过或提交当前复习检查，再使用复习页操作。')
    expectPoliteStatus(screen.getByTestId('review-progress-action-details'))
    fireEvent.click(screen.getByRole('button', { name: '查看当前复习检查' }))

    expect(dispatch).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'current_exercise' })
  })

  it('returns to queued generation progress instead of adding another review check', () => {
    const dispatch = vi.fn()
    const onReturnToLive = vi.fn()
    render(
      <Wrapper>
        <ClassroomReviewView
          session={createQueuedReviewSession()}
          dispatch={dispatch}
          lang="zh"
          onOpenChat={vi.fn()}
          onReturnToLive={onReturnToLive}
        />
      </Wrapper>,
    )

    screen.getByText('课堂正在准备下一步，完成后再开始练习验证。')
    expectPoliteStatus(screen.getByTestId('review-progress-action-details'))
    const action = screen.getByRole('button', { name: '查看准备进度' })
    expect(action.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('lucide-circle-dashed')
    expect(action.querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
    fireEvent.click(action)

    expect(dispatch).not.toHaveBeenCalled()
    expect(onReturnToLive).toHaveBeenCalledWith({ focus: 'generation' })
  })
})
