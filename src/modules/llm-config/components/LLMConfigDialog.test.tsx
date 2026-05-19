import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'

const dialogState = vi.hoisted(() => ({
  onOpenChange: undefined as undefined | ((open: boolean) => void),
}))

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
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
  onClick,
  type = 'button',
}: {
  children?: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}) {
  return <button type={type} onClick={onClick}>{children}</button>
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

  it('opens with the current auto-key configuration and shared quota badge', () => {
    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('共享额度')).toBeTruthy()
    expect(screen.getByLabelText('API Base')).toHaveProperty('value', DEFAULT_LLM_CONFIG.baseURL)
    expect(screen.getByLabelText('Model')).toHaveProperty('value', DEFAULT_LLM_CONFIG.model)
  })

  it('saves edited config as a user key and closes through store state', async () => {
    render(
      <Wrapper>
        <LLMConfigDialog />
      </Wrapper>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'open llm settings' }))
    fireEvent.change(screen.getByLabelText('API Base'), { target: { value: 'https://api.test' } })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'user-key' } })
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'test-model' } })
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
