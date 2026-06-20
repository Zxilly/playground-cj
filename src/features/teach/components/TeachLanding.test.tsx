import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { TeachLanding } from './TeachLanding'

// The landing page calls the LLM bootstrap hook on mount. It performs network
// I/O (fetch /api/ai-key) and store writes that are exercised in its own unit
// test; here we stub it so the landing's gate logic is the unit under test.
const bootstrapMock = vi.hoisted(() => vi.fn(() => ({ status: 'ready' as const })))
vi.mock('@/modules/llm-config/runtime/useLLMConfigBootstrap', () => ({
  useLLMConfigBootstrap: bootstrapMock,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

function configureUserKey(apiKey: string) {
  useLLMConfigStore.getState().setConfig({
    provider: 'openai-compatible',
    baseURL: 'https://api.example.test/v1',
    apiKey,
    model: 'test-model',
  })
}

beforeEach(() => {
  bootstrapMock.mockClear()
  bootstrapMock.mockReturnValue({ status: 'ready' })
  useLLMConfigStore.getState().reset()
  useLLMConfigStore.getState().setSettingsDialogOpen(false)
})

afterEach(() => {
  cleanup()
  useLLMConfigStore.getState().reset()
  useLLMConfigStore.getState().setSettingsDialogOpen(false)
})

describe('teachLanding', () => {
  it('runs the LLM config bootstrap so an automatic key can be fetched', () => {
    render(<TeachLanding onEnter={vi.fn()} />)
    expect(bootstrapMock).toHaveBeenCalled()
  })

  it('disables the enter button until the LLM config is ready', () => {
    // A blank API key (the default auto config) is not ready.
    useLLMConfigStore.setState({ config: { ...DEFAULT_LLM_CONFIG, apiKey: '' } })
    render(<TeachLanding onEnter={vi.fn()} />)
    const enter = screen.getByTestId('teach-landing-enter')
    expect(enter.hasAttribute('disabled')).toBe(true)
  })

  it('enables the enter button and calls onEnter once the config is ready', () => {
    configureUserKey('user-key')
    const onEnter = vi.fn()
    render(<TeachLanding onEnter={onEnter} />)
    const enter = screen.getByTestId('teach-landing-enter')
    expect(enter.hasAttribute('disabled')).toBe(false)
    fireEvent.click(enter)
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('does not call onEnter while the config is not ready', () => {
    useLLMConfigStore.setState({ config: { ...DEFAULT_LLM_CONFIG, apiKey: '' } })
    const onEnter = vi.fn()
    render(<TeachLanding onEnter={onEnter} />)
    fireEvent.click(screen.getByTestId('teach-landing-enter'))
    expect(onEnter).not.toHaveBeenCalled()
  })

  it('opens the LLM config dialog from the configure button', () => {
    useLLMConfigStore.setState({ config: { ...DEFAULT_LLM_CONFIG, apiKey: '' } })
    render(<TeachLanding onEnter={vi.fn()} />)
    fireEvent.click(screen.getByTestId('teach-landing-configure'))
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)
  })

  it('shows the auto key source when using the shared key', () => {
    configureUserKey('user-key')
    // Force back to auto so we exercise the auto branch (setConfig flips to user).
    useLLMConfigStore.setState({ keySource: 'auto' })
    render(<TeachLanding onEnter={vi.fn()} />)
    expect(screen.getByTestId('teach-landing-key-source').textContent).toContain('共享')
  })

  it('shows the user key source when a personal key is configured', () => {
    configureUserKey('user-key')
    render(<TeachLanding onEnter={vi.fn()} />)
    expect(screen.getByTestId('teach-landing-key-source').textContent).toContain('自定义')
  })

  it('prompts to switch to a personal key when the shared quota is exhausted', () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'shared-key' },
      keySource: 'auto',
      autoQuota: { nextResetAt: Date.now() + 60_000, exhausted: true },
    })
    render(<TeachLanding onEnter={vi.fn()} />)
    // Quota exhausted blocks entry even though an api key is present.
    expect(screen.getByTestId('teach-landing-enter').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('teach-landing-quota-exhausted')).toBeTruthy()
  })
})
