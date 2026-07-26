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
  it('describes running code assistance with ready icon', () => {
    const { result } = renderHook(() => useLspStatusRender(baseStatus), { wrapper: Wrapper })

    expect(result.current.icon).toBe('ready')
    expect(result.current.ariaLabel).toBe('代码提示已就绪')
    expect(result.current.tooltip).toContain('仓颉代码提示已就绪')
  })

  it('distinguishes manual stops from automatic stops', () => {
    const result = renderStatus({ state: 'stopped', manuallyStopped: true })

    expect(result.icon).toBe('manual-stopped')
    expect(result.ariaLabel).toBe('代码提示已手动停止')
    expect(result.tooltip).toContain('仓颉代码提示已手动停止')
  })

  it('describes automatic stopped status as restartable', () => {
    const result = renderStatus({ state: 'stopped', manuallyStopped: false })

    expect(result.icon).toBe('stopped')
    expect(result.ariaLabel).toBe('代码提示已停止')
    expect(result.tooltip).toContain('点击管理')
  })

  it.each([
    ['starting', '正在启动代码提示', '正在启动仓颉代码提示'],
    ['restarting', '正在重启代码提示', '正在重启仓颉代码提示'],
    ['stopping', '正在停止代码提示', '正在停止仓颉代码提示'],
  ] as const)('uses spinner copy for %s state', (state, ariaLabel, tooltipText) => {
    const result = renderStatus({ state })

    expect(result.icon).toBe('spinner')
    expect(result.ariaLabel).toBe(ariaLabel)
    expect(result.tooltip).toContain(tooltipText)
  })

  it('shows exhausted auto restart details for crashed status', () => {
    const result = renderStatus({ state: 'crashed', autoRestartAttempts: 4, lastError: 'boom' })

    expect(result.icon).toBe('crashed')
    expect(result.ariaLabel).toBe('代码提示暂不可用')
    expect(result.tooltip).toContain('请手动重启')
    expect(result.tooltip).not.toContain('boom')
  })

  it('describes recoverable crashes without an error line', () => {
    const result = renderStatus({ state: 'crashed', autoRestartAttempts: 1, lastError: undefined })

    expect(result.tooltip).toContain('系统会自动重启')
  })
})
