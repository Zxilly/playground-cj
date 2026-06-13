import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodeTaskBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { CodeTaskBlock } from './CodeTaskBlock'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
})

const block: CodeTaskBlockSchemaType = {
  type: 'code_task',
  prompt: 'Print hello',
  starterCode: 'main() {\n  // TODO\n}',
  expectedOutput: 'hello',
  matchMode: 'exact',
  hints: ['Use println', 'println("hello")'],
}

function ok(stdout: string): RunResult {
  return { ok: true, stdout, stderr: '', exitCode: 0 }
}

function compileError(stderr: string): RunResult {
  return { ok: false, stdout: '', stderr, exitCode: null, compilerOutput: stderr }
}

function runnerDown(): RunResult {
  return { ok: false, stdout: '', stderr: 'network down', exitCode: null, failureKind: 'runner_unavailable' }
}

describe('codeTaskBlock', () => {
  it('seeds the editor with the starter code', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} />)
    const editor = screen.getByTestId('code-task-editor') as HTMLTextAreaElement
    expect(editor.value).toBe(block.starterCode)
  })

  it('renders the prompt', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} />)
    expect(screen.getByText('Print hello')).toBeTruthy()
  })

  it('runs the current editor code through the injected runner', async () => {
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('hello\n'))
    render(<CodeTaskBlock block={block} runCode={runCode} />)
    fireEvent.change(screen.getByTestId('code-task-editor'), { target: { value: 'main() { println("hello") }' } })
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => expect(runCode).toHaveBeenCalledWith('main() { println("hello") }'))
  })

  it('shows a pass result and reports correct when output matches', async () => {
    const onOutcome = vi.fn()
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('hello\n'))
    render(<CodeTaskBlock block={block} runCode={runCode} onOutcome={onOutcome} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('passed')
    })
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ correct: true }))
  })

  it('shows a fail result with expected/actual comparison when output mismatches', async () => {
    const onOutcome = vi.fn()
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('goodbye\n'))
    render(<CodeTaskBlock block={block} runCode={runCode} onOutcome={onOutcome} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('failed')
    })
    const expected = screen.getByTestId('code-task-expected')
    const actual = screen.getByTestId('code-task-actual')
    expect(expected.textContent).toContain('hello')
    expect(actual.textContent).toContain('goodbye')
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
  })

  it('surfaces compiler stderr when compilation fails', async () => {
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(compileError('error: missing main'))
    render(<CodeTaskBlock block={block} runCode={runCode} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('failed')
    })
    expect(screen.getByTestId('code-task-stderr').textContent).toContain('missing main')
  })

  it('reveals hints one at a time on demand', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} />)
    expect(screen.queryByTestId('code-task-hint')).toBeNull()
    fireEvent.click(screen.getByTestId('code-task-hint-button'))
    expect(screen.getAllByTestId('code-task-hint')).toHaveLength(1)
    expect(screen.getAllByTestId('code-task-hint')[0].textContent).toContain('Use println')
    fireEvent.click(screen.getByTestId('code-task-hint-button'))
    expect(screen.getAllByTestId('code-task-hint')).toHaveLength(2)
  })

  it('hides the hint button when there are no hints', () => {
    const noHints: CodeTaskBlockSchemaType = { ...block, hints: undefined }
    render(<CodeTaskBlock block={noHints} runCode={vi.fn()} />)
    expect(screen.queryByTestId('code-task-hint-button')).toBeNull()
  })

  it('shows a degraded notice when the runner is unavailable', async () => {
    const onOutcome = vi.fn()
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(runnerDown())
    render(<CodeTaskBlock block={block} runCode={runCode} onOutcome={onOutcome} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      expect(screen.getByTestId('code-task-runner-unavailable')).toBeTruthy()
    })
    // runner-unavailable must not record a (false) outcome
    expect(onOutcome).not.toHaveBeenCalled()
  })

  it('rehydrates a passed outcome with the prior code and a pass result', () => {
    render(
      <CodeTaskBlock
        block={block}
        runCode={vi.fn()}
        outcome={{ attempts: 1, correct: true, lastAnswer: 'main() { println("hello") }', completedAt: 1000 }}
      />,
    )
    const editor = screen.getByTestId('code-task-editor') as HTMLTextAreaElement
    expect(editor.value).toBe('main() { println("hello") }')
    expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('passed')
  })

  it('rehydrates a failed completed outcome as a fail result with the prior code', () => {
    render(
      <CodeTaskBlock
        block={block}
        runCode={vi.fn()}
        outcome={{ attempts: 1, correct: false, lastAnswer: 'main() { println("nope") }', completedAt: 1000 }}
      />,
    )
    const editor = screen.getByTestId('code-task-editor') as HTMLTextAreaElement
    expect(editor.value).toBe('main() { println("nope") }')
    expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('failed')
  })

  it('falls back to starter code when a completed outcome has no recorded answer', () => {
    render(
      <CodeTaskBlock
        block={block}
        runCode={vi.fn()}
        outcome={{ attempts: 1, correct: true, completedAt: 1000 }}
      />,
    )
    const editor = screen.getByTestId('code-task-editor') as HTMLTextAreaElement
    expect(editor.value).toBe(block.starterCode)
    expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('passed')
  })

  it('uses starter code and shows no result when the outcome is not completed', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} outcome={{ attempts: 0 }} />)
    const editor = screen.getByTestId('code-task-editor') as HTMLTextAreaElement
    expect(editor.value).toBe(block.starterCode)
    expect(screen.queryByTestId('code-task-result')).toBeNull()
  })

  it('renders duplicate hints without a key warning and shows every revealed hint', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dupHints: CodeTaskBlockSchemaType = { ...block, hints: ['same hint', 'same hint'] }
    render(<CodeTaskBlock block={dupHints} runCode={vi.fn()} />)
    fireEvent.click(screen.getByTestId('code-task-hint-button'))
    fireEvent.click(screen.getByTestId('code-task-hint-button'))
    expect(screen.getAllByTestId('code-task-hint')).toHaveLength(2)
    const keyWarning = warn.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('same key')),
    )
    expect(keyWarning).toBe(false)
    warn.mockRestore()
  })

  it('disables run while a run is in flight', async () => {
    let resolveRun: (r: RunResult) => void = () => {}
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockImplementation(
      () => new Promise<RunResult>((resolve) => {
        resolveRun = resolve
      }),
    )
    render(<CodeTaskBlock block={block} runCode={runCode} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => expect((screen.getByTestId('code-task-run') as HTMLButtonElement).disabled).toBe(true))
    resolveRun(ok('hello'))
    await waitFor(() => expect((screen.getByTestId('code-task-run') as HTMLButtonElement).disabled).toBe(false))
  })
})
