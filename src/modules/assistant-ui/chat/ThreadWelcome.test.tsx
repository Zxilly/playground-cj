import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThreadWelcome } from './ThreadWelcome'

function MockSuggestions({ children }: { children?: () => ReactNode }) {
  return <>{children?.()}</>
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
    Suggestions: MockSuggestions,
  },
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
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps suggestion cards readable after descriptions are added', () => {
    render(<ThreadWelcome />, { wrapper: Wrapper })

    screen.getByText('可以这样问')
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
})
