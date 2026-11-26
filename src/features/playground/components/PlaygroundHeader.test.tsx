import * as React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { PlaygroundHeader } from './PlaygroundHeader'
import { usePlaygroundStore } from '@/stores/playground'

function MockExamplesDropdown({
  action,
  disabled,
  selectedLabel,
}: {
  action: (code: string, meta?: { key: string, name: string }) => void
  disabled?: boolean
  selectedLabel?: string | null
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => action('main() { println("example") }', { key: 'array', name: 'Array' })}
    >
      {selectedLabel ?? 'Examples Dropdown'}
    </button>
  )
}
function MockShareButton() {
  return <button type="button">Share</button>
}

vi.mock('./ExamplesDropdown', () => ({ ExamplesDropdown: MockExamplesDropdown }))
vi.mock('./ShareButton', () => ({ default: MockShareButton }))
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', systemTheme: 'light', setTheme: vi.fn() }),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/zh',
}))

afterEach(() => {
  cleanup()
  usePlaygroundStore.getState().setEditor(undefined)
  usePlaygroundStore.getState().setRunning(false)
  usePlaygroundStore.getState().resetOutputs()
  usePlaygroundStore.getState().setExampleSelection('hello-world', 'Hello World', 'example')
})

function renderHeader(overrides: Partial<React.ComponentProps<typeof PlaygroundHeader>> = {}) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  const run = vi.fn()
  const format = vi.fn()
  const cancelRun = vi.fn()
  const expandOutput = vi.fn()
  render(
    <I18nProvider i18n={i18n}>
      <PlaygroundHeader
        brand={<h1>仓颉 Playground</h1>}
        handleRun={run}
        handleCancelRun={cancelRun}
        handleFormat={format}
        onExpandOutput={expandOutput}
        {...overrides}
      />
    </I18nProvider>,
  )
  return { run, format, cancelRun, expandOutput }
}

describe('playground header', () => {
  it('renders unified app-shell navigation (Playground, Tour, AI Classroom), theme toggle, and locale switch', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: 'Playground' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: '仓颉之旅' }).getAttribute('href')).toContain('/zh/tour')
    expect(screen.getByRole('link', { name: 'AI 课堂' }).getAttribute('href')).toContain('/zh/tour/ai')
    expect(screen.getByRole('button', { name: /切换主题/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Switch to English' })).toBeTruthy()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: '运行' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '运行' }).className).toContain('min-h-11')
  })

  it('enables editor actions only after the editor has loaded', () => {
    const { run, format } = renderHeader()
    expect((screen.getByRole('button', { name: '运行' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '格式化' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '重置代码' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '下载 .cj' }) as HTMLButtonElement).disabled).toBe(true)
    act(() => usePlaygroundStore.getState().setEditor({} as monaco.editor.IStandaloneCodeEditor))
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    fireEvent.click(screen.getByRole('button', { name: '格式化' }))
    expect(run).toHaveBeenCalledOnce()
    expect(format).toHaveBeenCalledOnce()
  })

  it('replaces source with an undoable edit and clears previous outputs when an example is selected', () => {
    let source = 'main() { println("my draft") }'
    const range = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: source.length + 1 }
    const editor = {
      getModel: () => ({ getFullModelRange: () => range }),
      pushUndoStop: vi.fn(),
      executeEdits: vi.fn((_source, edits) => { source = edits[0].text }),
      setPosition: vi.fn(),
      revealLine: vi.fn(),
    }
    usePlaygroundStore.getState().setEditor(editor as unknown as monaco.editor.IStandaloneCodeEditor)
    usePlaygroundStore.getState().setToolOutput('stale compiler output')
    usePlaygroundStore.getState().setProgramOutput('stale program output')
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Hello World' }))

    expect(source).toBe('main() { println("example") }')
    expect(editor.executeEdits).toHaveBeenCalledWith('playground.example', [{ range, text: source }])
    expect(editor.pushUndoStop).toHaveBeenCalledTimes(2)
    expect(editor.pushUndoStop.mock.invocationCallOrder[0]).toBeLessThan(editor.executeEdits.mock.invocationCallOrder[0])
    expect(editor.pushUndoStop.mock.invocationCallOrder[1]).toBeGreaterThan(editor.executeEdits.mock.invocationCallOrder[0])
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 1 })
    expect(editor.revealLine).toHaveBeenCalledWith(1)
    expect(usePlaygroundStore.getState().toolOutput).toBe('')
    expect(usePlaygroundStore.getState().programOutput).toBe('')
    expect(usePlaygroundStore.getState().runResult).toBeNull()
  })

  it('shows running indicator and clickable cancel button while running, plus expand button when output is collapsed', () => {
    usePlaygroundStore.getState().setEditor({} as monaco.editor.IStandaloneCodeEditor)
    const { run, cancelRun, expandOutput } = renderHeader({ outputCollapsed: true })

    fireEvent.click(screen.getByRole('button', { name: '展开输出' }))
    expect(expandOutput).toHaveBeenCalledOnce()

    act(() => usePlaygroundStore.getState().setRunning(true))
    const running = screen.getByRole('button', { name: '运行中' }) as HTMLButtonElement
    expect(running.disabled).toBe(true)
    expect(running.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(running)
    expect(run).not.toHaveBeenCalled()

    const cancel = screen.getByRole('button', { name: '取消运行' })
    fireEvent.click(cancel)
    expect(cancelRun).toHaveBeenCalledOnce()

    act(() => usePlaygroundStore.getState().setRunning(false))
    expect((screen.getByRole('button', { name: '运行' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
