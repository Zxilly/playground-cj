import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolFallback } from './ToolFallback'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

afterEach(cleanup)

describe('teacher tool rendering trust boundary', () => {
  it('renders only a payload-free status for completed tool calls', () => {
    const { container } = render(
      <ToolFallback
        type="tool-call"
        toolCallId="tool:1"
        toolName="read_content_pack"
        args={{ secretPrompt: 'do not reveal' }}
        addResult={vi.fn()}
        argsText={'{"secretPrompt":"do not reveal"}'}
        respondToApproval={vi.fn()}
        resume={vi.fn()}
        result={{
          expectedOutput: 'private answer',
          sourceRequirements: ['hidden evaluator rule'],
        }}
        status={{ type: 'complete' }}
      />,
      { wrapper: Wrapper },
    )

    expect(screen.getByText('课堂内容已准备')).toBeTruthy()
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(container.textContent).not.toContain('read_content_pack')
    expect(container.textContent).not.toContain('secretPrompt')
    expect(container.textContent).not.toContain('private answer')
    expect(container.textContent).not.toContain('hidden evaluator rule')
    expect(container.querySelector('[data-slot="tool-fallback-content"]')).toBeNull()
  })

  it('does not render internal tool errors', () => {
    const { container } = render(
      <ToolFallback
        type="tool-call"
        toolCallId="tool:2"
        toolName="search_docs"
        args={{ query: 'learner code' }}
        addResult={vi.fn()}
        argsText={'{"query":"learner code"}'}
        respondToApproval={vi.fn()}
        resume={vi.fn()}
        status={{
          type: 'incomplete',
          reason: 'error',
          error: 'gateway leaked internal credential metadata',
        }}
      />,
      { wrapper: Wrapper },
    )

    expect(screen.getByText('课堂操作失败')).toBeTruthy()
    expect(screen.getByRole('status').className).toContain('text-error-foreground')
    expect(container.textContent).not.toContain('credential')
    expect(container.textContent).not.toContain('learner code')
  })

  it('keeps one status region while a tool call starts and completes', () => {
    const props = {
      type: 'tool-call' as const,
      toolCallId: 'tool:3',
      toolName: 'prepare_lesson',
      args: {},
      addResult: vi.fn(),
      argsText: '{}',
      respondToApproval: vi.fn(),
      resume: vi.fn(),
    }
    const { rerender } = render(
      <ToolFallback {...props} status={{ type: 'running' }} />,
      { wrapper: Wrapper },
    )
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('老师正在准备课堂内容…')

    rerender(<ToolFallback {...props} status={{ type: 'complete' }} />)

    expect(screen.getByRole('status')).toBe(status)
    expect(status.textContent).toBe('课堂内容已准备')
  })
})
