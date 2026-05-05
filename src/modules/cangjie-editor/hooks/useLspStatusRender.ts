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
  const loadedModules = status.stdlibModulesLoaded
  const totalModules = status.stdlibModulesTotal
  const lastError = status.lastError
  const moduleInfo = i18n._(
    msg`标准库模块：${loadedModules}/${totalModules}`,
  )
  const originSuffix = status.origin === 'manual' ? i18n._(msg`（手动）`) : ''

  switch (status.state) {
    case 'running':
      return {
        icon: 'ready',
        ariaLabel: i18n._(msg`LSP 已就绪`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：就绪${originSuffix}\n${moduleInfo}\n\n点击查看操作`),
      }
    case 'starting':
      return {
        icon: 'spinner',
        ariaLabel: i18n._(msg`LSP 启动中`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：启动中${originSuffix}\n${moduleInfo}`),
      }
    case 'restarting':
      return {
        icon: 'spinner',
        ariaLabel: i18n._(msg`LSP 重启中`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：重启中${originSuffix}\n${moduleInfo}`),
      }
    case 'stopping':
      return {
        icon: 'spinner',
        ariaLabel: i18n._(msg`LSP 停止中`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：停止中${originSuffix}`),
      }
    case 'stopped':
      return {
        icon: status.manuallyStopped ? 'manual-stopped' : 'stopped',
        ariaLabel: status.manuallyStopped
          ? i18n._(msg`LSP 已手动停止`)
          : i18n._(msg`LSP 已停止`),
        tooltip: status.manuallyStopped
          ? i18n._(msg`仓颉语言服务器\n\n状态：已停止（手动）\n\n点击查看操作`)
          : i18n._(msg`仓颉语言服务器\n\n状态：已停止\n\n点击查看操作`),
      }
    case 'crashed': {
      const exhausted = status.autoRestartAttempts >= MAX_AUTO_RESTART_ATTEMPTS
      const errLine = lastError ? i18n._(msg`\n错误：${lastError}`) : ''
      return {
        icon: 'crashed',
        ariaLabel: i18n._(msg`LSP 崩溃`),
        tooltip: exhausted
          ? i18n._(msg`仓颉语言服务器\n\n状态：崩溃（自动重启已耗尽）${errLine}\n\n点击手动重启`)
          : i18n._(msg`仓颉语言服务器\n\n状态：崩溃 — 将自动重启${errLine}\n\n点击查看操作`),
      }
    }
  }
}
