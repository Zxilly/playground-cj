import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { useEffect, useRef } from 'react'
import type { ChangeEvent, ReactNode, RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import type { CodeTaskEditorHandle } from '@/features/teach/components/blocks/CodeTaskBlock'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { PlaygroundView } from './PlaygroundView'

function FakePlaygroundEditor({
  initialCode,
  handleRef,
}: {
  initialCode: string
  handleRef: RefObject<CodeTaskEditorHandle | null>
}) {
  const codeRef = useRef(initialCode)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    handleRef.current = {
      getCode: () => codeRef.current,
      setCode: (code: string) => {
        codeRef.current = code
        if (inputRef.current)
          inputRef.current.value = code
      },
    }
    return () => {
      handleRef.current = null
    }
  }, [handleRef])
  return (
    <textarea
      ref={inputRef}
      data-testid="fake-playground-editor"
      defaultValue={initialCode}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        codeRef.current = event.target.value
      }}
    />
  )
}

vi.mock('@/features/teach/components/blocks/DynamicCodeTaskMonacoEditor', () => ({
  DynamicCodeTaskMonacoEditor: FakePlaygroundEditor,
}))

const runner = {
  run: vi.fn<(code: string) => Promise<RunResult>>(async (code: string) => ({
    ok: true,
    stdout: `output:${code}`,
    stderr: '',
    compilerOutput: `compiler:${code}`,
    exitCode: 0,
  })),
}

const ESC = String.fromCharCode(27)
const noisyCompilerError = [
  `${ESC}[36m$ /opt/cangjie/bin/cjc main.cj -o main${ESC}[0m`,
  'Cangjie Compiler 1.0.0',
  `${ESC}[31merror: expected expression${ESC}[0m`,
  '  --> main.cj:2:12',
].join('\n')

const context: WorkspaceContextValue = {
  repo: {} as WorkspaceContextValue['repo'],
  retrievalStore: { list: vi.fn(async () => []), save: vi.fn(async () => undefined) },
  knowledge: { id: 'test', search: vi.fn(async () => []) },
  runner,
  activeEditor: createActiveEditorRegistry(),
  now: () => 0,
}

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <WorkspaceContext value={context}>{children}</WorkspaceContext>
    </I18nProvider>
  )
}

beforeEach(() => {
  runner.run.mockClear()
  useWorkspaceStore.getState().reset()
  useWorkspaceStore.getState().setView('playground')
})

afterEach(cleanup)

describe('playgroundView student flow', () => {
  it('keeps tab buffers independent and runs the code from the active editor', async () => {
    render(<PlaygroundView />, { wrapper: Wrapper })

    const firstEditor = screen.getByTestId('fake-playground-editor')
    fireEvent.change(firstEditor, { target: { value: 'main() { println("first") }' } })
    fireEvent.click(screen.getByTestId('playground-run'))
    await waitFor(() => expect(runner.run).toHaveBeenLastCalledWith('main() { println("first") }'))
    expect(await screen.findByText('output:main() { println("first") }')).toBeTruthy()
    expect(screen.getByText('compiler:main() { println("first") }')).toBeTruthy()

    fireEvent.click(screen.getByTestId('playground-new-tab'))
    const secondEditor = screen.getByTestId('fake-playground-editor')
    fireEvent.change(secondEditor, { target: { value: 'main() { println("second") }' } })
    fireEvent.click(screen.getByTestId('playground-run'))
    await waitFor(() => expect(runner.run).toHaveBeenLastCalledWith('main() { println("second") }'))
    expect(await screen.findByText('output:main() { println("second") }')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('tab')[0])
    expect(screen.getByText('output:main() { println("first") }')).toBeTruthy()
    expect((screen.getByTestId('fake-playground-editor') as HTMLTextAreaElement).value)
      .toBe('main() { println("first") }')
  })

  it('lets the learner resize the output panel with the keyboard and reset it', () => {
    render(<PlaygroundView />, { wrapper: Wrapper })

    const output = screen.getByTestId('playground-output')
    const resizer = screen.getByTestId('playground-output-resizer')
    expect(output.style.height).toBe('176px')
    expect(resizer.getAttribute('aria-valuenow')).toBe('176')

    fireEvent.keyDown(resizer, { key: 'ArrowUp' })
    expect(output.style.height).toBe('200px')
    expect(resizer.getAttribute('aria-valuenow')).toBe('200')

    fireEvent.keyDown(resizer, { key: 'Home' })
    expect(output.style.height).toBe('112px')

    fireEvent.keyDown(resizer, { key: 'End' })
    expect(output.style.height).toBe('480px')

    fireEvent.doubleClick(resizer)
    expect(output.style.height).toBe('176px')
  })

  it('shows the clean compiler diagnostic first and keeps runner noise collapsed', async () => {
    runner.run.mockResolvedValueOnce({
      ok: false,
      stdout: '',
      stderr: noisyCompilerError,
      compilerOutput: noisyCompilerError,
      exitCode: null,
    })
    render(<PlaygroundView />, { wrapper: Wrapper })
    fireEvent.click(screen.getByTestId('playground-run'))

    const diagnostic = await screen.findByTestId('playground-stderr')
    expect(diagnostic.textContent).toContain('error: expected expression')
    expect(diagnostic.textContent).not.toContain('/opt/cangjie/bin/cjc')
    expect(diagnostic.textContent).not.toContain(ESC)
    expect(diagnostic.innerHTML).toContain('color:rgb(187,0,0)')

    const raw = screen.getByTestId('playground-stderr-raw')
    expect(raw.getAttribute('open')).toBeNull()
    expect(raw.textContent).toContain('/opt/cangjie/bin/cjc')
    expect(raw.textContent).not.toContain(ESC)
  })
})
