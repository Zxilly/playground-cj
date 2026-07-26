'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, CircleSlash, Loader2, Pause, Play, RefreshCw, Square, Trash2 } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useLspStatusRender } from '@/modules/cangjie-editor/hooks/useLspStatusRender'
import type { LspStatusIcon } from '@/modules/cangjie-editor/hooks/useLspStatusRender'
import {
  clearCacheAndRestartLanguageService,
  restartLanguageService,
  startLanguageService,
  stopLanguageService,
} from '@/lib/monaco/language-service-lifecycle'
import { subscribeLspStatus } from '@/lib/lsp'
import type { LspRuntimeStatus } from '@/lib/lsp'

const FALLBACK_STATUS: LspRuntimeStatus = {
  state: 'stopped',
  origin: 'auto',
  manuallyStopped: false,
  stdlibModulesLoaded: 0,
  stdlibModulesTotal: 0,
  generation: 0,
  autoRestartAttempts: 0,
}

const STATUS_ICONS: Record<LspStatusIcon, React.ReactNode> = {
  'ready': <Check className="h-3.5 w-3.5" />,
  'spinner': <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  'stopped': <Pause className="h-3.5 w-3.5" />,
  'manual-stopped': <CircleSlash className="h-3.5 w-3.5" />,
  'crashed': <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
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

  const render = useLspStatusRender(status ?? FALLBACK_STATUS)

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
          {STATUS_ICONS[render.icon]}
          <span>Cangjie</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={6} className="w-60 p-1">
        <div className="flex flex-col gap-0.5">
          <ActionRow
            icon={<Play className="h-3.5 w-3.5" />}
            label={<Trans>启动</Trans>}
            disabled={!isStopped && status.state !== 'crashed'}
            onSelect={runAction(() => startLanguageService('manual'))}
          />
          <ActionRow
            icon={<Square className="h-3.5 w-3.5" />}
            label={<Trans>停止</Trans>}
            disabled={isStopped || isBusy}
            onSelect={runAction(() => stopLanguageService('manual'))}
          />
          <ActionRow
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            label={<Trans>重启</Trans>}
            disabled={isBusy}
            onSelect={runAction(() => restartLanguageService('manual'))}
          />
          <div className="my-0.5 h-px bg-border" />
          <ActionRow
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={<Trans>清除缓存并重启</Trans>}
            description={<Trans>重置本地缓存后重启代码提示</Trans>}
            disabled={isBusy}
            onSelect={runAction(() => clearCacheAndRestartLanguageService('manual'))}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
