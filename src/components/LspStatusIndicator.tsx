'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, CircleSlash, Loader2, Pause, Play, RefreshCw, Square, Trash2 } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  clearCacheAndRestartLsp,
  restartLsp,
  startLsp,
  stopLsp,
  subscribeLspStatus,
} from '@/lib/lsp'
import type { LspRuntimeStatus } from '@/lib/lsp'

const MAX_AUTO_RESTART_ATTEMPTS = 4

const SPINNER = <Loader2 className="h-3.5 w-3.5 animate-spin" />

interface StatusRender {
  icon: React.ReactNode
  ariaLabel: string
  tooltip: string
}

function useStatusRender(status: LspRuntimeStatus): StatusRender {
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
        icon: <Check className="h-3.5 w-3.5" />,
        ariaLabel: i18n._(msg`LSP 已就绪`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：就绪${originSuffix}\n${moduleInfo}\n\n点击查看操作`),
      }
    case 'starting':
      return {
        icon: SPINNER,
        ariaLabel: i18n._(msg`LSP 启动中`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：启动中${originSuffix}\n${moduleInfo}`),
      }
    case 'restarting':
      return {
        icon: SPINNER,
        ariaLabel: i18n._(msg`LSP 重启中`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：重启中${originSuffix}\n${moduleInfo}`),
      }
    case 'stopping':
      return {
        icon: SPINNER,
        ariaLabel: i18n._(msg`LSP 停止中`),
        tooltip: i18n._(msg`仓颉语言服务器\n\n状态：停止中${originSuffix}`),
      }
    case 'stopped':
      return {
        icon: status.manuallyStopped
          ? <CircleSlash className="h-3.5 w-3.5" />
          : <Pause className="h-3.5 w-3.5" />,
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
        icon: <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
        ariaLabel: i18n._(msg`LSP 崩溃`),
        tooltip: exhausted
          ? i18n._(msg`仓颉语言服务器\n\n状态：崩溃（自动重启已耗尽）${errLine}\n\n点击手动重启`)
          : i18n._(msg`仓颉语言服务器\n\n状态：崩溃 — 将自动重启${errLine}\n\n点击查看操作`),
      }
    }
  }
}

interface ActionRowProps {
  icon: React.ReactNode
  label: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  onSelect: () => void
}

function ActionRow({ icon, label, description, disabled, onSelect }: ActionRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-sm text-left w-full text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground focus:outline-none',
        'disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed',
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
        {description && (
          <span className="block text-xs text-muted-foreground truncate">{description}</span>
        )}
      </span>
    </button>
  )
}

export function LspStatusIndicator() {
  const [status, setStatus] = useState<LspRuntimeStatus | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return subscribeLspStatus(setStatus)
  }, [])

  const render = useStatusRender(status ?? {
    state: 'stopped',
    origin: 'auto',
    manuallyStopped: false,
    stdlibModulesLoaded: 0,
    stdlibModulesTotal: 0,
    generation: 0,
    autoRestartAttempts: 0,
  })

  if (!status)
    return null

  const runAction = (fn: () => Promise<void>) => () => {
    setOpen(false)
    void fn()
  }

  const isBusy = status.state === 'starting' || status.state === 'restarting' || status.state === 'stopping'
  const isStopped = status.state === 'stopped'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={render.ariaLabel}
          title={render.tooltip}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 h-full text-xs',
            'hover:bg-black/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'text-(--vscode-statusBar-foreground,#3b3b3b)',
          )}
        >
          {render.icon}
          <span>Cangjie</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={6} className="w-60 p-1">
        <div className="flex flex-col gap-0.5">
          <ActionRow
            icon={<Play className="h-3.5 w-3.5" />}
            label={<Trans>启动</Trans>}
            disabled={!isStopped && status.state !== 'crashed'}
            onSelect={runAction(() => startLsp('manual'))}
          />
          <ActionRow
            icon={<Square className="h-3.5 w-3.5" />}
            label={<Trans>停止</Trans>}
            disabled={isStopped || isBusy}
            onSelect={runAction(() => stopLsp('manual'))}
          />
          <ActionRow
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            label={<Trans>重启</Trans>}
            disabled={isBusy}
            onSelect={runAction(() => restartLsp('manual'))}
          />
          <div className="my-0.5 h-px bg-border" />
          <ActionRow
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={<Trans>清除缓存并重启</Trans>}
            description={<Trans>清除 WASM 与标准库缓存后重启</Trans>}
            disabled={isBusy}
            onSelect={runAction(() => clearCacheAndRestartLsp('manual'))}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
