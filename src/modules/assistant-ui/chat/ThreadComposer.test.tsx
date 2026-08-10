import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThreadMessage } from '@assistant-ui/react'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { ThreadComposer } from './ThreadComposer'

const assistantState = vi.hoisted(() => ({
  thread: {
    isRunning: false,
    messages: [] as ThreadMessage[],
  },
}))

function MockAuiIf({
  children,
  condition,
}: {
  children: ReactNode
  condition: (state: typeof assistantState) => boolean
}) {
  return condition(assistantState) ? <>{children}</> : null
}

function MockComposerRoot({ children, className }: { children?: ReactNode, className?: string }) {
  return <div className={className}>{children}</div>
}

function MockAttachmentDropzone({ children }: { children?: ReactNode, asChild?: boolean }) {
  return <div data-testid="attachment-dropzone">{children}</div>
}

type MockComposerInputProps = {
  'aria-label'?: string
} & Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, 'autoFocus' | 'className' | 'onChange' | 'placeholder' | 'rows'>

function MockComposerInput(props: MockComposerInputProps) {
  return (
    <textarea
      aria-label={props['aria-label']}
      autoFocus={props.autoFocus}
      className={props.className}
      placeholder={props.placeholder}
      rows={props.rows}
      onChange={props.onChange}
    />
  )
}

function MockComposerSend({ children }: { children?: ReactNode, asChild?: boolean }) {
  return <div data-testid="composer-send-wrapper">{children}</div>
}

function MockComposerCancel({ children }: { children?: ReactNode, asChild?: boolean }) {
  return <div data-testid="composer-cancel-wrapper">{children}</div>
}

function MockComposerAddAttachment() {
  return <button type="button" aria-label="添加附件">添加附件</button>
}

function MockComposerAttachments() {
  return <div data-testid="composer-attachments">attachments</div>
}

function MockUseAuiState(
  selector: (state: typeof assistantState) => unknown,
) {
  return selector(assistantState)
}

function MockTooltipIconButton({
  children,
  tooltip,
  side: _side,
  variant: _variant,
  size: _size,
  ...props
}: {
  children?: ReactNode
  tooltip?: string
  side?: string
  variant?: string
  size?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" title={tooltip} {...props}>{children}</button>
}

function MockButton({
  children,
  variant: _variant,
  size: _size,
  ...props
}: {
  children?: ReactNode
  variant?: string
  size?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props}>{children}</button>
}

vi.mock('@assistant-ui/react', () => ({
  AuiIf: MockAuiIf,
  useAuiState: MockUseAuiState,
  ComposerPrimitive: {
    Root: MockComposerRoot,
    AttachmentDropzone: MockAttachmentDropzone,
    Input: MockComposerInput,
    Send: MockComposerSend,
    Cancel: MockComposerCancel,
  },
}))

vi.mock('@/modules/assistant-ui/registry/Attachment', () => ({
  ComposerAddAttachment: MockComposerAddAttachment,
  ComposerAttachments: MockComposerAttachments,
}))

vi.mock('@/modules/assistant-ui/registry/TooltipIconButton', () => ({
  TooltipIconButton: MockTooltipIconButton,
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

describe('threadComposer', () => {
  beforeEach(() => {
    globalI18n.load({ zh: {} })
    globalI18n.activate('zh')
    assistantState.thread.isRunning = false
    assistantState.thread.messages = []
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps attachment controls available for the generic chat composer by default', () => {
    render(<ThreadComposer />, { wrapper: Wrapper })

    screen.getByRole('button', { name: '添加附件' })
    screen.getByTestId('composer-attachments')
    screen.getByTestId('attachment-dropzone')
    screen.getByLabelText('输入消息')
    screen.getByRole('button', { name: '发送消息' })
  })

  it('removes attachment controls and drag-drop affordance when attachments are disabled', () => {
    render(<ThreadComposer allowAttachments={false} />, { wrapper: Wrapper })

    expect(screen.queryByRole('button', { name: '添加附件' })).toBeNull()
    expect(screen.queryByTestId('composer-attachments')).toBeNull()
    expect(screen.queryByTestId('attachment-dropzone')).toBeNull()
    screen.getByLabelText('输入消息')
    screen.getByRole('button', { name: '发送消息' })
  })

  it('explains cancellation and clears the notice when the message is sent again', () => {
    assistantState.thread.isRunning = true
    assistantState.thread.messages = [{
      id: 'user-1',
      role: 'user',
      content: [{ type: 'text', text: 'Please keep this prompt.' }],
      attachments: [],
      createdAt: new Date(0),
      metadata: { custom: {} },
    }]
    const rendered = render(<ThreadComposer allowAttachments={false} />, { wrapper: Wrapper })

    fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
    expect(screen.getByRole('status').textContent).toBe(
      '已停止生成。消息已放回输入框，你可以修改后重新发送。',
    )
    expect(useWorkspaceStore.getState().cancelledDraft).toBe('Please keep this prompt.')

    assistantState.thread.isRunning = false
    rendered.rerender(<ThreadComposer allowAttachments={false} />)
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(useWorkspaceStore.getState().cancelledDraft).toBeNull()
  })
})
