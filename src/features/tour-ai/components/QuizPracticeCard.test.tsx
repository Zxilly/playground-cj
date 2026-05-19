/* eslint-disable react/component-hook-factories */
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuizPracticeCard } from './QuizPracticeCard'
import { ClassroomActivityProvider } from '@/features/tour-ai/context/classroom-activity-context'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'

// Each TourEditor mock instance maintains its own in-memory model + spies so
// tests can assert on per-quiz behaviour. Keyed by uriHint to mirror the real
// per-quiz isolation.
interface FakeModel {
  current: string
  setValue: ReturnType<typeof vi.fn>
}
const fakeModels = new Map<string, FakeModel>()
function getFakeModel(key: string): FakeModel {
  let m = fakeModels.get(key)
  if (!m) {
    m = { current: '', setValue: vi.fn() }
    m.setValue.mockImplementation((next: string) => { m!.current = next })
    fakeModels.set(key, m)
  }
  return m
}

vi.mock('@/features/tour/components/TourEditor', () => ({
  TourEditor: ({ code, uriHint, onEditorReady }: { code: string, uriHint?: string, onEditorReady?: (h: MonacoEditorHandle) => void }) => {
    const model = getFakeModel(uriHint ?? 'default')
    useEffect(() => {
      onEditorReady?.({
        getEditor: () => ({
          getModel: () => ({
            setValue: model.setValue,
            getValue: () => model.current,
            // QuizPracticeCard subscribes to onDidChangeContent to mirror edits
            // into the draft store. The unit harness does not exercise change
            // events, so a no-op subscription returning a disposable is enough.
            onDidChangeContent: () => ({ dispose: () => undefined }),
          }),
          updateOptions: () => undefined,
        }) as unknown as ReturnType<MonacoEditorHandle['getEditor']>,
        dispose: () => undefined,
      })
    }, [model, onEditorReady])
    return <div data-testid="tour-editor" data-uri-hint={uriHint}>{code}</div>
  },
}))

vi.mock('@/const', () => ({
  examples: [],
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <ClassroomActivityProvider>{children}</ClassroomActivityProvider>
    </I18nProvider>
  )
}

const QUIZ_BASE = {
  id: 'quiz:1',
  conceptId: 'cj.hello',
  prompt: 'Print hello.',
  starterCode: 'main() {\n    println("Hello")\n}',
  expectedOutput: 'Hello',
  matchMode: 'exact' as const,
  status: 'active' as const,
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

function renderWithResult(lastRun: import('@/lib/ai/classroom/types').RunResult | null) {
  return render(
    <Wrapper>
      <QuizPracticeCard
        quiz={QUIZ_BASE}
        isActive
        lang="zh"
        dispatch={vi.fn()}
        bridge={makeBridge()}
        lastRun={lastRun}
      />
    </Wrapper>,
  )
}

describe('quizPracticeCard', () => {
  afterEach(() => {
    cleanup()
    fakeModels.clear()
  })

  it('resets this card\'s own editor (not a shared one) back to the quiz starter code', () => {
    render(
      <Wrapper>
        <QuizPracticeCard
          quiz={QUIZ_BASE}
          isActive
          lang="zh"
          dispatch={vi.fn()}
          bridge={makeBridge()}
          lastRun={null}
        />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: '重置代码' }))

    const model = fakeModels.get('quiz:1')!
    expect(model.setValue).toHaveBeenCalledWith('main() {\n    println("Hello")\n}')
  })

  it('registers the active quiz\'s editor in the shared bridge so chat tools target it', async () => {
    const setEditor = vi.fn()
    const getEditor = vi.fn(() => undefined)
    const bridge = {
      editor: { setEditor, getEditor },
    } as unknown as AIClassroomBridgeValue

    render(
      <Wrapper>
        <QuizPracticeCard
          quiz={QUIZ_BASE}
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

  it('does not register an inactive quiz\'s editor in the shared bridge', async () => {
    const setEditor = vi.fn()
    const bridge = {
      editor: { setEditor, getEditor: vi.fn(() => undefined) },
    } as unknown as AIClassroomBridgeValue

    render(
      <Wrapper>
        <QuizPracticeCard
          quiz={{ ...QUIZ_BASE, status: 'success' }}
          isActive={false}
          lang="zh"
          dispatch={vi.fn()}
          bridge={bridge}
          lastRun={null}
        />
      </Wrapper>,
    )

    // Let the TourEditor mock's effect run.
    await waitFor(() => expect(fakeModels.has('quiz:1')).toBe(true))
    expect(setEditor).not.toHaveBeenCalled()
  })

  it('keeps the tool output collapsed by default on a successful run', async () => {
    renderWithResult({
      ok: true,
      stdout: 'Hello',
      stderr: 'Cangjie Compiler: 1.1.0\nTarget: x86_64\n... lots of trace ...',
      exitCode: 0,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    const trigger = await screen.findByTestId('quiz-tool-output-trigger')
    expect(trigger.getAttribute('data-state')).toBe('closed')
    // The body element is still rendered for the collapse animation; assert it is hidden via data-state.
    expect(screen.getByTestId('quiz-tool-output-body').getAttribute('data-state')).toBe('closed')
  })

  it('auto-expands the tool output when the run failed', async () => {
    renderWithResult({
      ok: false,
      stdout: '',
      stderr: 'error: undefined symbol foo',
      exitCode: 1,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    const trigger = await screen.findByTestId('quiz-tool-output-trigger')
    expect(trigger.getAttribute('data-state')).toBe('open')
    expect(screen.getByTestId('quiz-tool-output-body').getAttribute('data-state')).toBe('open')
  })

  it('lets the user manually expand a successful run\'s tool output', async () => {
    renderWithResult({
      ok: true,
      stdout: 'Hello',
      stderr: 'info: build succeeded',
      exitCode: 0,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    const trigger = await screen.findByTestId('quiz-tool-output-trigger')
    fireEvent.click(trigger)

    await waitFor(() => expect(trigger.getAttribute('data-state')).toBe('open'))
  })

  it('does not render the tool output section when stderr is empty', async () => {
    renderWithResult({
      ok: true,
      stdout: 'Hello',
      stderr: '',
      exitCode: 0,
    })

    fireEvent.click(screen.getByRole('tab', { name: /测试结果/ }))

    // Wait for the result panel itself to mount, then verify the tool output trigger is absent.
    await screen.findByTestId('quiz-test-result-output')
    expect(screen.queryByTestId('quiz-tool-output-trigger')).toBeNull()
  })
})
