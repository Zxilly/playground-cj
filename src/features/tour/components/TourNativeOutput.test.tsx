import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TourNativeOutput } from './TourNativeOutput'

const baseProps = {
  locale: 'en',
  expanded: true,
  revealRequest: 0,
  programOutput: '\x1B[32mhello\x1B[0m',
  compilerOutput: '\x1B[31merror: expected expression\x1B[0m',
  activeTab: 'program' as const,
  onActiveTabChange: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  baseProps.onActiveTabChange.mockReset()
  baseProps.onClose.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('tourNativeOutput', () => {
  it('renders Program and Compiler tabs and preserves ANSI colored output via AnsiOutput', async () => {
    const view = render(<TourNativeOutput {...baseProps} />)

    expect(view.container.querySelector('[data-tour-native-output]')).not.toBeNull()
    const programTab = screen.getByRole('tab', { name: 'Program Output' })
    const compilerTab = screen.getByRole('tab', { name: 'Compiler Output' })
    expect(programTab.getAttribute('aria-selected')).toBe('true')
    expect(compilerTab.getAttribute('aria-selected')).toBe('false')

    expect(await screen.findByText('hello')).toBeDefined()

    fireEvent.click(compilerTab)
    expect(baseProps.onActiveTabChange).toHaveBeenCalledExactlyOnceWith('tool')
  })

  it('displays compiler diagnostics when activeTab is tool and shows localized empty states', async () => {
    const view = render(<TourNativeOutput {...baseProps} activeTab="tool" />)
    expect(await screen.findByText(/expected expression/)).toBeDefined()

    view.rerender(<TourNativeOutput {...baseProps} locale="zh" activeTab="program" programOutput="" />)
    expect(screen.getByText('运行代码后将在此显示程序输出。')).toBeDefined()

    view.rerender(<TourNativeOutput {...baseProps} locale="zh" activeTab="tool" compilerOutput="" />)
    expect(screen.getByText('暂无编译诊断输出。')).toBeDefined()
  })

  it('invokes onClose when the close button is clicked', () => {
    render(<TourNativeOutput {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close output' }))
    expect(baseProps.onClose).toHaveBeenCalledOnce()
  })
})
