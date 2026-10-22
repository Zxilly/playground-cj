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
function MockExamplesDropdown() {
  return <div>Examples Dropdown</div>
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
        wrapperRef={{ current: undefined }}
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
})
