import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChainOfThought, MessageError } from './ThreadMessages'

const auiStateMocks = vi.hoisted(() => ({
  messageStatus: 'running',
}))

function MockMessageErrorSlot({ children }: { children?: ReactNode }) {
  return <div data-testid="message-error-slot">{children}</div>
}

function MockErrorRoot({
  children,
  className,
  role,
}: {
  children?: ReactNode
  className?: string
  role?: string
}) {
  return <div role={role} className={className}>{children}</div>
}

function MockErrorMessage({ className }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className}>
      The model request timed out after waiting for the classroom tools to finish. Check the network and retry the response.
    </div>
  )
}

function MockActionBarRoot({ children, className }: { children?: ReactNode, className?: string, hideWhenRunning?: boolean }) {
  return <div className={className}>{children}</div>
}

function MockActionReload({ children }: { children?: ReactNode, asChild?: boolean }) {
  return <div data-testid="reload-action">{children}</div>
}

function MockButton({
  children,
  className,
  variant: _variant,
  size: _size,
  ...props
}: {
  children?: ReactNode
  className?: string
  variant?: string
  size?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  )
}

function MockBranchPicker() {
  return <div data-testid="branch-picker" />
}

function MockMarkdownText() {
  return <div data-testid="markdown-text" />
}

function MockTooltipIconButton({ children }: { children?: ReactNode }) {
  return <button type="button">{children}</button>
}

function MockUserMessageAttachments() {
  return null
}

function MockUseAuiState(selector: (state: unknown) => unknown) {
  return selector({
    message: { status: { type: auiStateMocks.messageStatus } },
  })
}

vi.mock('@assistant-ui/react', () => ({
  ActionBarPrimitive: {
    Reload: MockActionReload,
    Root: MockActionBarRoot,
  },
  ErrorPrimitive: {
    Message: MockErrorMessage,
    Root: MockErrorRoot,
  },
  MessagePrimitive: {
    Error: MockMessageErrorSlot,
  },
  useAuiState: MockUseAuiState,
}))

vi.mock('@/components/ui/button', () => ({
  Button: MockButton,
}))

vi.mock('@/modules/assistant-ui/chat/BranchPicker', () => ({
  BranchPicker: MockBranchPicker,
}))

vi.mock('@/modules/assistant-ui/registry/MarkdownText', () => ({
  MarkdownText: MockMarkdownText,
}))

vi.mock('@/modules/assistant-ui/registry/TooltipIconButton', () => ({
  TooltipIconButton: MockTooltipIconButton,
}))

vi.mock('@/modules/assistant-ui/registry/Attachment', () => ({
  UserMessageAttachments: MockUserMessageAttachments,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

describe('threadMessages', () => {
  beforeEach(() => {
    globalI18n.load({ zh: {} })
    globalI18n.activate('zh')
  })

  afterEach(() => {
    cleanup()
  })

  it('shows readable chat errors with an inline retry action', () => {
    render(<MessageError />, { wrapper: Wrapper })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('The model request timed out')
    const message = screen.getByText(/The model request timed out/)
    expect(message.className).toContain('whitespace-pre-wrap')
    expect(message.className).toContain('break-words')
    expect(message.className).not.toContain('line-clamp-2')

    const retry = screen.getByRole('button', { name: '重新生成' })
    expect(screen.getByTestId('reload-action').contains(retry)).toBe(true)
    expect(retry.className).toContain('rounded-md')
    expect(retry.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps live reasoning and tool validation chatter collapsed by default', () => {
    auiStateMocks.messageStatus = 'running'
    render(
      <ChainOfThought>
        <div>internal tool validation detail</div>
      </ChainOfThought>,
      { wrapper: Wrapper },
    )

    const disclosure = screen.getByRole('button', { name: '正在思考…' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('internal tool validation detail')).toBeNull()

    fireEvent.click(disclosure)
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('internal tool validation detail')).toBeTruthy()
  })
})
