import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { useImperativeHandle, useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodeTaskBlockSchemaType } from '@/lib/teach/lessons/blocks'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import type { CodeTaskEditorProps } from './CodeTaskBlock'
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

/**
 * A jsdom-friendly stand-in for the Monaco editor. Monaco never renders under
 * jsdom, so the block accepts an injectable editor component; this fake renders a
 * plain `<textarea>`, seeds it from `initialCode`, and exposes the same
 * `{ getCode, setCode }` handle the real Monaco wrapper does (via `ref`) so the
 * block's run/register logic is exercised identically.
 */
function FakeEditor({ initialCode, handleRef, uriHint, modelScope }: CodeTaskEditorProps) {
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
      data-uri-hint={uriHint}
      data-model-scope={modelScope}
      defaultValue={initialCode}
    />
  )
}

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

const ESC = String.fromCharCode(27)
const noisyCompilerError = [
  `${ESC}[36m$ /opt/cangjie/bin/cjc main.cj -o main${ESC}[0m`,
  'Cangjie Compiler 1.0.0',
  `${ESC}[31merror: expected expression${ESC}[0m`,
  '  --> main.cj:2:12',
].join('\n')

function runnerDown(): RunResult {
  return { ok: false, stdout: '', stderr: 'network down', exitCode: null, failureKind: 'runner_unavailable' }
}

function input() {
  return screen.getByTestId('fake-editor-input') as HTMLTextAreaElement
}

