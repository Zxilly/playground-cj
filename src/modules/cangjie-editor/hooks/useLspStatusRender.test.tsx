import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { describe, expect, it } from 'vitest'
import { useLspStatusRender } from '@/modules/cangjie-editor/hooks/useLspStatusRender'
import type { LspRuntimeStatus } from '@/lib/lsp'

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

const baseStatus = {
  state: 'running',
  origin: 'auto',
  manuallyStopped: false,
  autoRestartAttempts: 0,
  stdlibModulesLoaded: 2,
  stdlibModulesTotal: 5,
  generation: 1,
  lastError: undefined,
} satisfies LspRuntimeStatus

function renderStatus(status: Partial<LspRuntimeStatus>) {
  const nextStatus = { ...baseStatus, ...status } as LspRuntimeStatus
  return renderHook(
    () => useLspStatusRender(nextStatus),
    { wrapper: Wrapper },
  ).result.current
}

describe('useLspStatusRender', () => {
  it('describes a running LSP with ready icon and module progress', () => {
    const { result } = renderHook(() => useLspStatusRender(baseStatus), { wrapper: Wrapper })

    expect(result.current.icon).toBe('ready')
    expect(result.current.ariaLabel).toBe('LSP 已就绪')
    expect(result.current.tooltip).toContain('状态：就绪')
    expect(result.current.tooltip).toContain('标准库模块：2/5')
  })

  it('distinguishes manual stops from automatic stops', () => {
    const result = renderStatus({ state: 'stopped', manuallyStopped: true })

    expect(result.icon).toBe('manual-stopped')
    expect(result.ariaLabel).toBe('LSP 已手动停止')
    expect(result.tooltip).toContain('已停止（手动）')
  })

  it('describes automatic stopped status as restartable', () => {
    const result = renderStatus({ state: 'stopped', manuallyStopped: false })

    expect(result.icon).toBe('stopped')
    expect(result.ariaLabel).toBe('LSP 已停止')
    expect(result.tooltip).toContain('点击查看操作')
  })

  it.each([
    ['starting', 'LSP 启动中', '启动中'],
    ['restarting', 'LSP 重启中', '重启中'],
    ['stopping', 'LSP 停止中', '停止中'],
  ] as const)('uses spinner copy for %s state', (state, ariaLabel, tooltipText) => {
    const result = renderStatus({ state })

    expect(result.icon).toBe('spinner')
    expect(result.ariaLabel).toBe(ariaLabel)
    expect(result.tooltip).toContain(tooltipText)
  })

  it('shows exhausted auto restart details for crashed status', () => {
    const result = renderStatus({ state: 'crashed', autoRestartAttempts: 4, lastError: 'boom' })

    expect(result.icon).toBe('crashed')
    expect(result.tooltip).toContain('自动重启已耗尽')
    expect(result.tooltip).toContain('错误：boom')
  })

  it('describes recoverable crashes without an error line', () => {
    const result = renderStatus({ state: 'crashed', autoRestartAttempts: 1, lastError: undefined })

    expect(result.tooltip).toContain('将自动重启')
    expect(result.tooltip).not.toContain('错误：')
  })
})
