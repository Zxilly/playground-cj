import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ClassroomQuotaBanner } from './ClassroomQuotaBanner'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'

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

describe('classroomQuotaBanner', () => {
  afterEach(() => {
    cleanup()
    useLLMConfigStore.getState().reset()
  })

  it('keeps the recovery action reachable on narrow screens', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })

    render(<ClassroomQuotaBanner />, { wrapper: Wrapper })

    const banner = screen.getByTestId('classroom-quota-banner')
    expect(banner.getAttribute('role')).toBe('region')
    const titleId = banner.getAttribute('aria-labelledby')
    const detailId = banner.getAttribute('aria-describedby')
    expect(titleId).toBeTruthy()
    expect(detailId).toBeTruthy()
    expect(document.getElementById(titleId!)?.textContent).toBe('今日共享额度已用完，暂时无法准备新的课堂内容。')
    expect(document.getElementById(detailId!)?.textContent).toContain('你仍可以复习已有内容、做练习题')
    expect(banner.className).toContain('items-start')
    expect(banner.className).toContain('min-w-0')
    expect(banner.className).toContain('border-classroom-warning-border')
    expect(banner.className).toContain('bg-classroom-warning-bg')
    expect(banner.className).toContain('text-classroom-warning-fg')
    expect(banner.className).not.toContain('amber-')
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.className).toContain('min-w-0')
    expect(status.className).toContain('flex-1')
    expect(status.textContent).toContain('今日共享额度已用完，暂时无法准备新的课堂内容。')
    expect(status.textContent).toContain('使用自己的 API Key 可立刻继续。')
    expect(document.getElementById(titleId!)?.className).toContain('break-words')
    expect(document.getElementById(detailId!)?.className).toContain('break-words')

    const action = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(action.className).toContain('w-full')
    expect(action.className).toContain('max-w-full')
    expect(action.className).toContain('text-left')
    expect(action.className).toContain('border-classroom-warning-border')
    expect(action.className).toContain('text-classroom-warning-fg')
    expect(action.className).not.toContain('amber-')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(action.querySelector('span')?.className).toContain('break-words')
    expect(action.getAttribute('aria-describedby')).toBe(detailId)
    expect(action.getAttribute('title')).toContain('打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的 AI 请求。')
    expect(action.getAttribute('title')).toContain('共享额度下次刷新：')
    expect(document.getElementById(action.getAttribute('aria-describedby')!)?.textContent).toContain('刷新后课堂会自动继续准备新的 AI 内容')

    fireEvent.click(action)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for shared quota recovery boundaries', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })

    render(<ClassroomQuotaBanner />, { wrapper: EnWrapper })

    const banner = screen.getByTestId('classroom-quota-banner')
    const titleId = banner.getAttribute('aria-labelledby')
    const detailId = banner.getAttribute('aria-describedby')
    expect(document.getElementById(titleId!)?.textContent).toBe('Today\'s shared quota is exhausted, so new classroom content cannot be prepared temporarily.')
    expect(document.getElementById(detailId!)?.textContent).toContain('You can still review existing content, work on exercises, and inspect test results.')
    expect(document.getElementById(detailId!)?.textContent).toContain('After refresh, the classroom will automatically continue preparing new AI content; use your own API Key to continue immediately.')

    const action = screen.getByRole('button', { name: 'Use your own API Key' })
    expect(action.getAttribute('aria-describedby')).toBe(detailId)
    expect(action.getAttribute('title')).toContain('Open AI service settings and switch to your own API Key to continue immediately. This will not queue a new AI request.')
    expect(action.getAttribute('title')).toContain('Shared quota refreshes next at')
    expect(banner.textContent).not.toContain('今日共享额度')
    expect(banner.textContent).not.toContain('复习已有内容')

    fireEvent.click(action)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses instance-scoped ids when multiple quota banners render', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })

    render(
      <>
        <ClassroomQuotaBanner />
        <ClassroomQuotaBanner />
      </>,
      { wrapper: Wrapper },
    )

    const banners = screen.getAllByTestId('classroom-quota-banner')
    const actions = screen.getAllByRole('button', { name: '使用自己的 API Key' })
    const titleIds = banners.map(banner => banner.getAttribute('aria-labelledby'))
    const detailIds = banners.map(banner => banner.getAttribute('aria-describedby'))

    expect(new Set(titleIds).size).toBe(2)
    expect(new Set(detailIds).size).toBe(2)
    banners.forEach((banner, index) => {
      expect(document.getElementById(titleIds[index]!)).not.toBeNull()
      expect(document.getElementById(detailIds[index]!)).not.toBeNull()
      expect(actions[index].getAttribute('aria-describedby')).toBe(detailIds[index])
      expect(banner.getAttribute('aria-describedby')).toBe(detailIds[index])
    })
  })
})
