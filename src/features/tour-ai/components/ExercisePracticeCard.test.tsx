/* eslint-disable react/component-hook-factories */
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExercisePracticeCard } from './ExercisePracticeCard'
import { CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT } from './classroom-transient-panels'
import { ClassroomActivityProvider } from '@/features/tour-ai/context/classroom-activity-context'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ExerciseInstance, RunResult } from '@/lib/ai/classroom/types'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { requestRemoteAction } from '@/service/run'

interface FakeModel {
  current: string
  setValue: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  listeners: Set<() => void>
}
const fakeModels = new Map<string, FakeModel>()
let shouldMountEditor = true
function setFakeModelValue(model: FakeModel, next: string) {
  model.current = next
  for (const listener of model.listeners)
    listener()
}

function getFakeModel(key: string): FakeModel {
  let model = fakeModels.get(key)
  if (!model) {
    model = { current: '', setValue: vi.fn(), focus: vi.fn(), listeners: new Set() }
    model.setValue.mockImplementation((next: string) => {
      setFakeModelValue(model!, next)
    })
    fakeModels.set(key, model)
  }
  return model
}

vi.mock('@/features/tour/components/TourEditor', () => ({
  TourEditor: ({ code, uriHint, onEditorReady }: { code: string, uriHint?: string, onEditorReady?: (h: MonacoEditorHandle) => void }) => {
    const model = getFakeModel(uriHint ?? 'default')
    useEffect(() => {
      if (!shouldMountEditor)
        return
      onEditorReady?.({
        getEditor: () => ({
          focus: model.focus,
          getModel: () => ({
            setValue: model.setValue,
            getValue: () => model.current,
            onDidChangeContent: (listener: () => void) => {
              model.listeners.add(listener)
              return { dispose: () => model.listeners.delete(listener) }
            },
          }),
          updateOptions: () => undefined,
        }) as unknown as ReturnType<MonacoEditorHandle['getEditor']>,
        dispose: () => undefined,
      })
    }, [model, onEditorReady])
    return <div data-testid="tour-editor" data-uri-hint={uriHint}>{code}</div>
  },
}))

vi.mock('@/service/run', () => ({
  requestRemoteAction: vi.fn(),
}))

vi.mock('@/const', () => ({
  examples: [],
}))

const requestRemoteActionMock = vi.mocked(requestRemoteAction)

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <ClassroomActivityProvider>{children}</ClassroomActivityProvider>
    </I18nProvider>
  )
}

function EnWrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'en', messages: { en: enMessages } })
  i18n.activate('en')
  globalI18n.load({ en: enMessages })
  globalI18n.activate('en')
  return (
    <I18nProvider i18n={i18n}>
      <ClassroomActivityProvider>{children}</ClassroomActivityProvider>
    </I18nProvider>
  )
}

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

function expectPoliteStatus(element: HTMLElement, text?: string) {
  expect(element.getAttribute('role')).toBe('status')
  expect(element.getAttribute('aria-live')).toBe('polite')
  expect(element.getAttribute('aria-atomic')).toBe('true')
  if (text != null)
    expect(element.textContent).toBe(text)
}

const EXERCISE_BASE: ExerciseInstance = {
  id: 'exercise:1',
  templateId: 'cj.io.println.print-value.cangjie',
  templateVersion: '2026-05-28',
  skillId: 'cj.io.println.print-value',
  conceptIds: ['cj.io.println'],
  prompt: 'Print hello.',
  starterCode: 'main() {\n    println("Hello")\n}',
  expectedOutput: 'Hello',
  matchMode: 'exact',
  status: 'active',
  intent: 'mainline',
  personalizationInputs: { summary: 'test' },
  createdAt: 1,
}

function makeBridge(): AIClassroomBridgeValue {
  return {
    editor: {
      getEditor: () => ({ getModel: () => ({ setValue: vi.fn() }) }),
      setEditor: vi.fn(),
    },
  } as unknown as AIClassroomBridgeValue
}

function renderWithResult(lastRun: RunResult | null) {
  return render(
    <Wrapper>
      <ExercisePracticeCard
        exercise={EXERCISE_BASE}
        isActive
        lang="zh"
        dispatch={vi.fn()}
        bridge={makeBridge()}
        lastRun={lastRun}
      />
    </Wrapper>,
  )
}

function renderWithResultEn(lastRun: RunResult | null, exercise: ExerciseInstance = EXERCISE_BASE) {
  return render(
    <EnWrapper>
      <ExercisePracticeCard
        exercise={exercise}
        isActive
        lang="en"
        dispatch={vi.fn()}
        bridge={makeBridge()}
        lastRun={lastRun}
      />
    </EnWrapper>,
  )
}

