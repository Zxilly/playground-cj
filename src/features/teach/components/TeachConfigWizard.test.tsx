import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { TeachConfigWizard } from './TeachConfigWizard'

// The wizard calls the LLM bootstrap hook on mount. It performs network I/O
// (fetch /api/ai-gateway/metadata) and store writes exercised in its own unit test; here we
// stub it so the wizard's source/credentials flow is the unit under test.
const bootstrapMock = vi.hoisted(() => vi.fn(
  (): { status: 'loading' | 'ready' | 'error', error?: string } => ({ status: 'ready' }),
))
vi.mock('@/modules/llm-config/runtime/useLLMConfigBootstrap', () => ({
  useLLMConfigBootstrap: bootstrapMock,
}))

const sharedQuotaMock = vi.hoisted(() => vi.fn(() => ({ percent: null as number | null, loading: false })))
vi.mock('@/modules/llm-config/runtime/useSharedQuota', () => ({
  useSharedQuota: sharedQuotaMock,
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function renderWizard(onEnter = vi.fn(), onBack = vi.fn()) {
  const ui: ReactElement = <TeachConfigWizard onEnter={onEnter} onBack={onBack} />
  return { onEnter, onBack, ...rtlRender(ui, { wrapper: Wrapper }) }
}

/** Seed a complete personal key (flips keySource to 'user'). */
function configureUserKey(apiKey: string) {
  useLLMConfigStore.getState().setConfig({
    provider: 'openai-compatible',
    baseURL: 'https://api.example.test/v1',
    apiKey,
    model: 'test-model',
  })
}

/** Seed a ready shared gateway (keySource stays 'auto'). */
function seedSharedReady() {
  useLLMConfigStore.setState({ config: DEFAULT_LLM_CONFIG, keySource: 'auto' })
}

beforeEach(() => {
  bootstrapMock.mockClear()
  bootstrapMock.mockReturnValue({ status: 'ready' })
  sharedQuotaMock.mockClear()
  sharedQuotaMock.mockReturnValue({ percent: null, loading: false })
  useLLMConfigStore.getState().reset()
})

afterEach(() => {
  cleanup()
  useLLMConfigStore.getState().reset()
})

describe('teachConfigWizard', () => {
  it('runs the LLM config bootstrap so gateway metadata can be fetched', () => {
    renderWizard()
    expect(bootstrapMock).toHaveBeenCalled()
  })

  it('defaults to the shared source and enters directly once the shared gateway is ready', () => {
    seedSharedReady()
    const { onEnter } = renderWizard()
    expect(screen.getByTestId('teach-source-shared').getAttribute('aria-checked')).toBe('true')
    const next = screen.getByTestId('teach-source-next')
    expect(next.hasAttribute('disabled')).toBe(false)
    fireEvent.click(next)
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('shows the live remaining shared quota as a percentage when ready', () => {
    sharedQuotaMock.mockReturnValue({ percent: 75, loading: false })
    seedSharedReady()
    renderWizard()
    expect(screen.getByText('75%')).toBeTruthy()
  })

  it('shows the quota meter (with a spinner) while the live probe is loading', () => {
    sharedQuotaMock.mockReturnValue({ percent: null, loading: true })
    seedSharedReady()
    renderWizard()
    expect(screen.getByText('今日额度剩余')).toBeTruthy()
  })

  it('blocks entry while shared gateway metadata is still loading', () => {
    bootstrapMock.mockReturnValue({ status: 'loading' })
    useLLMConfigStore.setState({ config: DEFAULT_LLM_CONFIG, keySource: 'auto' })
    const { onEnter } = renderWizard()
    const next = screen.getByTestId('teach-source-next')
    expect(next.hasAttribute('disabled')).toBe(true)
    fireEvent.click(next)
    expect(onEnter).not.toHaveBeenCalled()
  })

  it('prompts to switch to a personal key when the shared quota is exhausted', () => {
    useLLMConfigStore.setState({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      autoQuota: {
        nextResetAt: Date.now() + 60_000,
        perPeriod: 1_000_000,
        available: 0,
        exhausted: true,
      },
    })
    renderWizard()
    expect(screen.getByTestId('teach-config-quota-exhausted')).toBeTruthy()
    expect(screen.getByTestId('teach-source-next').hasAttribute('disabled')).toBe(true)
  })

  it('walks the custom path: pick custom, fill the key, then enter', () => {
    useLLMConfigStore.setState({ config: DEFAULT_LLM_CONFIG, keySource: 'auto' })
    const { onEnter } = renderWizard()

    fireEvent.click(screen.getByTestId('teach-source-custom'))
    fireEvent.click(screen.getByTestId('teach-source-next'))
    expect(screen.getByTestId('teach-wizard-step-credentials')).toBeTruthy()

    // baseURL + model are seeded from the provider defaults; only the key is missing.
    const enter = screen.getByTestId('teach-config-enter')
    expect(enter.hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'my-key' } })
    expect(enter.hasAttribute('disabled')).toBe(false)

    fireEvent.click(enter)
    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(useLLMConfigStore.getState().config.apiKey).toBe('my-key')
    expect(useLLMConfigStore.getState().keySource).toBe('user')
  })

  it('can step back from credentials to the source choice', () => {
    renderWizard()
    fireEvent.click(screen.getByTestId('teach-source-custom'))
    fireEvent.click(screen.getByTestId('teach-source-next'))
    expect(screen.getByTestId('teach-wizard-step-credentials')).toBeTruthy()
    fireEvent.click(screen.getByTestId('teach-wizard-back'))
    expect(screen.getByTestId('teach-wizard-step-source')).toBeTruthy()
  })

  it('returns to the landing page from the source step', () => {
    const { onBack } = renderWizard()
    fireEvent.click(screen.getByTestId('teach-config-back-landing'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('starts on the custom source when a personal key is already configured', () => {
    configureUserKey('user-key')
    renderWizard()
    expect(screen.getByTestId('teach-source-custom').getAttribute('aria-checked')).toBe('true')
  })

  it('moves and selects the AI source with arrow keys', () => {
    seedSharedReady()
    renderWizard()
    const shared = screen.getByTestId('teach-source-shared')
    const custom = screen.getByTestId('teach-source-custom')

    shared.focus()
    fireEvent.keyDown(shared, { key: 'ArrowDown' })

    expect(document.activeElement).toBe(custom)
    expect(custom.getAttribute('aria-checked')).toBe('true')
    expect(custom.getAttribute('tabindex')).toBe('0')
    expect(shared.getAttribute('tabindex')).toBe('-1')
  })
})
