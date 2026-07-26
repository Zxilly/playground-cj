'use client'

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { LspRuntimeStatus } from '@/lib/lsp'

const MAX_AUTO_RESTART_ATTEMPTS = 4

export type LspStatusIcon
  = | 'ready'
    | 'spinner'
    | 'stopped'
    | 'manual-stopped'
    | 'crashed'

export interface LspStatusRender {
  icon: LspStatusIcon
  ariaLabel: string
  tooltip: string
}

export function useLspStatusRender(status: LspRuntimeStatus): LspStatusRender {
  const { i18n } = useLingui()
  const originSuffix = status.origin === 'manual' ? i18n._(msg`（手动）`) : ''

  switch (status.state) {
    case 'running':
      return {
        icon: 'ready',
        ariaLabel: i18n._(msg`代码提示已就绪`),
        tooltip: i18n._(msg`仓颉代码提示已就绪${originSuffix}。点击管理。`),
      }
    case 'starting':
      return {
        icon: 'spinner',
        ariaLabel: i18n._(msg`正在启动代码提示`),
        tooltip: i18n._(msg`正在启动仓颉代码提示${originSuffix}。`),
      }
    case 'restarting':
      return {
        icon: 'spinner',
        ariaLabel: i18n._(msg`正在重启代码提示`),
        tooltip: i18n._(msg`正在重启仓颉代码提示${originSuffix}。`),
      }
    case 'stopping':
      return {
        icon: 'spinner',
        ariaLabel: i18n._(msg`正在停止代码提示`),
        tooltip: i18n._(msg`正在停止仓颉代码提示${originSuffix}。`),
      }
    case 'stopped':
      return {
        icon: status.manuallyStopped ? 'manual-stopped' : 'stopped',
        ariaLabel: status.manuallyStopped
          ? i18n._(msg`代码提示已手动停止`)
          : i18n._(msg`代码提示已停止`),
        tooltip: status.manuallyStopped
          ? i18n._(msg`仓颉代码提示已手动停止。点击管理。`)
          : i18n._(msg`仓颉代码提示已停止。点击管理。`),
      }
    case 'crashed': {
      const exhausted = status.autoRestartAttempts >= MAX_AUTO_RESTART_ATTEMPTS
      return {
        icon: 'crashed',
        ariaLabel: i18n._(msg`代码提示暂不可用`),
        tooltip: exhausted
          ? i18n._(msg`仓颉代码提示暂不可用。请手动重启。`)
          : i18n._(msg`仓颉代码提示暂不可用，系统会自动重启。点击管理。`),
      }
    }
  }
}
