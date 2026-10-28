import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OutputPanel } from './OutputPanel'
import { NO_RUNNER_TRUNCATION } from '@/lib/runner-contract'
import type { RunResult } from '@/lib/runner'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

vi.mock('@/app/font', () => ({ fontFamily: 'monospace' }))

const initial = { toolOutput: '', programOutput: '', truncation: NO_RUNNER_TRUNCATION }
const success: RunResult = {
  ok: true,
  phase: 'run',
  exitCode: 0,
  stdout: 'hello',
  stderr: '',
  compilerOutput: '',
  stdoutTruncated: false,
  stderrTruncated: false,
  compilerOutputTruncated: false,
}

describe('outputPanel', () => {
  afterEach(cleanup)

  it('explains the initial state without displaying two blank output areas', () => {
    render(<Wrapper><OutputPanel {...initial} /></Wrapper>)
    expect(screen.getByText('运行代码后，结果会显示在这里')).toBeTruthy()
    expect(screen.getByRole('tab', { name: '程序输出' }).getAttribute('aria-selected')).toBe('true')
  })

  it('switches between the program and compiler channels without losing their contents', () => {
    render(<Wrapper><OutputPanel {...initial} toolOutput="compile ok" programOutput="hello world" /></Wrapper>)
    expect(screen.getByText('hello world')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: '编译信息' }), { button: 0, ctrlKey: false })
    expect(screen.getByText('compile ok')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: '程序输出' }), { button: 0, ctrlKey: false })
    expect(screen.getByText('hello world')).toBeTruthy()
  })

  it('renders ANSI while escaping source markup', async () => {
    const { container } = render(<Wrapper><OutputPanel {...initial} programOutput={'\u001B[32m<script>alert(1)</script>\u001B[0m'} /></Wrapper>)
    await waitFor(() => expect(container.querySelector('pre')?.innerHTML).toContain('color:rgb(0,187,0)'))
    expect(container.querySelector('pre script')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toContain('<script>alert(1)</script>')
  })

  it('selects failed compiler diagnostics and keeps the original runner log in a disclosure', async () => {
    const { container, rerender } = render(<Wrapper><OutputPanel {...initial} result={success} /></Wrapper>)
    const failure: RunResult = {
      ...success,
      ok: false,
      phase: 'compile',
      exitCode: null,
      compilerOutput: '\u001B[36m$ /cangjie/bin/cjc main.cj\u001B[0m\nCangjie Compiler 1.1\n\u001B[31merror: expected expression\u001B[0m',
    }
    rerender(<Wrapper><OutputPanel {...initial} result={failure} /></Wrapper>)
    expect(screen.getByRole('tab', { name: '编译信息' }).getAttribute('aria-selected')).toBe('true')
    await waitFor(() => expect(container.querySelector('pre')?.innerHTML).toContain('color:rgb(187,0,0)'))
    expect(container.querySelector('pre')?.textContent).not.toContain('/cangjie/bin/cjc')
    const raw = screen.getByText('查看原始编译信息').closest('details')
    expect(raw?.getAttribute('open')).toBeNull()
    expect(raw?.textContent).toContain('/cangjie/bin/cjc')
    // A subsequent successful run returns to the program stream.
    rerender(<Wrapper><OutputPanel {...initial} result={{ ...success }} /></Wrapper>)
    expect(screen.getByRole('tab', { name: '程序输出' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('hello')).toBeTruthy()
  })

  it('keeps stdout, stderr and truncation notices separate', () => {
    render(<Wrapper><OutputPanel {...initial} result={{ ...success, stderr: 'runtime error', stdoutTruncated: true, stderrTruncated: true, compilerOutputTruncated: true }} /></Wrapper>)
    expect(screen.getByText('runtime error')).toBeTruthy()
    expect(screen.getByText('程序标准输出已截断。')).toBeTruthy()
    expect(screen.getByText('程序标准错误已截断。')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: '编译信息' }), { button: 0, ctrlKey: false })
    expect(screen.getByText('编译器输出已截断。')).toBeTruthy()
  })
})