describe('exercise practice card', () => {
  afterEach(() => {
    cleanup()
    fakeModels.clear()
    shouldMountEditor = true
    requestRemoteActionMock.mockReset()
    useCodeSuggestionStore.setState({
      suggestion: null,
      appliedAssistanceByExerciseId: {},
    })
  })

  it('confirms before resetting this card editor back to the exercise starter code', async () => {
    useCodeSuggestionStore.getState().markSuggestionApplied(EXERCISE_BASE.id, 2)
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeTruthy()

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const reset = screen.getByRole('button', { name: '重置代码' })
    expect(describedByText(reset)).toBe('会先显示确认，不会立即改动当前代码。确认后会恢复到练习起始代码，并清除本次已应用的 AI 建议标记。')
    expect(reset.getAttribute('title')).toBe('会先显示确认，不会立即改动当前代码。确认后会恢复到练习起始代码，并清除本次已应用的 AI 建议标记。')
    expect(reset.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    const dispatchEvent = vi.spyOn(document, 'dispatchEvent')
    fireEvent.click(reset)
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT,
    }))
    dispatchEvent.mockRestore()

    const model = fakeModels.get('exercise:1')!
    expect(model.setValue).not.toHaveBeenCalled()
    const confirmation = screen.getByRole('group', { name: '确认重置代码？' })
    expect(confirmation).toBe(screen.getByTestId('exercise-reset-confirmation'))
    expect(describedByText(confirmation)).toBe('这会恢复到练习起始代码，并清除本次已应用的 AI 建议标记；不会自动提交或改变已记录进度。')
    const keepCode = screen.getByRole('button', { name: '保留当前代码' })
    expect(describedByText(keepCode)).toBe('这会恢复到练习起始代码，并清除本次已应用的 AI 建议标记；不会自动提交或改变已记录进度。')
    await waitFor(() => expect(document.activeElement).toBe(keepCode))

    fireEvent.click(keepCode)

    expect(screen.queryByTestId('exercise-reset-confirmation')).toBeNull()
    expect(model.setValue).not.toHaveBeenCalled()
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeTruthy()
    expect(document.activeElement).toBe(reset)

    fireEvent.click(reset)
    const confirmReset = screen.getByRole('button', { name: '确认重置' })
    expect(describedByText(confirmReset)).toBe('这会恢复到练习起始代码，并清除本次已应用的 AI 建议标记；不会自动提交或改变已记录进度。')
    fireEvent.click(confirmReset)

    expect(model.setValue).toHaveBeenCalledWith('main() {\n    println("Hello")\n}')
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeUndefined()
    expect(screen.queryByTestId('exercise-reset-confirmation')).toBeNull()
    expect(document.activeElement).toBe(reset)
  })

  it('uses review-check copy for resetting code', () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const reset = screen.getByRole('button', { name: '重置代码' })
    expect(describedByText(reset)).toBe('会先显示确认，不会立即改动当前代码。确认后会恢复到复习检查起始代码，并清除本次已应用的 AI 建议标记。')
    expect(reset.getAttribute('title')).toBe('会先显示确认，不会立即改动当前代码。确认后会恢复到复习检查起始代码，并清除本次已应用的 AI 建议标记。')
    fireEvent.click(reset)
    const confirmation = screen.getByRole('group', { name: '确认重置复习检查代码？' })
    expect(describedByText(confirmation)).toBe('这会恢复到复习检查起始代码，并清除本次已应用的 AI 建议标记；不会自动提交或改变已记录进度。')
  })

  it('keeps historical exercise code read-only by disabling reset', async () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has('exercise:1')).toBe(true))
    const reset = screen.getByRole('button', { name: '重置代码' })

    expect(reset).toHaveProperty('disabled', true)
    expect(describedByText(reset)).toBe('这条练习记录只读，不能重置代码。')
    expect(reset.getAttribute('title')).toBe('这条练习记录只读，不能重置代码。')
    const run = screen.getByRole('button', { name: '运行' })
    expect(run).toHaveProperty('disabled', true)
    expect(describedByText(run)).toBe('这条练习记录只读，不能运行代码。')
    expect(run.getAttribute('title')).toBe('这条练习记录只读，不能运行代码。')
    const submit = screen.getByRole('button', { name: '提交' })
    expect(submit).toHaveProperty('disabled', true)
    expect(describedByText(submit)).toBe('这条练习记录只读，不能再次提交。')
    expect(submit.getAttribute('title')).toBe('这条练习记录只读，不能再次提交。')
    const skip = screen.getByRole('button', { name: '跳过并记录' })
    expect(skip).toHaveProperty('disabled', true)
    expect(describedByText(skip)).toBe('这条练习记录只读，不能跳过。')
    expect(skip.getAttribute('title')).toBe('这条练习记录只读，不能跳过。')
    fireEvent.click(reset)
    expect(fakeModels.get('exercise:1')?.setValue).not.toHaveBeenCalled()
  })

  it('uses a stacked mobile action layout without losing desktop alignment', () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const actionBar = screen.getByTestId('exercise-action-bar')
    expect(actionBar.className).toContain('flex-col')
    expect(actionBar.className).toContain('sm:flex-row')
    expect(screen.getByTestId('exercise-practice-card').hasAttribute('data-classroom-transient-panel-close-target')).toBe(true)
    expect(screen.getByTestId('exercise-code-title').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    const headerSkip = screen.getByTestId('exercise-skip-and-read')
    expect(headerSkip.className).toContain('hidden')
    expect(headerSkip.className).toContain('sm:inline-flex')
    expect(headerSkip.getAttribute('title')).toBe('会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并让 AI 准备更合适的下一步。')

    const skip = screen.getByRole('button', { name: '跳过并记录' })
    expect(skip.className).toContain('col-span-2')
    expect(skip.className).toContain('justify-center')
    expect(describedByText(skip)).toBe('会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并让 AI 准备更合适的下一步。')
    expect(skip.getAttribute('title')).toBe('会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并让 AI 准备更合适的下一步。')
    expect(skip.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    const run = screen.getByRole('button', { name: '运行' })
    expect(describedByText(run)).toBe('运行只会执行当前练习代码并显示结果，不会记录练习进度。')
    expect(run.getAttribute('title')).toBe('运行只会执行当前练习代码并显示结果，不会记录练习进度。')
    expect(run.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    const submit = screen.getByRole('button', { name: '提交' })
    expect(describedByText(submit)).toBe('提交会运行当前代码，并把结果记录为这道练习的学习证据。')
    expect(submit.getAttribute('title')).toBe('提交会运行当前代码，并把结果记录为这道练习的学习证据。')
    expect(submit.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByTestId('exercise-code-panel').querySelector('.h-\\[320px\\]')).not.toBeNull()
  })

  it('exposes output tabs as linked panels and supports keyboard switching', () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const caseTab = screen.getByRole('tab', { name: '测试用例' })
    const resultTab = screen.getByRole('tab', { name: '测试结果' })
    const casePanelId = caseTab.getAttribute('aria-controls')!
    const resultPanelId = resultTab.getAttribute('aria-controls')!
    const casePanel = document.getElementById(casePanelId)!
    const resultPanel = document.getElementById(resultPanelId)!
    let panel = screen.getByRole('tabpanel')

    expect(casePanel).toBeTruthy()
    expect(resultPanel).toBeTruthy()
    expect(casePanel.hasAttribute('hidden')).toBe(false)
    expect(resultPanel.hasAttribute('hidden')).toBe(true)
    expect(caseTab.getAttribute('aria-selected')).toBe('true')
    expect(casePanelId).toBe(panel.id)
    expect(caseTab.getAttribute('tabindex')).toBe('0')
    expect(caseTab.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(describedByText(caseTab)).toBe('查看测试用例，不会运行、提交或改动代码。')
    expect(caseTab.getAttribute('title')).toBe('查看测试用例，不会运行、提交或改动代码。')
    expect(describedByText(resultTab)).toBe('查看最近一次运行或提交结果，不会运行、提交或改动代码。')
    expect(resultTab.getAttribute('title')).toBe('查看最近一次运行或提交结果，不会运行、提交或改动代码。')
    expect(panel.getAttribute('aria-labelledby')).toBe(caseTab.id)
    expect(panel.textContent).toContain('预期输出')

    fireEvent.keyDown(caseTab, { key: 'ArrowRight' })

    panel = screen.getByRole('tabpanel')
    expect(resultTab.getAttribute('aria-selected')).toBe('true')
    expect(resultPanelId).toBe(panel.id)
    expect(resultTab.getAttribute('tabindex')).toBe('0')
    expect(caseTab.getAttribute('tabindex')).toBe('-1')
    expect(casePanel.hasAttribute('hidden')).toBe(true)
    expect(resultPanel.hasAttribute('hidden')).toBe(false)
    expect(panel.getAttribute('aria-labelledby')).toBe(resultTab.id)
    expect(document.activeElement).toBe(resultTab)
    screen.getByText('运行或提交后查看测试结果。')

    fireEvent.keyDown(resultTab, { key: 'Home' })

    panel = screen.getByRole('tabpanel')
    expect(caseTab.getAttribute('aria-selected')).toBe('true')
    expect(casePanelId).toBe(panel.id)
    expect(casePanel.hasAttribute('hidden')).toBe(false)
    expect(resultPanel.hasAttribute('hidden')).toBe(true)
    expect(panel.getAttribute('aria-labelledby')).toBe(caseTab.id)
    expect(document.activeElement).toBe(caseTab)
  })

  it('keeps long exercise copy and outputs constrained inside mobile-width panels', () => {
    const longToken = `Cangjie_${'x'.repeat(96)}`

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{
            ...EXERCISE_BASE,
            prompt: `Print ${longToken}.`,
            expectedOutput: longToken,
          }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={{ ok: true, stdout: longToken, stderr: '', exitCode: 0, attemptMode: 'run' }}
        />
      </Wrapper>,
    )

    expect(screen.getByText(`Print ${longToken}.`).className).toContain('break-words')
    const expectedOutput = screen.getByText(longToken).closest('pre')
    expect(expectedOutput?.className).toContain('max-w-full')
    expect(expectedOutput?.className).toContain('overflow-x-auto')
    expect(expectedOutput?.className).toContain('break-words')

    fireEvent.click(screen.getByRole('tab', { name: '测试结果' }))

    const resultOutput = screen.getByTestId('exercise-test-result-output')
    expect(resultOutput.textContent).toContain(longToken)
    expect(resultOutput.className).toContain('max-w-full')
    expect(resultOutput.className).toContain('overflow-x-auto')
    expect(resultOutput.className).toContain('break-words')
  })

  it('explains aided submit evidence after an AI suggestion was applied', () => {
    useCodeSuggestionStore.getState().markSuggestionApplied(EXERCISE_BASE.id, 2)

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    expect(describedByText(screen.getByRole('button', { name: '提交' }))).toBe('提交会运行当前代码，并把结果记录为 AI 帮助后的较弱练习证据。')
  })

  it('stacks suggestion actions on mobile and keeps desktop action alignment', () => {
    const longToken = `Cangjie_${'x'.repeat(96)}`
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: `main() {\n    println("${longToken}")\n}`,
      explanation: `Use the exact expected output ${longToken}.`,
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const banner = screen.getByTestId('exercise-suggestion-banner')
    expect(banner.getAttribute('aria-labelledby')).toBeTruthy()
    expect(describedByText(banner)).toBe('应用后会替换当前练习编辑器代码；不会自动运行或提交。之后提交会记录为 AI 帮助后的较弱证据。')
    const actionFooter = banner.querySelector('[data-testid="exercise-suggestion-apply"]')?.parentElement
    expect(actionFooter?.className).toContain('flex-col')
    expect(actionFooter?.className).toContain('sm:flex-row')
    expect(banner.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    const explanation = screen.getByText(`Use the exact expected output ${longToken}.`)
    expect(explanation.className).toContain('whitespace-pre-wrap')
    expect(explanation.className).toContain('break-words')
    const close = screen.getByRole('button', { name: '关闭建议' })
    expect(describedByText(close)).toBe('只会丢弃这条 AI 建议，不会改变当前代码或课堂进度。')
    expect(close.getAttribute('title')).toBe('只会丢弃这条 AI 建议，不会改变当前代码或课堂进度。')
    expect(close.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByText('查看建议代码'))
    const suggestedCode = screen.getByText((content, element) => element?.tagName === 'PRE' && content.includes(longToken))
    expect(suggestedCode.className).toContain('max-w-full')
    expect(suggestedCode.className).toContain('overflow-auto')
    const dismiss = screen.getByRole('button', { name: '忽略' })
    expect(dismiss.className).toContain('w-full')
    expect(describedByText(dismiss)).toBe('只会丢弃这条 AI 建议，不会改变当前代码或课堂进度。')
    expect(dismiss.getAttribute('title')).toBe('只会丢弃这条 AI 建议，不会改变当前代码或课堂进度。')
    const apply = screen.getByTestId('exercise-suggestion-apply')
    expect(apply.className).toContain('w-full')
    expect(apply.className).toContain('sm:w-auto')
    expect(describedByText(apply)).toBe('应用后会替换当前练习编辑器代码；不会自动运行或提交。之后提交会记录为 AI 帮助后的较弱证据。')
    expect(apply.getAttribute('title')).toBe('应用后会替换当前练习编辑器代码；不会自动运行或提交。之后提交会记录为 AI 帮助后的较弱证据。')
    expect(apply.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('returns focus to the exercise editor after dismissing an AI suggestion', async () => {
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: 'main() {\n    println("Hello")\n}',
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    const dismiss = screen.getByRole('button', { name: '忽略' })
    dismiss.focus()
    fireEvent.click(dismiss)

    expect(screen.queryByTestId('exercise-suggestion-banner')).toBeNull()
    await waitFor(() => expect(fakeModels.get(EXERCISE_BASE.id)?.focus).toHaveBeenCalledTimes(1))
  })

  it('returns focus to the code panel when dismissing a suggestion before the editor is ready', async () => {
    shouldMountEditor = false
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: 'main() {\n    println("Hello")\n}',
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const close = screen.getByRole('button', { name: '关闭建议' })
    close.focus()
    fireEvent.click(close)

    expect(screen.queryByTestId('exercise-suggestion-banner')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('exercise-code-panel')))
  })

  it('keeps applying an AI suggestion disabled until the editor is ready', () => {
    shouldMountEditor = false
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: 'main() {\n    println("Hello")\n}',
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const apply = screen.getByTestId('exercise-suggestion-apply') as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    expect(describedByText(apply)).toBe('练习编辑器仍在加载，加载完成后才能应用建议；不会自动运行或提交。')
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeUndefined()
  })

  it('keeps code execution and reset disabled until the editor is ready', () => {
    shouldMountEditor = false
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: '',
      bin_code: 0,
      bin_output: 'Hello',
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const reset = screen.getByRole('button', { name: '重置代码' }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    expect(describedByText(reset)).toBe('练习编辑器仍在加载，加载完成后才能重置代码。')

    const run = screen.getByRole('button', { name: '运行' }) as HTMLButtonElement
    expect(run.disabled).toBe(true)
    expect(describedByText(run)).toBe('练习编辑器仍在加载，加载完成后才能运行代码。')

    const submit = screen.getByRole('button', { name: '提交' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    expect(describedByText(submit)).toBe('练习编辑器仍在加载，加载完成后才能提交。')

    const skip = screen.getByRole('button', { name: '跳过并记录' }) as HTMLButtonElement
    expect(skip.disabled).toBe(false)

    fireEvent.click(run)
    fireEvent.click(submit)
    fireEvent.click(reset)

    expect(requestRemoteActionMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('exercise-reset-confirmation')).toBeNull()
  })

  it('keeps applying an AI suggestion disabled while code is running', async () => {
    let resolveRun: ((value: {
      compiler_code: number
      compiler_output: string
      bin_code: number
      bin_output: string
    }) => void) | undefined
    requestRemoteActionMock.mockReturnValue(new Promise((resolve) => {
      resolveRun = resolve
    }))
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: 'main() {\n    println("Hello")\n}',
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    await waitFor(() => expect(screen.getByTestId('exercise-action-bar').getAttribute('aria-busy')).toBe('true'))

    const running = screen.getByRole('button', { name: '运行中' })
    expect(running).toHaveProperty('disabled', true)
    expect(describedByText(running)).toBe('练习正在运行，完成后才能再次运行。')
    const submit = screen.getByRole('button', { name: '提交' })
    expect(submit).toHaveProperty('disabled', true)
    expect(describedByText(submit)).toBe('练习正在运行，完成后才能提交。')
    const skip = screen.getByRole('button', { name: '跳过并记录' })
    expect(skip).toHaveProperty('disabled', true)
    expect(describedByText(skip)).toBe('练习正在运行或提交，完成后才能跳过。')

    const apply = screen.getByTestId('exercise-suggestion-apply') as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    expect(describedByText(apply)).toBe('练习正在运行或提交，完成后才能应用建议，避免代码和结果不一致。')

    await act(async () => {
      resolveRun?.({
        compiler_code: 0,
        compiler_output: '',
        bin_code: 0,
        bin_output: 'Hello',
      })
    })
    await waitFor(() => expect(apply.disabled).toBe(false))
    expect(describedByText(apply)).toBe('应用后会替换当前练习编辑器代码；不会自动运行或提交。之后提交会记录为 AI 帮助后的较弱证据。')
  })

  it('keeps reset disabled while code is running so results stay tied to the submitted code', async () => {
    let resolveRun: ((value: {
      compiler_code: number
      compiler_output: string
      bin_code: number
      bin_output: string
    }) => void) | undefined
    requestRemoteActionMock.mockReturnValue(new Promise((resolve) => {
      resolveRun = resolve
    }))

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    await waitFor(() => expect(screen.getByTestId('exercise-action-bar').getAttribute('aria-busy')).toBe('true'))

    const reset = screen.getByRole('button', { name: '重置代码' }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    expect(describedByText(reset)).toBe('练习正在运行或提交，完成后才能重置代码，避免代码和结果不一致。')

    fireEvent.click(reset)

    expect(screen.queryByTestId('exercise-reset-confirmation')).toBeNull()
    expect(fakeModels.get(EXERCISE_BASE.id)?.setValue).not.toHaveBeenCalled()

    await act(async () => {
      resolveRun?.({
        compiler_code: 0,
        compiler_output: '',
        bin_code: 0,
        bin_output: 'Hello',
      })
    })
  })

  it('lets learners undo an applied AI suggestion and removes that aided marker', async () => {
    const suggestedCode = 'main() {\n    println("Hello")\n}'
    const learnerCode = 'main() {\n    println("Hi")\n}'
    getFakeModel(EXERCISE_BASE.id).current = learnerCode
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: suggestedCode,
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    fireEvent.click(screen.getByTestId('exercise-suggestion-apply'))

    const model = fakeModels.get(EXERCISE_BASE.id)!
    expect(model.setValue).toHaveBeenCalledWith(suggestedCode)
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeTruthy()
    const applied = screen.getByTestId('exercise-suggestion-applied')
    expect(applied.getAttribute('role')).toBe('status')
    screen.getByText('已应用 AI 建议')
    expect(applied.textContent).toContain('撤回练习代码到应用建议前的版本；后续提交不会继续带这次 AI 建议标记，已记录的提交不会改变。')
    const undo = screen.getByRole('button', { name: '撤回应用' })
    expect(describedByText(undo)).toBe('撤回练习代码到应用建议前的版本；后续提交不会继续带这次 AI 建议标记，已记录的提交不会改变。')

    fireEvent.click(undo)

    expect(model.setValue).toHaveBeenLastCalledWith(learnerCode)
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeUndefined()
    expect(screen.queryByTestId('exercise-suggestion-applied')).toBeNull()
  })

  it('keeps undoing an applied AI suggestion disabled while code is running', async () => {
    let resolveRun: ((value: {
      compiler_code: number
      compiler_output: string
      bin_code: number
      bin_output: string
    }) => void) | undefined
    requestRemoteActionMock.mockReturnValue(new Promise((resolve) => {
      resolveRun = resolve
    }))
    const suggestedCode = 'main() {\n    println("Hello")\n}'
    const learnerCode = 'main() {\n    println("Hi")\n}'
    getFakeModel(EXERCISE_BASE.id).current = learnerCode
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: suggestedCode,
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    fireEvent.click(screen.getByTestId('exercise-suggestion-apply'))
    const model = fakeModels.get(EXERCISE_BASE.id)!
    model.setValue.mockClear()

    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    await waitFor(() => expect(screen.getByTestId('exercise-action-bar').getAttribute('aria-busy')).toBe('true'))

    const undo = screen.getByRole('button', { name: '撤回应用' }) as HTMLButtonElement
    expect(undo.disabled).toBe(true)
    expect(describedByText(undo)).toBe('练习正在运行或提交，完成后才能撤回 AI 建议，避免代码和结果不一致。')

    fireEvent.click(undo)

    expect(model.setValue).not.toHaveBeenCalled()
    expect(model.current).toBe(suggestedCode)
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeTruthy()

    await act(async () => {
      resolveRun?.({
        compiler_code: 0,
        compiler_output: '',
        bin_code: 0,
        bin_output: 'Hello',
      })
    })
  })

  it('pauses suggestion undo instead of overwriting edits made after applying it', async () => {
    const suggestedCode = 'main() {\n    println("Hello")\n}'
    const learnerCode = 'main() {\n    println("Hi")\n}'
    const manualEdit = 'main() {\n    println("Hello again")\n}'
    getFakeModel(EXERCISE_BASE.id).current = learnerCode
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: suggestedCode,
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    fireEvent.click(screen.getByTestId('exercise-suggestion-apply'))

    const model = fakeModels.get(EXERCISE_BASE.id)!
    expect(model.setValue).toHaveBeenCalledWith(suggestedCode)
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeTruthy()

    model.setValue.mockClear()
    model.current = manualEdit

    fireEvent.click(screen.getByRole('button', { name: '撤回应用' }))

    expect(model.setValue).not.toHaveBeenCalled()
    expect(model.current).toBe(manualEdit)
    expect(useCodeSuggestionStore.getState().getAttemptEvidence(EXERCISE_BASE.id)).toBeTruthy()
    const applied = screen.getByTestId('exercise-suggestion-applied')
    await waitFor(() => expect(applied.textContent).toContain('为避免覆盖你的编辑，撤回已暂停'))
    expect(describedByText(screen.getByRole('button', { name: '撤回应用' }))).toBe('练习代码已在应用建议后继续修改。为避免覆盖你的编辑，撤回已暂停；当前代码会保留，后续提交仍会记录为 AI 帮助后的证据。')
  })

  it('uses review-check copy for applying an AI code suggestion', () => {
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:review',
      code: 'main() {\n    println("Hello")\n}',
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const apply = screen.getByTestId('exercise-suggestion-apply')
    expect(describedByText(apply)).toBe('应用后会替换当前复习检查编辑器代码；不会自动运行或提交。之后提交会记录为 AI 帮助后的较弱证据。')
  })

  it('confirms before recording a skipped exercise', () => {
    const dispatch = vi.fn()
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const headerSkip = screen.getByTestId('exercise-skip-and-read')
    expect(describedByText(headerSkip)).toBe('会先显示确认，不会立即记录。确认后课堂会记录为已跳过，并让 AI 准备更合适的下一步。')
    const dispatchEvent = vi.spyOn(document, 'dispatchEvent')
    fireEvent.click(headerSkip)
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT,
    }))
    dispatchEvent.mockClear()

    expect(dispatch).not.toHaveBeenCalled()
    const confirmation = screen.getByRole('group', { name: '确认跳过这道练习？' })
    expect(confirmation).toBe(screen.getByTestId('exercise-skip-confirmation'))
    expect(describedByText(confirmation)).toBe('课堂会记录为已跳过，并让 AI 准备更合适的下一步。')
    screen.getByText('确认跳过这道练习？')
    screen.getByText('课堂会记录为已跳过，并让 AI 准备更合适的下一步。')

    const cancel = screen.getByRole('button', { name: '继续练习' })
    expect(document.activeElement).toBe(cancel)
    expect(describedByText(cancel)).toBe('课堂会记录为已跳过，并让 AI 准备更合适的下一步。')
    fireEvent.click(cancel)

    expect(screen.queryByTestId('exercise-skip-confirmation')).toBeNull()
    expect(document.activeElement).toBe(headerSkip)
    expect(dispatch).not.toHaveBeenCalled()

    const actionSkip = screen.getByRole('button', { name: '跳过并记录' })
    fireEvent.click(actionSkip)
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: CLOSE_CLASSROOM_TRANSIENT_PANELS_EVENT,
    }))
    const escapeConfirmation = screen.getByRole('group', { name: '确认跳过这道练习？' })
    const escapeCancel = screen.getByRole('button', { name: '继续练习' })
    expect(document.activeElement).toBe(escapeCancel)
    fireEvent.keyDown(escapeConfirmation, { key: 'Escape' })
    expect(screen.queryByTestId('exercise-skip-confirmation')).toBeNull()
    expect(document.activeElement).toBe(actionSkip)
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.click(actionSkip)
    dispatchEvent.mockRestore()
    const confirm = screen.getByRole('button', { name: '确认跳过' })
    expect(describedByText(confirm)).toBe('课堂会记录为已跳过，并让 AI 准备更合适的下一步。')
    fireEvent.click(confirm)

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'EXERCISE_SKIP' }))
  })

  it('labels review checks separately from mainline exercises', () => {
    const dispatch = vi.fn()
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' }}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    screen.getByText('复习检查')
    screen.getByText('复习检查中')
    screen.getByRole('tablist', { name: '复习检查输出' })
    expect(describedByText(screen.getByRole('button', { name: '运行' }))).toBe('运行只会执行当前复习检查代码并显示结果，不会记录复习检查进度。')
    expect(describedByText(screen.getByRole('button', { name: '提交' }))).toBe('提交会运行当前代码，并把结果记录为这次复习检查证据。')

    fireEvent.click(screen.getByTestId('exercise-skip-and-read'))

    const confirmation = screen.getByRole('group', { name: '确认跳过这次复习检查？' })
    expect(describedByText(confirmation)).toBe('课堂会记录为已跳过，并保留当前复习进度。')
    screen.getByText('确认跳过这次复习检查？')
    screen.getByText('课堂会记录为已跳过，并保留当前复习进度。')
    expect(describedByText(screen.getByRole('button', { name: '继续复习检查' }))).toBe('课堂会记录为已跳过，并保留当前复习进度。')
    expect(describedByText(screen.getByRole('button', { name: '确认跳过' }))).toBe('课堂会记录为已跳过，并保留当前复习进度。')
    expect(screen.queryByRole('button', { name: '继续练习' })).toBeNull()
  })

  it('explains aided review-check submit evidence after an AI suggestion was applied', () => {
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:review', 2)

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    expect(describedByText(screen.getByRole('button', { name: '提交' }))).toBe('提交会运行当前代码，并把结果记录为 AI 帮助后的较弱复习检查证据。')
  })

  it('uses compiled English copy for the run versus submit progress boundary', () => {
    renderWithResultEn({
      ok: true,
      stdout: 'Wrong',
      stderr: '',
      exitCode: 0,
      attemptMode: 'run',
    })

    const run = screen.getByRole('button', { name: 'Run' })
    expect(describedByText(run)).toBe('Run only executes the current exercise code and shows the result. It will not record exercise progress.')
    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(describedByText(submit)).toBe('Submit will run the current code and record the result as learning evidence for this exercise.')

    fireEvent.click(screen.getByRole('tab', { name: 'Test result' }))

    screen.getByText('Run result: incorrect')
    expectPoliteStatus(
      screen.getByTestId('exercise-run-failure-hint'),
      'The run result did not pass. This will not record exercise progress. You can inspect the result and compiler info, then edit and run or submit again.',
    )
    expect(screen.queryByText('运行结果未通过，这次不会记录为练习进度。可以先查看结果和编译信息，修改后再运行或提交。')).toBeNull()
  })

  it('uses compiled English copy for recorded failed submissions', () => {
    renderWithResultEn({
      ok: true,
      stdout: 'Wrong',
      stderr: '',
      exitCode: 0,
      attemptMode: 'submit',
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Test result' }))

    screen.getByText('Submit result: incorrect')
    expectPoliteStatus(
      screen.getByTestId('exercise-submit-failure-hint'),
      'This submission did not pass and was recorded as exercise evidence. AI will prepare a targeted hint; you can also edit the code and submit again.',
    )
    expect(screen.queryByText('这次提交未通过，已记录为练习证据。AI 会准备针对性提示；你也可以先修改代码后重新提交。')).toBeNull()
  })

  it('uses compiled English copy for runner outage recovery', async () => {
    requestRemoteActionMock
      .mockRejectedValueOnce(new Error('Remote action failed: runner unavailable'))
      .mockResolvedValueOnce({
        compiler_code: 0,
        compiler_output: '',
        bin_code: 0,
        bin_output: 'Hello',
      })

    render(
      <EnWrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="en"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </EnWrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await screen.findByText('Submit incomplete')
    const recoveryStatus = screen.getByText('The runner is temporarily unavailable. This will not be recorded as learning progress. Retry submitting later.')
    expectPoliteStatus(recoveryStatus)
    expect(recoveryStatus.className).toContain('min-w-0')
    expect(recoveryStatus.className).toContain('break-words')
    const retry = screen.getByRole('button', { name: 'Retry submit' })
    expect(describedByText(retry)).toBe('Retry submit will rerun the current exercise code. New learning evidence is recorded only after a successful submit.')
    expect(retry.getAttribute('title')).toBe('Retry submit will rerun the current exercise code. New learning evidence is recorded only after a successful submit.')

    fireEvent.click(retry)

    await screen.findByText('Submit result: correct')
    expect(requestRemoteActionMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('exercise-runner-unavailable-hint')).toBeNull()
  })

  it('uses compiled English copy for review-check exercise controls', () => {
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:review', 2)

    renderWithResultEn(null, { ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' })

    screen.getByText('Review check')
    screen.getByText('Review check in progress')
    screen.getByRole('tablist', { name: 'Review check output' })
    expect(describedByText(screen.getByRole('button', { name: 'Run' }))).toBe(
      'Run only executes the current review-check code and shows the result. It will not record review-check progress.',
    )
    expect(describedByText(screen.getByRole('button', { name: 'Submit' }))).toBe(
      'Submit will run the current code and record the result as weaker AI-assisted review-check evidence.',
    )

    fireEvent.click(screen.getByTestId('exercise-skip-and-read'))

    screen.getByRole('group', { name: 'Skip this review check?' })
    screen.getByText('The classroom will record it as skipped and keep the current review progress.')
    expect(describedByText(screen.getByRole('button', { name: 'Continue review check' }))).toBe(
      'The classroom will record it as skipped and keep the current review progress.',
    )
    expect(describedByText(screen.getByRole('button', { name: 'Confirm skip' }))).toBe(
      'The classroom will record it as skipped and keep the current review progress.',
    )
  })

  it('offers a return-to-review action after a completed review check is recorded', () => {
    const onReturnToReview = vi.fn()
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check', status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
          onReturnToReview={onReturnToReview}
        />
      </Wrapper>,
    )

    const returnPanel = screen.getByTestId('exercise-review-return')
    screen.getByText('复习检查已记录')
    screen.getByText('回到复习页查看这个概念的最新进度和下一步建议。')
    const returnButton = screen.getByRole('button', { name: '查看复习进度' })
    expect(returnButton.className).toContain('w-full')
    expect(returnButton.className).toContain('sm:w-auto')
    expect(returnButton.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(returnPanel.className).toContain('bg-classroom-success-bg')

    fireEvent.click(returnButton)

    expect(onReturnToReview).toHaveBeenCalledWith('cj.io.println')
  })

  it('uses skipped review-check copy for the return-to-review action', () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check', status: 'skip' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
          onReturnToReview={vi.fn()}
        />
      </Wrapper>,
    )

    expect(screen.getByTestId('exercise-review-return').textContent).toContain('已跳过复习检查')
    screen.getByRole('button', { name: '查看复习进度' })
  })

  it('does not offer review return on completed mainline exercises', () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
          onReturnToReview={vi.fn()}
        />
      </Wrapper>,
    )

    expect(screen.queryByTestId('exercise-review-return')).toBeNull()
    expect(screen.queryByRole('button', { name: '查看复习进度' })).toBeNull()
  })

  it('marks the active exercise anchor and explains review-return focus', async () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
          focusRequestKey={1}
        />
      </Wrapper>,
    )

    const card = screen.getByTestId('exercise-practice-card')
    expect(card.getAttribute('data-exercise-id')).toBe('exercise:1')
    expect(card.getAttribute('data-active-exercise')).toBe('')
    expect(card.getAttribute('tabindex')).toBe('-1')
    const notice = await screen.findByTestId('exercise-focus-notice')
    expect(card.getAttribute('aria-describedby')).toBe(notice.id)
    screen.getByText('已回到当前练习。完成、跳过或提交后再继续复习。')
    expect(card.className).toContain('ring-2')
  })

  it('uses review-check copy for focused review exercises', async () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
          focusRequestKey={2}
        />
      </Wrapper>,
    )

    await screen.findByTestId('exercise-focus-notice')
    screen.getByText('已回到当前复习检查。完成、跳过或提交后再继续复习。')
  })

  it('does not show focus recovery copy for inactive historical exercises', () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
          focusRequestKey={3}
        />
      </Wrapper>,
    )

    const card = screen.getByTestId('exercise-practice-card')
    expect(card.getAttribute('data-exercise-id')).toBe('exercise:1')
    expect(card.getAttribute('data-active-exercise')).toBeNull()
    expect(card.getAttribute('tabindex')).toBe('-1')
    expect(card.getAttribute('aria-describedby')).toBeNull()
    expect(screen.queryByTestId('exercise-focus-notice')).toBeNull()
  })

  it('registers the active exercise editor in the shared bridge', async () => {
    const setEditor = vi.fn()
    const bridge = {
      editor: { setEditor, getEditor: vi.fn(() => undefined) },
    } as unknown as AIClassroomBridgeValue

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={bridge}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(setEditor).toHaveBeenCalled())
  })

  it('does not register an inactive exercise editor in the shared bridge', async () => {
    const setEditor = vi.fn()
    const bridge = {
      editor: { setEditor, getEditor: vi.fn(() => undefined) },
    } as unknown as AIClassroomBridgeValue

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={bridge}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has('exercise:1')).toBe(true))
    expect(setEditor).not.toHaveBeenCalled()
  })

  it('keeps tool output collapsed by default on a successful run', async () => {
    renderWithResult({
      ok: true,
      stdout: 'Hello',
      stderr: 'Cangjie Compiler: 1.1.0',
      exitCode: 0,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    const trigger = await screen.findByTestId('exercise-tool-output-trigger')
    const body = screen.getByTestId('exercise-tool-output-body')
    expect(trigger.getAttribute('data-state')).toBe('closed')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('title')).toBe('展开编译信息；不会重新运行代码、改变测试结果或学习记录。')
    expect(trigger.getAttribute('aria-controls')).toBe(body.id)
    expect(trigger.querySelectorAll('svg')).toHaveLength(2)
    trigger.querySelectorAll('svg').forEach((icon) => {
      expect(icon.getAttribute('aria-hidden')).toBe('true')
    })
    expect(body.getAttribute('role')).toBe('region')
    expect(body.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(body.hasAttribute('hidden')).toBe(true)
  })

  it('explains that a correct run is not recorded until submit', async () => {
    renderWithResult({
      ok: true,
      stdout: 'Hello',
      stderr: '',
      exitCode: 0,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    screen.getByText('运行结果：正确')
    expectPoliteStatus(screen.getByText('运行结果正确。点击提交后，课堂才会记录这次练习进度。'))
    expect(screen.getByTestId('exercise-run-correct-submit-hint').getAttribute('role')).toBeNull()
    expect(screen.queryByRole('button', { name: '提交并记录' })).toBeNull()
  })

  it('submits directly from a correct run hint', async () => {
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: '',
      bin_code: 0,
      bin_output: 'Hello',
    })
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    await act(async () => {
      setFakeModelValue(fakeModels.get(EXERCISE_BASE.id)!, EXERCISE_BASE.starterCode)
    })
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))
    await screen.findByText('运行结果：正确')
    expectPoliteStatus(screen.getByText('运行结果正确。点击提交后，课堂才会记录这次练习进度。'))
    expect(screen.getByTestId('exercise-run-correct-submit-hint').getAttribute('role')).toBeNull()
    const submitInline = screen.getByRole('button', { name: '提交并记录' })
    expect(submitInline.className).toContain('w-full')
    expect(submitInline.className).toContain('sm:w-auto')
    expect(describedByText(submitInline)).toBe('运行结果正确。点击提交后，课堂才会记录这次练习进度。')
    expect(submitInline.getAttribute('title')).toBe('运行结果正确。点击提交后，课堂才会记录这次练习进度。')
    expect(submitInline.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '提交并记录' }))

    await screen.findByText('提交结果：正确')
    expect(requestRemoteActionMock).toHaveBeenCalledTimes(2)
    expect(requestRemoteActionMock).toHaveBeenNthCalledWith(1, EXERCISE_BASE.starterCode, 'run')
    expect(requestRemoteActionMock).toHaveBeenNthCalledWith(2, EXERCISE_BASE.starterCode, 'run')
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EXERCISE_SUBMIT_FINISHED',
        result: expect.objectContaining({
          ok: true,
          stdout: 'Hello',
        }),
      }))
    })
  })

  it('invalidates the inline submit hint when code changes after a correct run', async () => {
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: '',
      bin_code: 0,
      bin_output: 'Hello',
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    const model = fakeModels.get(EXERCISE_BASE.id)!
    await act(async () => {
      setFakeModelValue(model, EXERCISE_BASE.starterCode)
    })
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    await screen.findByText('运行结果：正确')
    screen.getByRole('button', { name: '提交并记录' })

    await act(async () => {
      setFakeModelValue(model, 'main() {\n    println("Changed")\n}')
    })

    expectPoliteStatus(screen.getByText('代码已修改。请重新运行，确认当前代码仍然正确后再提交。'))
    expect(screen.queryByRole('button', { name: '提交并记录' })).toBeNull()
    expect(screen.getByTestId('exercise-run-correct-submit-hint').className).toContain('border-classroom-warning-border')
  })

  it('marks failed results as stale after the learner changes code', async () => {
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: '',
      bin_code: 0,
      bin_output: 'Wrong',
    })

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    const model = fakeModels.get(EXERCISE_BASE.id)!
    await act(async () => {
      setFakeModelValue(model, EXERCISE_BASE.starterCode)
    })
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    await screen.findByText('运行结果：错误')
    expect(screen.queryByTestId('exercise-result-stale-code-hint')).toBeNull()

    await act(async () => {
      setFakeModelValue(model, 'main() {\n    println("Changed")\n}')
    })

    const staleCodeHint = screen.getByTestId('exercise-result-stale-code-hint')
    expectPoliteStatus(staleCodeHint, '代码已修改。当前结果来自修改前的代码，请重新运行或提交查看最新结果。')
    expect(staleCodeHint.className).toContain('border-classroom-warning-border')
    expectPoliteStatus(screen.getByText('运行结果未通过，这次不会记录为练习进度。可以先查看结果和编译信息，修改后再运行或提交。'))
  })

  it('explains that a failed run is not recorded as progress', async () => {
    renderWithResult({
      ok: true,
      stdout: 'Wrong',
      stderr: '',
      exitCode: 0,
      attemptMode: 'run',
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    screen.getByText('运行结果：错误')
    const failureHint = screen.getByTestId('exercise-run-failure-hint')
    expectPoliteStatus(failureHint, '运行结果未通过，这次不会记录为练习进度。可以先查看结果和编译信息，修改后再运行或提交。')
  })

  it('explains that a failed submit is recorded and will get AI feedback', async () => {
    renderWithResult({
      ok: true,
      stdout: 'Wrong',
      stderr: '',
      exitCode: 0,
      attemptMode: 'submit',
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    screen.getByText('提交结果：错误')
    const failureHint = screen.getByTestId('exercise-submit-failure-hint')
    expectPoliteStatus(failureHint, '这次提交未通过，已记录为练习证据。AI 会准备针对性提示；你也可以先修改代码后重新提交。')
  })

  it('ties stale failed submit feedback to the code that was actually submitted', async () => {
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: '',
      bin_code: 0,
      bin_output: 'Wrong',
    })
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    const model = fakeModels.get(EXERCISE_BASE.id)!
    await act(async () => {
      setFakeModelValue(model, EXERCISE_BASE.starterCode)
    })

    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await screen.findByText('提交结果：错误')
    expectPoliteStatus(screen.getByTestId('exercise-submit-failure-hint'), '这次提交未通过，已记录为练习证据。AI 会准备针对性提示；你也可以先修改代码后重新提交。')
    expect(screen.queryByTestId('exercise-result-stale-code-hint')).toBeNull()

    await act(async () => {
      setFakeModelValue(model, 'main() {\n    println("Changed")\n}')
    })

    expectPoliteStatus(screen.getByTestId('exercise-result-stale-code-hint'), '代码已修改。当前结果来自修改前的代码，请重新运行或提交查看最新结果。')
    expectPoliteStatus(screen.getByTestId('exercise-submit-failure-hint'), '这次提交未通过，已按提交时的代码记录为练习证据。AI 提示会针对那次提交；当前代码已修改，请重新提交以记录新的结果。')
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EXERCISE_SUBMIT_FINISHED',
        attemptedCode: EXERCISE_BASE.starterCode,
      }))
    })
  })

  it('explains that a correct review check run is not recorded until submit', async () => {
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: '',
      bin_code: 0,
      bin_output: 'Hello',
    })
    const reviewExercise = { ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' as const }

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={reviewExercise}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(reviewExercise.id)).toBe(true))
    await act(async () => {
      setFakeModelValue(fakeModels.get(reviewExercise.id)!, reviewExercise.starterCode)
    })
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    await screen.findByText('运行结果：正确')
    const resultStatus = screen.getByTestId('exercise-result-status')
    expect(resultStatus.getAttribute('role')).toBe('status')
    expect(resultStatus.getAttribute('aria-live')).toBe('polite')
    expect(resultStatus.getAttribute('aria-atomic')).toBe('true')
    expect(resultStatus.textContent).toBe('运行结果：正确')
    expectPoliteStatus(screen.getByText('运行结果正确。点击提交后，课堂才会记录这次复习检查结果。'))
    expect(describedByText(screen.getByRole('button', { name: '提交复习检查' }))).toBe('运行结果正确。点击提交后，课堂才会记录这次复习检查结果。')
  })

  it('explains that a failed review check submit is recorded as review evidence', async () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={{
            ok: true,
            stdout: 'Wrong',
            stderr: '',
            exitCode: 0,
            attemptMode: 'submit',
          }}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    screen.getByText('提交结果：错误')
    const failureHint = screen.getByTestId('exercise-submit-failure-hint')
    expectPoliteStatus(failureHint, '这次复习检查未通过，已记录为需要复查的证据。AI 会准备针对性反馈；你也可以先修改代码后重新提交。')
  })

  it('does not show the submit-to-record hint for inactive completed exercises', async () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={{
            ok: true,
            stdout: 'Hello',
            stderr: '',
            exitCode: 0,
          }}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    screen.getByText('运行结果：正确')
    expect(screen.queryByTestId('exercise-run-correct-submit-hint')).toBeNull()
  })

  it('keeps the submit result label when a persisted exercise result came from submit', async () => {
    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={{
            ok: true,
            stdout: 'Hello',
            stderr: '',
            exitCode: 0,
            attemptMode: 'submit',
          }}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    screen.getByText('提交结果：正确')
    const resultStatus = screen.getByTestId('exercise-result-status')
    expect(resultStatus.getAttribute('role')).toBe('status')
    expect(resultStatus.getAttribute('aria-live')).toBe('polite')
    expect(resultStatus.textContent).toBe('提交结果：正确')
    expect(screen.queryByText('运行结果：正确')).toBeNull()
    expect(screen.queryByTestId('exercise-run-correct-submit-hint')).toBeNull()
  })

  it('announces review-check run attempts as a busy state', async () => {
    let resolveRun: ((value: {
      compiler_code: number
      compiler_output: string
      bin_code: number
      bin_output: string
    }) => void) | undefined
    requestRemoteActionMock.mockReturnValue(new Promise((resolve) => {
      resolveRun = resolve
    }))

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, id: 'exercise:review', intent: 'review_check' }}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '运行' }))

    const actionBar = screen.getByTestId('exercise-action-bar')
    await waitFor(() => expect(actionBar.getAttribute('aria-busy')).toBe('true'))
    const busyStatus = screen.getByTestId('exercise-busy-status')
    expect(screen.getByRole('status')).toBe(busyStatus)
    expect(actionBar.getAttribute('aria-describedby')).toBe(busyStatus.id)
    expect(busyStatus.textContent).toBe('正在运行复习检查代码，请稍候。')

    await act(async () => {
      resolveRun?.({
        compiler_code: 0,
        compiler_output: '',
        bin_code: 0,
        bin_output: 'Hello',
      })
    })

    await screen.findByText('运行结果：正确')
    const resultStatus = screen.getByTestId('exercise-result-status')
    expect(resultStatus.getAttribute('role')).toBe('status')
    expect(resultStatus.textContent).toBe('运行结果：正确')
    expect(actionBar.getAttribute('aria-busy')).toBe('false')
    expect(screen.queryByTestId('exercise-busy-status')).toBeNull()
  })

  it('auto-expands tool output when the run failed', async () => {
    renderWithResult({
      ok: false,
      stdout: '',
      stderr: 'error: undefined symbol foo',
      exitCode: 1,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    const trigger = await screen.findByTestId('exercise-tool-output-trigger')
    expect(trigger.getAttribute('data-state')).toBe('open')
    expect(trigger.getAttribute('title')).toBe('隐藏编译信息；不会改变代码、测试结果或学习记录。')
    const body = screen.getByTestId('exercise-tool-output-body')
    expect(trigger.getAttribute('aria-controls')).toBe(body.id)
    expect(body.hasAttribute('hidden')).toBe(false)
  })

  it('lets learners collapse failed tool output after inspecting diagnostics', async () => {
    renderWithResult({
      ok: false,
      stdout: '',
      stderr: 'error: undefined symbol foo',
      exitCode: 1,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    const trigger = await screen.findByTestId('exercise-tool-output-trigger')
    const body = screen.getByTestId('exercise-tool-output-body')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(body.hasAttribute('hidden')).toBe(false)

    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('title')).toBe('展开编译信息；不会重新运行代码、改变测试结果或学习记录。')
    await waitFor(() => expect(body.hasAttribute('hidden')).toBe(true))
  })

  it('labels runner outages as incomplete submits instead of code failures', async () => {
    requestRemoteActionMock.mockRejectedValue(new Error('Remote action failed: runner unavailable'))
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await screen.findByText('提交未完成')
    const resultStatus = screen.getByTestId('exercise-result-status')
    expect(resultStatus.getAttribute('role')).toBe('status')
    expect(resultStatus.getAttribute('aria-live')).toBe('polite')
    expect(resultStatus.textContent).toBe('提交未完成')
    expectPoliteStatus(screen.getByText('运行服务暂时不可用，这次不会记录为学习进度。请稍后重试提交。'))
    expect(screen.queryByText('提交结果：错误')).toBeNull()
    expect(screen.getByTestId('exercise-runner-unavailable-hint').getAttribute('role')).toBeNull()

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EXERCISE_SUBMIT_FINISHED',
        result: expect.objectContaining({
          failureKind: 'runner_unavailable',
        }),
      }))
    })
  })

  it('offers an inline retry after a runner outage', async () => {
    requestRemoteActionMock
      .mockRejectedValueOnce(new Error('Remote action failed: runner unavailable'))
      .mockResolvedValueOnce({
        compiler_code: 0,
        compiler_output: '',
        bin_code: 0,
        bin_output: 'Hello',
      })
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await screen.findByText('提交未完成')
    const retry = screen.getByRole('button', { name: '重试提交' })
    expect(retry.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(describedByText(retry)).toBe('重试提交会重新运行当前练习代码；只有成功提交后才会记录新的学习证据。')
    expect(retry.getAttribute('title')).toBe('重试提交会重新运行当前练习代码；只有成功提交后才会记录新的学习证据。')

    fireEvent.click(retry)

    await screen.findByText('提交结果：正确')
    expect(requestRemoteActionMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('exercise-runner-unavailable-hint')).toBeNull()
    const submitActions = dispatch.mock.calls.filter(([action]) => action.type === 'EXERCISE_SUBMIT_FINISHED')
    expect(submitActions).toHaveLength(2)
    expect(submitActions[1]?.[0]).toMatchObject({
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: expect.objectContaining({
        ok: true,
        stdout: 'Hello',
      }),
    })
  })

  it('keeps this exercise output visible after the global last run moves on', async () => {
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: 'Cangjie Compiler: 1.1.0',
      bin_code: 0,
      bin_output: 'Hello',
    })
    const dispatch = vi.fn()

    const { rerender } = render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await screen.findByText('提交结果：正确')
    screen.getByText('Hello')

    rerender(
      <Wrapper>
        <ExercisePracticeCard
          exercise={{ ...EXERCISE_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    screen.getByText('提交结果：正确')
    screen.getByText('Hello')
  })

  it('guards rapid double submit so the exercise is recorded once', async () => {
    let resolveRun: ((value: {
      compiler_code: number
      compiler_output: string
      bin_code: number
      bin_output: string
    }) => void) | undefined
    requestRemoteActionMock.mockReturnValue(new Promise((resolve) => {
      resolveRun = resolve
    }))
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    const submit = screen.getByRole('button', { name: '提交' })
    await act(async () => {
      submit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      submit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(requestRemoteActionMock).toHaveBeenCalledTimes(1)
    const actionBar = screen.getByTestId('exercise-action-bar')
    await waitFor(() => expect(actionBar.getAttribute('aria-busy')).toBe('true'))
    const busyStatus = screen.getByTestId('exercise-busy-status')
    const submitting = screen.getByRole('button', { name: '提交中' })
    expect(submitting).toHaveProperty('disabled', true)
    expect(describedByText(submitting)).toBe('练习正在提交，请勿重复提交。')
    expect(submitting.getAttribute('title')).toBe('练习正在提交，请勿重复提交。')
    const run = screen.getByRole('button', { name: '运行' })
    expect(run).toHaveProperty('disabled', true)
    expect(describedByText(run)).toBe('练习正在提交，完成后才能运行。')
    expect(run.getAttribute('title')).toBe('练习正在提交，完成后才能运行。')
    expect(screen.getByRole('status')).toBe(busyStatus)
    expect(actionBar.getAttribute('aria-describedby')).toBe(busyStatus.id)
    expect(busyStatus.textContent).toBe('正在提交练习，请稍候。')

    await act(async () => {
      resolveRun?.({
        compiler_code: 0,
        compiler_output: '',
        bin_code: 0,
        bin_output: 'Hello',
      })
    })

    await screen.findByText('提交结果：正确')
    expect(actionBar.getAttribute('aria-busy')).toBe('false')
    expect(screen.queryByTestId('exercise-busy-status')).toBeNull()
    const submitActions = dispatch.mock.calls.filter(([action]) => action.type === 'EXERCISE_SUBMIT_FINISHED')
    expect(submitActions).toHaveLength(1)
  })

  it('submits with aided attempt evidence after applying an AI code suggestion', async () => {
    const suggestedCode = 'main() {\n    println("Hello")\n}'
    requestRemoteActionMock.mockResolvedValue({
      compiler_code: 0,
      compiler_output: '',
      bin_code: 0,
      bin_output: 'Hello',
    })
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: EXERCISE_BASE.id,
      code: suggestedCode,
      explanation: 'Use the exact expected output.',
      createdAt: 2,
    })
    const dispatch = vi.fn()

    render(
      <Wrapper>
        <ExercisePracticeCard
          exercise={EXERCISE_BASE}
          isActive
          lang="zh"
          dispatch={dispatch}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    await waitFor(() => expect(fakeModels.has(EXERCISE_BASE.id)).toBe(true))
    fireEvent.click(screen.getByTestId('exercise-suggestion-apply'))
    await waitFor(() => expect(fakeModels.get(EXERCISE_BASE.id)?.setValue).toHaveBeenCalledWith(suggestedCode))
    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    expect(requestRemoteActionMock).toHaveBeenCalledWith(suggestedCode, 'run')
    const submitAction = dispatch.mock.calls.find(([action]) => action.type === 'EXERCISE_SUBMIT_FINISHED')?.[0]
    expect(submitAction).toMatchObject({
      type: 'EXERCISE_SUBMIT_FINISHED',
      attemptedCode: suggestedCode,
      attempt: {
        assistance: [
          expect.objectContaining({ kind: 'code_suggestion' }),
        ],
      },
    })
  })
})
