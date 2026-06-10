import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { ClassroomWelcomeCard } from './ClassroomWelcomeCard'

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

function describedByText(element: Element): string {
  const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
  return ids.map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ')
}

describe('classroom welcome card', () => {
  afterEach(() => {
    cleanup()
    useLLMConfigStore.getState().reset()
  })

  it('explains the setup action and hides decorative icons before configuration', () => {
    render(<ClassroomWelcomeCard configReady={false} />, { wrapper: Wrapper })

    const card = screen.getByTestId('classroom-welcome-card')
    expect(card.className).toContain('min-w-0')
    card.querySelectorAll('svg').forEach((icon) => {
      expect(icon.getAttribute('aria-hidden')).toBe('true')
    })
    const chip = screen.getByText('AI 课堂').parentElement
    expect(chip?.className).toContain('max-w-full')
    expect(screen.getByText('AI 课堂').className).toContain('break-words')
    const heading = screen.getByRole('heading', { name: '准备开始 AI 课堂' })
    expect(heading.className).toContain('break-words')
    expect(screen.getByText(/AI 课堂会从当前教程主题开始/).className).toContain('break-words')

    const setup = screen.getByRole('button', { name: '配置 AI 服务开始' })
    expect(setup.className).toContain('max-w-full')
    expect(setup.className).toContain('text-left')
    expect(setup.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(setup.querySelector('span')?.className).toContain('break-words')
    expect(describedByText(setup)).toBe('完成服务地址、API Key 和模型配置后即可开始。')
    expect(setup.getAttribute('title')).toBe('打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入课堂、排队 AI 请求或记录学习进度。')
    const progress = screen.getByText('进度')
    expect(progress.closest('span')?.className).toContain('break-words')
    expect(screen.getByText(/来自已看内容、练习提交和复习检查；聊天答疑不会直接判定掌握。/).closest('span')?.className).toContain('break-words')
    expect(screen.getByText('完成服务地址、API Key 和模型配置后即可开始。').className).toContain('break-words')
    fireEvent.click(setup)
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for setup and progress boundaries', () => {
    render(<ClassroomWelcomeCard configReady={false} />, { wrapper: EnWrapper })

    screen.getByRole('heading', { name: 'Ready to start AI Classroom' })
    const setup = screen.getByRole('button', { name: 'Configure AI service to start' })
    expect(describedByText(setup)).toBe('Complete the endpoint, API key, and model configuration to start.')
    expect(setup.getAttribute('title')).toBe('Open AI service settings to complete the service URL, API Key, and model configuration. This will not enter the classroom, queue an AI request, or record learning progress.')
    screen.getByText(/Progress/)
    screen.getByText(/comes from viewed content, exercise submissions, and review checks/)
    screen.getByText(/Chat Q&A does not directly determine mastery/)
    expect(screen.queryByText('来自已看内容、练习提交和复习检查；聊天答疑不会直接判定掌握。')).toBeNull()

    fireEvent.click(setup)

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('announces classroom preparation as a polite status once configuration is ready', () => {
    render(<ClassroomWelcomeCard configReady />, { wrapper: Wrapper })

    const status = screen.getByRole('status')
    expect(status.textContent).toBe('正在准备课堂内容；完成后会显示第一步讲解或练习。')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.className).toContain('max-w-full')
    expect(status.className).toContain('text-left')
    expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(status.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(status.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    expect(status.querySelector('span')?.className).toContain('break-words')
    screen.getByText(/来自已看内容、练习提交和复习检查；聊天答疑不会直接判定掌握。/)
    expect(screen.queryByRole('button', { name: '配置 AI 服务开始' })).toBeNull()
  })

  it('uses compiled English copy for preparation status', () => {
    render(<ClassroomWelcomeCard configReady />, { wrapper: EnWrapper })

    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Preparing classroom content. The first explanation or exercise will appear when it finishes.')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Configure AI service to start' })).toBeNull()
  })

  it('explains shared quota recovery without implying a queued classroom request', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })

    render(<ClassroomWelcomeCard configReady />, { wrapper: Wrapper })

    const action = screen.getByRole('button', { name: '使用自己的 API Key' })
    expect(action.className).toContain('max-w-full')
    expect(action.className).toContain('text-left')
    expect(action.querySelector('svg')?.getAttribute('class')).toContain('shrink-0')
    expect(action.querySelector('span')?.className).toContain('break-words')
    expect(describedByText(action)).toContain('共享额度已用完。下次刷新：')
    expect(describedByText(action)).toContain('使用自己的 API Key 可立刻继续。')
    expect(action.getAttribute('title')).toContain('打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的课堂请求或记录学习进度。')
    expect(action.getAttribute('title')).toContain('共享额度下次刷新：')
    expect(screen.getByText(/共享额度已用完。下次刷新：/).className).toContain('break-words')

    fireEvent.click(action)

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('uses compiled English copy for shared quota recovery', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key', model: 'test-model' },
      keySource: 'auto',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })

    render(<ClassroomWelcomeCard configReady />, { wrapper: EnWrapper })

    const action = screen.getByRole('button', { name: 'Use your own API Key' })
    expect(describedByText(action)).toContain('Shared quota is exhausted. Next refresh:')
    expect(describedByText(action)).toContain('use your own API Key to continue immediately.')
    expect(action.getAttribute('title')).toContain('Open AI service settings and switch to your own API Key to continue immediately.')
    expect(action.getAttribute('title')).toContain('This will not queue a new classroom request or record learning progress.')
    expect(action.getAttribute('title')).toContain('Shared quota refreshes next at')

    fireEvent.click(action)

    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })
})
