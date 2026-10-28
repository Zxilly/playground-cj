import * as React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { PlaygroundHeader } from './PlaygroundHeader'
import { usePlaygroundStore } from '@/stores/playground'

function MockLanguageSelector() {
  return <div>Language Selector</div>
}
function MockExamplesDropdown({ action, disabled }: { action: (code: string) => void, disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={() => action('main() { println("example") }')}>Examples Dropdown</button>
}
function MockShareButton() {
  return <button type="button">Share</button>
}

vi.mock('./LanguageSelector', () => ({ LanguageSelector: MockLanguageSelector }))
vi.mock('./ExamplesDropdown', () => ({ ExamplesDropdown: MockExamplesDropdown }))
vi.mock('./ShareButton', () => ({ default: MockShareButton }))

afterEach(() => {
  cleanup()
  usePlaygroundStore.getState().setEditor(undefined)
  usePlaygroundStore.getState().setRunning(false)
})

function renderHeader() {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  const run = vi.fn()
  const format = vi.fn()
  render(
    <I18nProvider i18n={i18n}>
      <PlaygroundHeader
        brand={<h1>仓颉 Playground</h1>}
        tourLink={<a href="https://tour.cj.zxilly.dev/zh">教程</a>}
        handleRun={run}
        handleFormat={format}
      />
    </I18nProvider>,
  )
  return { run, format }
}

describe('playground header', () => {
  it('renders server-provided navigation and one set of controls at every width', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: '教程' }).getAttribute('href')).toBe('https://tour.cj.zxilly.dev/zh')
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: '运行' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '运行' }).className).toContain('min-h-11')
  })

  it('enables editor actions only after the editor has loaded', () => {
    const { run, format } = renderHeader()
    expect((screen.getByRole('button', { name: '运行' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '格式化' }) as HTMLButtonElement).disabled).toBe(true)
    act(() => usePlaygroundStore.getState().setEditor({} as monaco.editor.IStandaloneCodeEditor))
    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    fireEvent.click(screen.getByRole('button', { name: '格式化' }))
    expect(run).toHaveBeenCalledOnce()
    expect(format).toHaveBeenCalledOnce()
  })

  it('replaces the current source with an undoable edit when an example is selected', () => {
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
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: 'Examples Dropdown' }))

    expect(source).toBe('main() { println("example") }')
    expect(editor.executeEdits).toHaveBeenCalledWith('playground.example', [{ range, text: source }])
    expect(editor.pushUndoStop).toHaveBeenCalledTimes(2)
    expect(editor.pushUndoStop.mock.invocationCallOrder[0]).toBeLessThan(editor.executeEdits.mock.invocationCallOrder[0])
    expect(editor.pushUndoStop.mock.invocationCallOrder[1]).toBeGreaterThan(editor.executeEdits.mock.invocationCallOrder[0])
    expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 1 })
    expect(editor.revealLine).toHaveBeenCalledWith(1)
  })

  it('shows and disables the running action until the current run finishes', () => {
    usePlaygroundStore.getState().setEditor({} as monaco.editor.IStandaloneCodeEditor)
    const { run } = renderHeader()
    act(() => usePlaygroundStore.getState().setRunning(true))
    const running = screen.getByRole('button', { name: '运行中' }) as HTMLButtonElement
    expect(running.disabled).toBe(true)
    expect(running.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(running)
    expect(run).not.toHaveBeenCalled()
    act(() => usePlaygroundStore.getState().setRunning(false))
    expect((screen.getByRole('button', { name: '运行' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
