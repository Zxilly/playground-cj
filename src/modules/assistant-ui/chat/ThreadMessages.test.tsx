import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassroomActivity, MessageError } from './ThreadMessages'

const auiStateMocks = vi.hoisted(() => ({
  messageStatus: 'running',
}))

function MockMessageErrorSlot({ children }: { children?: ReactNode }) {
  return <div data-testid="message-error-slot">{children}</div>
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

  it('shows a generic chat error without exposing internal failures', () => {
    render(<MessageError />, { wrapper: Wrapper })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('课堂老师暂时无法完成这次回复')
    expect(alert.textContent).not.toContain('model request timed out')

    const retry = screen.getByRole('button', { name: '重新生成' })
    expect(screen.getByTestId('reload-action').contains(retry)).toBe(true)
    expect(retry.className).toContain('rounded-md')
    expect(retry.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows only payload-free classroom activity statuses', () => {
    auiStateMocks.messageStatus = 'running'
    render(
      <ClassroomActivity>
        <div>课堂内容已准备</div>
      </ClassroomActivity>,
      { wrapper: Wrapper },
    )

    const disclosure = screen.getByRole('button', { name: '正在准备课堂内容…' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('课堂内容已准备')).toBeNull()

    fireEvent.click(disclosure)
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('课堂内容已准备')).toBeTruthy()
  })
})
