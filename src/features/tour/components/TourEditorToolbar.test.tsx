import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestI18nProvider } from '@/modules/i18n/test-i18n'
import { TourEditorToolbar } from './TourEditorToolbar'

function render(ui: ReactElement<{ locale?: string }>) {
  const locale = ui.props.locale === 'en' ? 'en' : 'zh'
  return rtlRender(<TestI18nProvider locale={locale}>{ui}</TestI18nProvider>)
}

afterEach(() => {
  cleanup()
})

describe('tourEditorToolbar', () => {
  it('renders Run, explicit Reset, Format, and Output toggle buttons with synced Ctrl + Enter hint', () => {
    const outputToggleRef = createRef<HTMLElement | null>()
    const onRun = vi.fn()
    const onFormat = vi.fn()
    const onReset = vi.fn()
    const onToggleOutput = vi.fn()

    render(
      <TourEditorToolbar
        locale="zh"
        ready
        running={false}
        outputExpanded={false}
        outputToggleRef={outputToggleRef}
        onToggleOutput={onToggleOutput}
        onRun={onRun}
        onFormat={onFormat}
        onReset={onReset}
      />,
    )

    const runButton = screen.getByRole('button', { name: '运行' })
    const resetButton = screen.getByRole('button', { name: '重置' })
    const formatButton = screen.getByRole('button', { name: '格式化' })
    const outputButton = screen.getByRole('button', { name: '展开输出' })

    expect(runButton.getAttribute('data-tour-highlight')).toBe('run')
    expect(outputToggleRef.current).toBe(outputButton)
    expect(outputButton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('Ctrl + Enter')).toBeDefined()

    fireEvent.click(runButton)
    fireEvent.click(resetButton)
    fireEvent.click(formatButton)
    fireEvent.click(outputButton)

    expect(onRun).toHaveBeenCalledOnce()
    expect(onReset).toHaveBeenCalledOnce()
    expect(onFormat).toHaveBeenCalledOnce()
    expect(onToggleOutput).toHaveBeenCalledOnce()
  })

  it('disables code actions while editor is loading or running', () => {
    const outputToggleRef = createRef<HTMLElement | null>()
    render(
      <TourEditorToolbar
        locale="en"
        ready
        running
        outputExpanded
        outputToggleRef={outputToggleRef}
        onToggleOutput={vi.fn()}
        onRun={vi.fn()}
        onFormat={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    const runButton = screen.getByRole('button', { name: 'Running' }) as HTMLButtonElement
    const resetButton = screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement
    const formatButton = screen.getByRole('button', { name: 'Format' }) as HTMLButtonElement
    const outputButton = screen.getByRole('button', { name: 'Hide output' }) as HTMLButtonElement

    expect(runButton.disabled).toBe(true)
    expect(runButton.getAttribute('aria-busy')).toBe('true')
    expect(resetButton.disabled).toBe(true)
    expect(formatButton.disabled).toBe(true)
    expect(outputButton.disabled).toBe(false)
    expect(outputButton.getAttribute('aria-expanded')).toBe('true')
  })

  it('renders a clickable cancel button while running when onCancelRun is supplied', () => {
    const outputToggleRef = createRef<HTMLElement | null>()
    const onCancelRun = vi.fn()
    render(
      <TourEditorToolbar
        locale="zh"
        ready
        running
        outputExpanded
        outputToggleRef={outputToggleRef}
        onToggleOutput={vi.fn()}
        onRun={vi.fn()}
        onCancelRun={onCancelRun}
        onFormat={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '取消运行' }))
    expect(onCancelRun).toHaveBeenCalledOnce()
  })
})
