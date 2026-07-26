import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ToolFallback } from './ToolFallback'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

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
    expect(container.textContent).not.toContain('credential')
    expect(container.textContent).not.toContain('learner code')
  })
})
