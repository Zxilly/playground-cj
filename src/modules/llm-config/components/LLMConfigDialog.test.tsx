import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messages as enMessages } from '@/locales/en/messages.mjs'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'

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
  onOpenChange,
}: {
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  dialogState.onOpenChange = onOpenChange
  return <div>{children}</div>
}

function MockDialogTrigger({ children }: { children: React.ReactElement<{ children?: ReactNode, onClick?: () => void }> }) {
  return (
    <button type="button" aria-label="open llm settings" onClick={() => dialogState.onOpenChange?.(true)}>
      {children.props.children}
    </button>
  )
}

function MockDialogClose({ children }: { children: React.ReactElement<{ children?: ReactNode, onClick?: () => void }> }) {
  return (
    <button type="button" onClick={() => dialogState.onOpenChange?.(false)}>
      {children.props.children}
    </button>
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

function MockInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />
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

function MockLabel({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props}>{children}</label>
}

function describedByText(element: HTMLElement): string {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(id => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ')
}

vi.mock('@/components/ui/dialog', () => ({
  Dialog: MockDialog,
  DialogClose: MockDialogClose,
  DialogContent: MockDialogContent,
  DialogDescription: MockDialogDescription,
  DialogFooter: MockDialogFooter,
  DialogHeader: MockDialogHeader,
  DialogTitle: MockDialogTitle,
  DialogTrigger: MockDialogTrigger,
}))

vi.mock('@/components/ui/input', () => ({
  Input: MockInput,
}))

vi.mock('@/components/ui/label', () => ({
  Label: MockLabel,
}))

vi.mock('@/components/ui/button', () => ({
  Button: MockButton,
}))

describe('llmConfigDialog', () => {
  beforeEach(() => {
    useLLMConfigStore.setState({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      autoQuota: null,
      settingsDialogOpen: false,
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens shared quota settings without exposing the auto key', async () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
    })
    const fetchMock = vi.fn().mockResolvedValue(responseWithUsage({
      total_granted: 5000,
      total_used: 1000,
      total_available: 4000,
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    // The shared tab is selected and only the remaining quota is shown — the
    // specific config (API Key / service address / model / API style) is hidden
    // behind the "自定义 API Key" tab.
    expect(screen.getByRole('tab', { name: '共享额度' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByLabelText('API Key')).toBeNull()
    expect(screen.queryByLabelText('服务地址')).toBeNull()
    expect(screen.queryByLabelText('模型')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anthropic' })).toBeNull()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/usage/token/'),
        expect.objectContaining({ headers: { Authorization: 'Bearer auto-key' } }),
      )
    })
    expect(screen.getByRole('status').textContent).toContain('剩余')
    expect(screen.getByRole('progressbar', { name: '共享额度已使用量' }).getAttribute('aria-valuenow')).toBe('1000')
  })

  it('uses compiled English copy for shared quota settings boundaries', async () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key' },
      keySource: 'auto',
    })
    const fetchMock = vi.fn().mockResolvedValue(responseWithUsage({
      total_granted: 5000,
      total_used: 1000,
      total_available: 4000,
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <EnWrapper>
        <LLMConfigDialog />
      </EnWrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))

    screen.getByRole('heading', { name: 'AI service settings' })
    screen.getByText('Shared quota will be used when no API Key is provided; it is limited and may run out.')
    screen.getByText('Shared quota')
    screen.getByText('Currently using shared quota. To customize the service address, API style, and model, switch to “Custom API Key”.')
    // Shared tab hides the specific config (it lives behind the other tab).
    expect(screen.getByRole('tab', { name: 'Shared quota' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByLabelText('API Key')).toBeNull()
    expect(screen.queryByLabelText('Service address')).toBeNull()
    expect(screen.queryByLabelText('Model')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anthropic' })).toBeNull()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByRole('status').textContent).toContain('Remaining')
    expect(screen.getByRole('progressbar', { name: 'Shared quota usage' }).getAttribute('aria-valuenow')).toBe('1000')
    expect(screen.queryByText('共享额度模式下此项由系统管理；填写自定义 API Key 后可以编辑。')).toBeNull()
  })

  it('saves edited config as a user key and closes through store state', async () => {
    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    fireEvent.click(screen.getByRole('tab', { name: '自定义 API Key' }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'user-key' } })
    expect(screen.getByLabelText('服务地址')).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Anthropic' })).toHaveProperty('disabled', false)
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'https://api.test' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'test-model' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(useLLMConfigStore.getState().keySource).toBe('user')
    })
    expect(useLLMConfigStore.getState().config).toMatchObject({
      baseURL: 'https://api.test',
      apiKey: 'user-key',
      model: 'test-model',
    })
  })

  it('requires endpoint and model before saving a user key', async () => {
    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    fireEvent.click(screen.getByRole('tab', { name: '自定义 API Key' }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'user-key' } })
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: '' } })

    const save = screen.getByRole('button', { name: '保存' })
    expect(save).toHaveProperty('disabled', true)
    expect(describedByText(save)).toBe('使用自定义 API Key 时，需同时配置服务地址与模型。')
    expect(screen.getByLabelText('服务地址').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('模型').getAttribute('aria-invalid')).toBe('true')
    screen.getByRole('alert')
    fireEvent.click(save)

    expect(useLLMConfigStore.getState().keySource).toBe('auto')
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(true)

    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'https://api.test' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'test-model' } })
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)

    await waitFor(() => {
      expect(useLLMConfigStore.getState().keySource).toBe('user')
    })
    expect(useLLMConfigStore.getState().config).toMatchObject({
      baseURL: 'https://api.test',
      apiKey: 'user-key',
      model: 'test-model',
    })
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(false)
  })

  it('uses compiled English copy for incomplete user-key drafts', async () => {
    render(
      <EnWrapper>
        <LLMConfigDialog />
      </EnWrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Custom API Key' }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'user-key' } })
    fireEvent.change(screen.getByLabelText('Service address'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: '' } })

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveProperty('disabled', true)
    expect(describedByText(save)).toBe('A custom API Key also requires a service address and model.')
    screen.getByRole('alert')
    screen.getByText('A custom API Key also requires a service address and model.')
    expect(screen.queryByText('填写自定义 API Key 时，还需要服务地址和模型。')).toBeNull()
  })

  it('saves a blank API key as shared quota mode', async () => {
    useLLMConfigStore.setState({
      config: {
        provider: 'anthropic',
        baseURL: 'https://api.anthropic.test/v1',
        apiKey: 'user-key',
        model: 'claude-test',
      },
      keySource: 'user',
      autoQuota: { exhausted: true, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })

    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(useLLMConfigStore.getState().keySource).toBe('auto')
    })
    expect(useLLMConfigStore.getState().config).toEqual(DEFAULT_LLM_CONFIG)
    expect(useLLMConfigStore.getState().autoQuota).toBeNull()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(false)
  })

  it('keeps resetting defaults as a draft until the learner saves', async () => {
    useLLMConfigStore.setState({
      config: {
        provider: 'anthropic',
        baseURL: 'https://api.anthropic.test/v1',
        apiKey: 'user-key',
        model: 'claude-test',
      },
      keySource: 'user',
      autoQuota: null,
      settingsDialogOpen: false,
    })

    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    const resetButton = screen.getByRole('button', { name: '重置默认' })
    expect(describedByText(resetButton)).toBe('仅重置当前表单；保存后生效，取消则保留原配置。')

    fireEvent.click(resetButton)
    // Reset returns to the shared tab, so the API Key field is hidden again.
    expect(screen.queryByLabelText('API Key')).toBeNull()
    screen.getByText('已切换为共享额度（草稿）；保存后替换当前 API Key，取消则保留原配置。')
    expect(useLLMConfigStore.getState().keySource).toBe('user')
    expect(useLLMConfigStore.getState().config.apiKey).toBe('user-key')

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(useLLMConfigStore.getState().keySource).toBe('user')
    expect(useLLMConfigStore.getState().config.apiKey).toBe('user-key')

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    expect(screen.getByLabelText('API Key')).toHaveProperty('value', 'user-key')

    fireEvent.click(screen.getByRole('button', { name: '重置默认' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(useLLMConfigStore.getState().keySource).toBe('auto')
    })
    expect(useLLMConfigStore.getState().config).toEqual(DEFAULT_LLM_CONFIG)
  })

  it('uses compiled English copy when resetting a user key to a shared-quota draft', async () => {
    useLLMConfigStore.setState({
      config: {
        provider: 'anthropic',
        baseURL: 'https://api.anthropic.test/v1',
        apiKey: 'user-key',
        model: 'claude-test',
      },
      keySource: 'user',
      autoQuota: null,
      settingsDialogOpen: false,
    })

    render(
      <EnWrapper>
        <LLMConfigDialog />
      </EnWrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    const resetButton = screen.getByRole('button', { name: 'Reset defaults' })
    expect(describedByText(resetButton)).toBe('Only resets the current form. It takes effect after Save; Cancel keeps the current settings.')

    fireEvent.click(resetButton)
    expect(screen.queryByLabelText('API Key')).toBeNull()
    screen.getByText('Switched to a shared quota draft. Save to replace the current API Key, or Cancel to keep the original settings.')
    expect(screen.queryByText('已切回共享额度草稿；点击保存才会替换当前 API Key，取消会保留原设置。')).toBeNull()
    expect(useLLMConfigStore.getState().keySource).toBe('user')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useLLMConfigStore.getState().config.apiKey).toBe('user-key')
  })

  it('keeps shared quota semantics when saving an auto-key dialog without a user key', async () => {
    useLLMConfigStore.setState({
      config: {
        provider: 'anthropic',
        baseURL: 'https://api.anthropic.test/v1',
        apiKey: 'auto-key',
        model: 'auto-model',
      },
      keySource: 'auto',
      autoQuota: { exhausted: false, nextResetAt: 1_700_000_000_000 },
      settingsDialogOpen: false,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithUsage({
      total_granted: 5000,
      total_used: 1000,
      total_available: 4000,
    })))

    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    // Opens on the shared tab (auto key source); saving keeps shared semantics.
    expect(screen.getByRole('tab', { name: '共享额度' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(useLLMConfigStore.getState().keySource).toBe('auto')
    })
    expect(useLLMConfigStore.getState().config).toEqual(DEFAULT_LLM_CONFIG)
    expect(useLLMConfigStore.getState().autoQuota).toBeNull()
    expect(useLLMConfigStore.getState().settingsDialogOpen).toBe(false)
  })

  it('shows a fresh loading state when fetching usage for a new auto key', async () => {
    useLLMConfigStore.setState({
      config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key-1' },
      keySource: 'auto',
    })
    const secondUsage = deferred<Response>()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responseWithUsage({ total_granted: 5000, total_used: 1000, total_available: 4000 }))
      .mockReturnValueOnce(secondUsage.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    await waitFor(() => expect(screen.getByText('$0.0080')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    act(() => {
      useLLMConfigStore.setState({
        config: { ...DEFAULT_LLM_CONFIG, apiKey: 'auto-key-2' },
        keySource: 'auto',
      })
    })
    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))

    expect(screen.getByText('正在加载剩余额度…')).toBeTruthy()
    expect(screen.queryByText('$0.0080')).toBeNull()

    secondUsage.resolve(responseWithUsage({ total_granted: 8000, total_used: 2000, total_available: 6000 }))
    await waitFor(() => expect(screen.getByText('$0.0120')).toBeTruthy())
  })
})

function responseWithUsage(data: { total_granted: number, total_used: number, total_available: number }) {
  return {
    ok: true,
    json: async () => ({ data }),
  } as Response
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