describe('codeTaskBlock', () => {
  it('mounts the editor container with the stable test id', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} editorComponent={FakeEditor} />)
    expect(screen.getByTestId('code-task-editor')).toBeTruthy()
  })

  it('seeds the editor with the starter code', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} editorComponent={FakeEditor} />)
    expect(input().value).toBe(block.starterCode)
  })

  it('forwards the stable model identity and lifecycle scope to Monaco', () => {
    render(
      <CodeTaskBlock
        block={block}
        runCode={vi.fn()}
        editorComponent={FakeEditor}
        editorUriHint="teach:lesson-1:b0"
        editorModelScope="teach:lesson-1"
      />,
    )
    expect(input().dataset.uriHint).toBe('teach:lesson-1:b0')
    expect(input().dataset.modelScope).toBe('teach:lesson-1')
  })

  it('renders the prompt', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} editorComponent={FakeEditor} />)
    expect(screen.getByText('Print hello')).toBeTruthy()
  })

  it('renders inline markdown in the prompt instead of raw markers', () => {
    render(
      <CodeTaskBlock
        block={{ ...block, prompt: 'Declare **immutable** `name`' }}
        runCode={vi.fn()}
        editorComponent={FakeEditor}
      />,
    )
    const prompt = screen.getByTestId('code-task-prompt')
    expect(prompt.querySelector('strong')?.textContent).toBe('immutable')
    expect(prompt.querySelector('code')?.textContent).toBe('name')
    expect(prompt.textContent).not.toContain('**')
    expect(prompt.textContent).not.toContain('`')
  })

  it('runs the current editor code (read from the handle) through the injected runner', async () => {
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('hello\n'))
    render(<CodeTaskBlock block={block} runCode={runCode} editorComponent={FakeEditor} />)
    fireEvent.change(input(), { target: { value: 'main() { println("hello") }' } })
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => expect(runCode).toHaveBeenCalledWith('main() { println("hello") }'))
  })

  it('shows a pass result and reports correct when output matches', async () => {
    const onOutcome = vi.fn()
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('hello\n'))
    render(<CodeTaskBlock block={block} runCode={runCode} onOutcome={onOutcome} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('passed')
    })
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ correct: true }))
  })

  it('shows a fail result with expected/actual comparison when output mismatches', async () => {
    const onOutcome = vi.fn()
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('goodbye\n'))
    render(<CodeTaskBlock block={block} runCode={runCode} onOutcome={onOutcome} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('failed')
    })
    expect(screen.getByTestId('code-task-expected').textContent).toContain('hello')
    expect(screen.getByTestId('code-task-actual').textContent).toContain('goodbye')
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
  })

  it('treats successful runs with noisy toolchain stderr as output mismatches, not compiler failures', async () => {
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue({
      ok: true,
      stdout: '',
      stderr: noisyCompilerError,
      exitCode: 0,
      compilerOutput: noisyCompilerError,
    })
    render(<CodeTaskBlock block={block} runCode={runCode} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('code-task-run'))

    await waitFor(() => {
      expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('failed')
    })
    expect(screen.getByTestId('code-task-output-mismatch').textContent).toContain('程序已成功运行')
    expect(screen.getByTestId('code-task-expected').textContent).toContain('hello')
    expect(screen.getByTestId('code-task-actual').textContent).toContain('没有输出')
    expect(screen.queryByTestId('code-task-stderr')).toBeNull()
    expect(screen.queryByText(/cjc main\.cj/)).toBeNull()
  })

  it('surfaces compiler stderr as a run error (not a plain output mismatch) when compilation fails', async () => {
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(compileError('error: missing main'))
    render(<CodeTaskBlock block={block} runCode={runCode} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      // A compile failure is its own state, not the output-mismatch "failed".
      expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('errored')
    })
    expect(screen.getByTestId('code-task-stderr').textContent).toContain('missing main')
    expect(screen.queryByTestId('code-task-output-mismatch')).toBeNull()
    // No empty expected/actual diff distracting from the compiler message.
    expect(screen.queryByTestId('code-task-expected')).toBeNull()
    expect(screen.queryByTestId('code-task-actual')).toBeNull()
  })

  it('promotes the clean diagnostic and collapses noisy compiler preamble', async () => {
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(compileError(noisyCompilerError))
    render(<CodeTaskBlock block={block} runCode={runCode} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('code-task-run'))

    await waitFor(() => expect(screen.getByTestId('code-task-stderr')).toBeTruthy())
    const diagnostic = screen.getByTestId('code-task-stderr')
    expect(diagnostic.textContent).toContain('error: expected expression')
    expect(diagnostic.textContent).not.toContain('/opt/cangjie/bin/cjc')
    expect(diagnostic.textContent).not.toContain(ESC)

    const raw = screen.getByTestId('code-task-stderr-raw')
    expect(raw.getAttribute('open')).toBeNull()
    expect(raw.textContent).toContain('/opt/cangjie/bin/cjc')
    expect(raw.textContent).not.toContain(ESC)
  })

  it('reveals hints one at a time on demand', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} editorComponent={FakeEditor} />)
    expect(screen.queryByTestId('code-task-hint')).toBeNull()
    fireEvent.click(screen.getByTestId('code-task-hint-button'))
    expect(screen.getAllByTestId('code-task-hint')).toHaveLength(1)
    expect(screen.getAllByTestId('code-task-hint')[0].textContent).toContain('Use println')
    fireEvent.click(screen.getByTestId('code-task-hint-button'))
    expect(screen.getAllByTestId('code-task-hint')).toHaveLength(2)
  })

  it('hides the hint button when there are no hints', () => {
    const noHints: CodeTaskBlockSchemaType = { ...block, hints: undefined }
    render(<CodeTaskBlock block={noHints} runCode={vi.fn()} editorComponent={FakeEditor} />)
    expect(screen.queryByTestId('code-task-hint-button')).toBeNull()
  })

  it('shows a degraded notice when the runner is unavailable', async () => {
    const onOutcome = vi.fn()
    const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(runnerDown())
    render(<CodeTaskBlock block={block} runCode={runCode} onOutcome={onOutcome} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => {
      expect(screen.getByTestId('code-task-runner-unavailable')).toBeTruthy()
    })
    expect(onOutcome).not.toHaveBeenCalled()
  })

  it('rehydrates a passed outcome with the prior code and a pass result', () => {
    render(
      <CodeTaskBlock
        block={block}
        runCode={vi.fn()}
        editorComponent={FakeEditor}
        outcome={{ attempts: 1, correct: true, lastAnswer: 'main() { println("hello") }', completedAt: 1000 }}
      />,
    )
    expect(input().value).toBe('main() { println("hello") }')
    expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('passed')
  })

  it('rehydrates a failed completed outcome as a fail result with the prior code', () => {
    render(
      <CodeTaskBlock
        block={block}
        runCode={vi.fn()}
        editorComponent={FakeEditor}
        outcome={{ attempts: 1, correct: false, lastAnswer: 'main() { println("nope") }', completedAt: 1000 }}
      />,
    )
    expect(input().value).toBe('main() { println("nope") }')
    expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('failed')
  })

  it('falls back to starter code when a completed outcome has no recorded answer', () => {
    render(
      <CodeTaskBlock
        block={block}
        runCode={vi.fn()}
        editorComponent={FakeEditor}
        outcome={{ attempts: 1, correct: true, completedAt: 1000 }}
      />,
    )
    expect(input().value).toBe(block.starterCode)
    expect(screen.getByTestId('code-task-result').getAttribute('data-status')).toBe('passed')
  })

  it('uses starter code and shows no result when the outcome is not completed', () => {
    render(<CodeTaskBlock block={block} runCode={vi.fn()} editorComponent={FakeEditor} outcome={{ attempts: 0 }} />)
    expect(input().value).toBe(block.starterCode)
    expect(screen.queryByTestId('code-task-result')).toBeNull()
  })

  it('renders duplicate hints without a key warning and shows every revealed hint', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dupHints: CodeTaskBlockSchemaType = { ...block, hints: ['same hint', 'same hint'] }
    render(<CodeTaskBlock block={dupHints} runCode={vi.fn()} editorComponent={FakeEditor} />)
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
    render(<CodeTaskBlock block={block} runCode={runCode} editorComponent={FakeEditor} />)
    fireEvent.click(screen.getByTestId('code-task-run'))
    await waitFor(() => expect((screen.getByTestId('code-task-run') as HTMLButtonElement).disabled).toBe(true))
    resolveRun(ok('hello'))
    await waitFor(() => expect((screen.getByTestId('code-task-run') as HTMLButtonElement).disabled).toBe(false))
  })

  describe('active-editor registry integration', () => {
    it('registers its editor as active so the teacher can read the learner\'s code', () => {
      const registry = createActiveEditorRegistry()
      render(<CodeTaskBlock block={block} runCode={vi.fn()} editorComponent={FakeEditor} activeEditor={registry} />)
      expect(registry.getCode()).toBe(block.starterCode)
    })

    it('lets the teacher write code into the active editor via the registry', async () => {
      const registry = createActiveEditorRegistry()
      const runCode = vi.fn<(code: string) => Promise<RunResult>>().mockResolvedValue(ok('hi\n'))
      render(<CodeTaskBlock block={block} runCode={runCode} editorComponent={FakeEditor} activeEditor={registry} />)

      // set_editor_code writes through the registry into the live editor...
      expect(registry.setCode('main() { println("hi") }')).toBe(true)
      expect(registry.getCode()).toBe('main() { println("hi") }')

      // ...and the next run picks up the teacher-seeded code.
      fireEvent.click(screen.getByTestId('code-task-run'))
      await waitFor(() => expect(runCode).toHaveBeenCalledWith('main() { println("hi") }'))
    })

    it('targets the last focused or clicked editor when multiple tasks are mounted', () => {
      const registry = createActiveEditorRegistry()
      const secondBlock: CodeTaskBlockSchemaType = {
        ...block,
        prompt: 'Print goodbye',
        starterCode: 'main() { println("goodbye") }',
      }

      const view = render(
        <>
          <CodeTaskBlock key="a" block={block} runCode={vi.fn()} editorComponent={FakeEditor} activeEditor={registry} />
          <CodeTaskBlock key="b" block={secondBlock} runCode={vi.fn()} editorComponent={FakeEditor} activeEditor={registry} />
        </>,
      )
      const [editorA, editorB] = screen.getAllByTestId('fake-editor-input') as HTMLTextAreaElement[]

      expect(registry.getCode()).toBe(secondBlock.starterCode)

      fireEvent.focus(editorA)
      expect(registry.getCode()).toBe(block.starterCode)
      expect(registry.setCode('teacher updated A')).toBe(true)
      expect(editorA.value).toBe('teacher updated A')
      expect(editorB.value).toBe(secondBlock.starterCode)

      fireEvent.click(editorB)
      expect(registry.getCode()).toBe(secondBlock.starterCode)
      expect(registry.setCode('teacher updated B')).toBe(true)
      expect(editorA.value).toBe('teacher updated A')
      expect(editorB.value).toBe('teacher updated B')

      view.rerender(
        <CodeTaskBlock key="b" block={secondBlock} runCode={vi.fn()} editorComponent={FakeEditor} activeEditor={registry} />,
      )
      expect(registry.getCode()).toBe('teacher updated B')
    })

    it('unregisters on unmount so a stale editor is not read after the lesson closes', () => {
      const registry = createActiveEditorRegistry()
      const view = render(<CodeTaskBlock block={block} runCode={vi.fn()} editorComponent={FakeEditor} activeEditor={registry} />)
      expect(registry.getCode()).toBe(block.starterCode)
      view.unmount()
      expect(registry.getCode()).toBeNull()
    })
  })
})
