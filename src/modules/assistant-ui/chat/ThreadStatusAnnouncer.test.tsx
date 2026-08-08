import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThreadStatusAnnouncer } from './ThreadStatusAnnouncer'

interface TestThreadState {
  isRunning: boolean
  messages: Array<{
    role: 'assistant' | 'user'
    status?: {
      type: 'complete' | 'incomplete' | 'running'
      reason?: 'cancelled' | 'content-filter' | 'error' | 'length' | 'other' | 'stop' | 'tool-calls' | 'unknown'
    }
  }>
}

const { mockUseAuiState, threadState } = vi.hoisted(() => {
  const threadState: TestThreadState = {
    isRunning: false,
    messages: [],
  }
  const mockUseAuiState = (
    selector: (state: { thread: TestThreadState }) => unknown,
  ) => selector({ thread: threadState })
  return { mockUseAuiState, threadState }
})

vi.mock('@assistant-ui/react', () => ({
  useAuiState: mockUseAuiState,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

afterEach(cleanup)

describe('thread status announcer', () => {
  it('keeps one polite atomic region while the run starts and completes', () => {
    threadState.isRunning = false
    threadState.messages = []
    const { rerender } = render(<ThreadStatusAnnouncer />, { wrapper: Wrapper })
    const status = screen.getByTestId('thread-status-announcer')

    expect(status.textContent).toBe('')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')

    threadState.isRunning = true
    rerender(<ThreadStatusAnnouncer />)
    expect(screen.getByTestId('thread-status-announcer')).toBe(status)
    expect(status.textContent).toBe('老师正在生成回复…')

    threadState.isRunning = false
    threadState.messages = [{
      role: 'assistant',
      status: { type: 'complete', reason: 'stop' },
    }]
    rerender(<ThreadStatusAnnouncer />)
    expect(screen.getByTestId('thread-status-announcer')).toBe(status)
    expect(status.textContent).toBe('老师回复已完成')
  })

  it('leaves failed runs to the existing generic alert instead of duplicating them', () => {
    threadState.isRunning = false
    threadState.messages = [{
      role: 'assistant',
      status: { type: 'incomplete', reason: 'error' },
    }]

    render(<ThreadStatusAnnouncer />, { wrapper: Wrapper })

    expect(screen.getByTestId('thread-status-announcer').textContent).toBe('')
  })
})
