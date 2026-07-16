import { Trans } from '@lingui/react/macro'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export interface TeachTopBarProps {
  actions?: ReactNode
  backLabel?: string
  backTestId?: string
  onBack?: () => void
}

/** Shared classroom chrome for onboarding and the entered workspace. */
export function TeachTopBar({ actions, backLabel, backTestId, onBack }: TeachTopBarProps) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/88 px-3 shadow-[0_1px_0_rgba(15,23,20,0.02)] backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-testid={backTestId}
            aria-label={backLabel}
            onClick={onBack}
            className="rounded-lg text-muted-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
        )}
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/12">
            <GraduationCap aria-hidden="true" className="size-4" />
          </span>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              <Trans>AI 课堂</Trans>
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              <Trans>仓颉之旅</Trans>
            </span>
          </div>
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  )
}
