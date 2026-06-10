import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { QuotaExhaustedDialog } from './QuotaExhaustedDialog'

const dialogState = vi.hoisted(() => ({
  onOpenChange: undefined as undefined | ((open: boolean) => void),
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function EnWrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'en', messages: { en: enMessages } })
  i18n.activate('en')
  globalI18n.load({ en: enMessages })
  globalI18n.activate('en')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function MockDialog({
  children,
  open,
  onOpenChange,
}: {
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  dialogState.onOpenChange = onOpenChange
  return open ? <div>{children}</div> : null
}

function MockDialogClose({ children }: { children: React.ReactElement<{ onClick?: () => void }> }) {
  return (
    <span onClick={() => dialogState.onOpenChange?.(false)}>
      {children}
    </span>
  )
}

function MockButton({
  children,
  size: _size,
  variant: _variant,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string, variant?: string }) {
  return <button {...props}>{children}</button>
}

function MockDialogContent({ children }: { children: ReactNode }) {
  return <div role="dialog">{children}</div>
}

function MockDialogDescription({ children }: { children: ReactNode }) {
  return <p>{children}</p>
}

function MockDialogFooter({ children }: { children: ReactNode }) {
  return <footer>{children}</footer>
}

function MockDialogHeader({ children }: { children: ReactNode }) {
  return <header>{children}</header>
}

function MockDialogTitle({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>
}

vi.mock('@/components/ui/dialog', () => ({
  Dialog: MockDialog,
  DialogClose: MockDialogClose,
  DialogContent: MockDialogContent,
  DialogDescription: MockDialogDescription,
  DialogFooter: MockDialogFooter,
  DialogHeader: MockDialogHeader,
  DialogTitle: MockDialogTitle,
}))

vi.mock('@/components/ui/button', () => ({
  Button: MockButton,
}))

function describedByText(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids
    .map(id => document.getElementById(id)?.textContent?.trim() ?? '')
    .join(' ')
}

describe('quotaExhaustedDialog', () => {
  beforeEach(() => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: Date.now() + 90 * 60_000 },
      settingsDialogOpen: false,
    })
  })

  afterEach(() => {
    cleanup()
    useLLMConfigStore.getState().reset()
  })

  it('explains dismiss and settings recovery actions without hiding the reset status', () => {
    render(<QuotaExhaustedDialog />, { wrapper: Wrapper })

    screen.getByRole('dialog')
    screen.getByRole('heading', { name: '今日 AI 额度已用完' })
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toContain('约')
    for (const icon of document.querySelectorAll('svg'))
      expect(icon.getAttribute('aria-hidden')).toBe('true')

    const dismiss = screen.getByRole('button', { name: '我知道了' })
    expect(describedByText(dismiss)).toBe('关闭提示后仍可查看当前页面；共享额度刷新后会恢复使用。')

    const settings = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(describedByText(settings)).toContain(status.textContent)
    expect(describedByText(settings)).toContain('打开 AI 服务设置填写自己的 API Key；不会清空已有课堂内容或练习记录。')

    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for quota recovery boundaries', () => {
    render(<QuotaExhaustedDialog />, { wrapper: EnWrapper })

    screen.getByRole('dialog')
    screen.getByRole('heading', { name: 'Daily AI quota exhausted' })
    screen.getByText('Shared quota resets every day at midnight (Beijing time).')
    screen.getByText('To continue right away, enter your own API Key in AI service settings.')
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Refresh in ~')

    const dismiss = screen.getByRole('button', { name: 'Got it' })
    expect(describedByText(dismiss)).toBe('You can keep viewing the current page after closing this notice. Shared quota will recover after the refresh.')

    const settings = screen.getByRole('button', { name: 'Use your own API Key' })
    expect(describedByText(settings)).toContain(status.textContent)
    expect(describedByText(settings)).toContain('Open AI service settings to enter your own API Key. Existing classroom content and practice records will be kept.')
    expect(screen.queryByText('打开 AI 服务设置填写自己的 API Key；不会清空已有课堂内容或练习记录。')).toBeNull()

    fireEvent.click(settings)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })
})
