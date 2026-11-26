import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThreadWelcome } from './ThreadWelcome'

const auiStateMocks = vi.hoisted(() => ({
  suggestions: [{ title: 'Explain the current focus', prompt: 'Explain the current focus' }],
}))

function MockSuggestions({ children }: { children?: () => ReactNode }) {
  return <>{auiStateMocks.suggestions.length > 0 ? children?.() : null}</>
}

function MockSuggestion({
  children,
  prompt,
}: {
  children?: ReactNode
  prompt: string
  send?: boolean
  asChild?: boolean
}) {
  return <div data-testid="contextual-suggestion" data-prompt={prompt}>{children}</div>
}

function MockSuggestionTrigger({ children }: { children?: ReactNode, send?: boolean, asChild?: boolean }) {
  return <>{children}</>
}

function MockSuggestionTitle({ className }: { className?: string }) {
  return <span className={className}>Explain the current focus</span>
}

function MockSuggestionDescription({ className }: { className?: string }) {
  return <span className={className}>Uses classroom context only.</span>
}

function MockButton({
  children,
  className,
  variant: _variant,
  ...props
}: {
  children?: ReactNode
  className?: string
  variant?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  )
}

vi.mock('@assistant-ui/react', () => ({
  SuggestionPrimitive: {
    Trigger: MockSuggestionTrigger,
    Title: MockSuggestionTitle,
    Description: MockSuggestionDescription,
  },
  ThreadPrimitive: {
    Suggestion: MockSuggestion,
    Suggestions: MockSuggestions,
  },
  useAuiState: (selector: (state: { thread: { suggestions: typeof auiStateMocks.suggestions } }) => unknown) =>
    selector({ thread: { suggestions: auiStateMocks.suggestions } }),
}))

vi.mock('@/components/ui/button', () => ({
  Button: MockButton,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

describe('threadWelcome', () => {
  beforeEach(() => {
    globalI18n.load({ zh: {} })
    globalI18n.activate('zh')
    auiStateMocks.suggestions = [{ title: 'Explain the current focus', prompt: 'Explain the current focus' }]
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps suggestion cards readable after descriptions are added', () => {
    render(<ThreadWelcome />, { wrapper: Wrapper })

    expect(screen.getByRole('heading', { level: 3, name: '可以这样问' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    screen.getByText('可以询问当前概念、练习要求、代码问题，或让讲解更慢一些。')
    const suggestion = screen.getByRole('button', { name: /Explain the current focus/ })
    expect(suggestion.className).toContain('flex-col')
    expect(suggestion.className).toContain('whitespace-normal')
    expect(suggestion.className).toContain('rounded-md')
    expect(suggestion.className).not.toContain('rounded-xl')

    const description = screen.getByText('Uses classroom context only.')
    expect(description.className).toContain('text-xs')
    expect(description.className).toContain('leading-4')
  })

  it('omits the empty prompt heading and grid when there are no suggestions', () => {
    auiStateMocks.suggestions = []
    const { container } = render(<ThreadWelcome />, { wrapper: Wrapper })

    expect(screen.queryByRole('heading', { level: 3, name: '可以这样问' })).toBeNull()
    expect(container.querySelector('.aui-thread-welcome-suggestions')).toBeNull()
    expect(screen.getByText('可以询问当前概念、练习要求、代码问题，或让讲解更慢一些。')).toBeTruthy()
  })

  it('renders contextual quick-ask suggestions passed via props', () => {
    auiStateMocks.suggestions = []
    render(
      <ThreadWelcome
        suggestions={[
          {
            title: '解释当前示例',
            description: '逐行拆解变量绑定与类型推断',
            prompt: '请解释当前代码中的变量绑定与类型推断',
          },
        ]}
      />,
      { wrapper: Wrapper },
    )

    expect(screen.getByRole('heading', { level: 3, name: '可以这样问' })).toBeTruthy()
    const wrapper = screen.getByTestId('contextual-suggestion')
    expect(wrapper.getAttribute('data-prompt')).toBe('请解释当前代码中的变量绑定与类型推断')
    expect(screen.getByRole('button', { name: /解释当前示例/ })).toBeTruthy()
    expect(screen.getByText('逐行拆解变量绑定与类型推断')).toBeTruthy()
  })
})
