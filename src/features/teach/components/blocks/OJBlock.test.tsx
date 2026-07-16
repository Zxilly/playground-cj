import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { useImperativeHandle, useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OjBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import type { OJEditorProps } from './OJBlock'
import { OJBlock } from './OJBlock'

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

/**
 * A jsdom-friendly stand-in for the Monaco editor (mirrors CodeTaskBlock.test).
 * Renders a `<textarea>`, seeds it from `initialCode`, and exposes the same
 * `{ getCode, setCode }` handle the real Monaco wrapper does, so the block's
 * run/register logic is exercised identically.
 */
function FakeEditor({ initialCode, handleRef }: OJEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(handleRef, () => ({
    getCode: () => inputRef.current?.value ?? initialCode,
    setCode: (next: string) => {
      if (inputRef.current)
        inputRef.current.value = next
    },
  }), [initialCode])
  return (
    <textarea
      ref={inputRef}
      data-testid="fake-editor-input"
      defaultValue={initialCode}
    />
  )
}

const functionBlock: OjBlockSchemaType = {
  type: 'oj',
  mode: 'function',
  title: 'Add',
  prompt: 'Implement add',
  starterCode: 'func add(a: Int64, b: Int64): Int64 { 0 }',
  callTemplate: 'println(add(${args}))',
  testCases: [
    { args: '1, 2', expectedOutput: '3', visible: true, label: 'sample' },
    { args: '10, 20', expectedOutput: '30', visible: false, label: 'hidden' },
  ],
  matchMode: 'exact',
  difficulty: 'easy',
}

function ok(stdout: string): RunResult {
  return { ok: true, stdout, stderr: '', exitCode: 0 }
}

function runnerDown(): RunResult {
  return { ok: false, stdout: '', stderr: 'network down', exitCode: null, failureKind: 'runner_unavailable' }
}

function input() {
  return screen.getByTestId('fake-editor-input') as HTMLTextAreaElement
}

describe('oJBlock', () => {
  it('renders the title, difficulty badge and the function-mode hint', () => {
    render(<OJBlock block={functionBlock} editorComponent={FakeEditor} />)
    expect(screen.getByTestId('oj-title').textContent).toBe('Add')
    expect(screen.getByTestId('oj-difficulty')).toBeTruthy()
    expect(screen.getByTestId('oj-function-hint')).toBeTruthy()
  })

  it('seeds the editor with the starter code', () => {
    render(<OJBlock block={functionBlock} editorComponent={FakeEditor} />)
    expect(input().value).toBe(functionBlock.starterCode)
  })

  it('submit runs all cases and reports correct=true when all pass', async () => {
    const onOutcome = vi.fn()
    const runProgram = vi.fn<(code: string) => Promise<RunResult>>()
      .mockResolvedValueOnce(ok('3'))
      .mockResolvedValueOnce(ok('30'))
    render(<OJBlock block={functionBlock} onOutcome={onOutcome} runProgram={runProgram} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('oj-submit'))
    await waitFor(() => {
      expect(screen.getByTestId('oj-summary').getAttribute('data-status')).toBe('passed')
    })
    expect(runProgram).toHaveBeenCalledTimes(2)
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ correct: true }))
    expect(screen.getByTestId('oj-passed-count').textContent).toContain('2')
  })

  it('run sample exercises only the visible cases', async () => {
    const runProgram = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('3'))
    render(<OJBlock block={functionBlock} runProgram={runProgram} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('oj-run-sample'))
    await waitFor(() => expect(screen.getByTestId('oj-summary')).toBeTruthy())
    expect(runProgram).toHaveBeenCalledTimes(1)
    expect(screen.getAllByTestId('oj-case')).toHaveLength(1)
  })

  it('shows expected/actual for a failing visible case', async () => {
    const runProgram = vi.fn<(code: string) => Promise<RunResult>>()
      .mockResolvedValueOnce(ok('999'))
      .mockResolvedValueOnce(ok('30'))
    render(<OJBlock block={functionBlock} runProgram={runProgram} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('oj-submit'))
    await waitFor(() => {
      expect(screen.getByTestId('oj-summary').getAttribute('data-status')).toBe('failed')
    })
    expect(screen.getByTestId('oj-case-expected').textContent).toContain('3')
    expect(screen.getByTestId('oj-case-actual').textContent).toContain('999')
  })

  it('does NOT reveal a hidden failing case expected output', async () => {
    const runProgram = vi.fn<(code: string) => Promise<RunResult>>()
      .mockResolvedValueOnce(ok('3')) // visible passes
      .mockResolvedValueOnce(ok('bad')) // hidden fails
    render(<OJBlock block={functionBlock} runProgram={runProgram} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('oj-submit'))
    await waitFor(() => {
      expect(screen.getByTestId('oj-summary').getAttribute('data-status')).toBe('failed')
    })
    // The failing case is the hidden one; its expected output must not appear.
    const hiddenCase = screen.getAllByTestId('oj-case').find(el => el.getAttribute('data-visible') === 'false')
    expect(hiddenCase?.getAttribute('data-status')).toBe('failed')
    expect(screen.queryByTestId('oj-case-expected')).toBeNull()
    expect(screen.queryByTestId('oj-case-actual')).toBeNull()
    expect(screen.queryByText('30')).toBeNull()
  })

  it('assembles the function-mode program with substituted args for each case', async () => {
    const runProgram = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('3'))
    render(<OJBlock block={functionBlock} runProgram={runProgram} editorComponent={FakeEditor} />)
    fireEvent.change(input(), { target: { value: 'MYCODE' } })
    fireEvent.click(screen.getByTestId('oj-submit'))
    await waitFor(() => expect(runProgram).toHaveBeenCalledTimes(2))
    const firstProgram = runProgram.mock.calls[0][0]
    expect(firstProgram).toContain('MYCODE')
    expect(firstProgram).toContain('println(add(1, 2))')
  })

  it('shows a degraded notice and records no outcome when the runner is unavailable', async () => {
    const onOutcome = vi.fn()
    const runProgram = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(runnerDown())
    render(<OJBlock block={functionBlock} onOutcome={onOutcome} runProgram={runProgram} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('oj-submit'))
    await waitFor(() => expect(screen.getByTestId('oj-runner-unavailable')).toBeTruthy())
    expect(onOutcome).not.toHaveBeenCalled()
  })

  it('reveals hints one at a time on demand', () => {
    const withHints: OjBlockSchemaType = { ...functionBlock, hints: ['hint a', 'hint b'] }
    render(<OJBlock block={withHints} editorComponent={FakeEditor} />)
    expect(screen.queryByTestId('oj-hint')).toBeNull()
    fireEvent.click(screen.getByTestId('oj-hint-button'))
    expect(screen.getAllByTestId('oj-hint')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('oj-hint-button'))
    expect(screen.getAllByTestId('oj-hint')).toHaveLength(2)
  })

  it('rehydrates the prior submitted code from a completed outcome', () => {
    render(
      <OJBlock
        block={functionBlock}
        editorComponent={FakeEditor}
        outcome={{ attempts: 1, correct: true, lastAnswer: 'func add(a, b) { a + b }', completedAt: 1000 }}
      />,
    )
    expect(input().value).toBe('func add(a, b) { a + b }')
  })

  it('registers its editor as active so the teacher can read the learner code', () => {
    const registry = createActiveEditorRegistry()
    render(<OJBlock block={functionBlock} editorComponent={FakeEditor} activeEditor={registry} />)
    expect(registry.getCode()).toBe(functionBlock.starterCode)
  })

  it('targets the last focused or clicked editor when multiple problems are mounted', () => {
    const registry = createActiveEditorRegistry()
    const secondBlock: OjBlockSchemaType = {
      ...functionBlock,
      title: 'Multiply',
      starterCode: 'func multiply(a: Int64, b: Int64): Int64 { 0 }',
    }

    const view = render(
      <>
        <OJBlock key="a" block={functionBlock} editorComponent={FakeEditor} activeEditor={registry} />
        <OJBlock key="b" block={secondBlock} editorComponent={FakeEditor} activeEditor={registry} />
      </>,
    )
    const [editorA, editorB] = screen.getAllByTestId('fake-editor-input') as HTMLTextAreaElement[]

    expect(registry.getCode()).toBe(secondBlock.starterCode)

    fireEvent.focus(editorA)
    expect(registry.getCode()).toBe(functionBlock.starterCode)
    expect(registry.setCode('teacher updated A')).toBe(true)
    expect(editorA.value).toBe('teacher updated A')
    expect(editorB.value).toBe(secondBlock.starterCode)

    fireEvent.click(editorB)
    expect(registry.getCode()).toBe(secondBlock.starterCode)
    expect(registry.setCode('teacher updated B')).toBe(true)
    expect(editorA.value).toBe('teacher updated A')
    expect(editorB.value).toBe('teacher updated B')

    view.rerender(
      <OJBlock key="b" block={secondBlock} editorComponent={FakeEditor} activeEditor={registry} />,
    )
    expect(registry.getCode()).toBe('teacher updated B')
  })

  it('unregisters on unmount', () => {
    const registry = createActiveEditorRegistry()
    const view = render(<OJBlock block={functionBlock} editorComponent={FakeEditor} activeEditor={registry} />)
    expect(registry.getCode()).toBe(functionBlock.starterCode)
    view.unmount()
    expect(registry.getCode()).toBeNull()
  })
})
