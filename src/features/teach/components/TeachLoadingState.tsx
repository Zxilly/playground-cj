import { Loader2 } from 'lucide-react'
import { Trans } from '@lingui/react/macro'

/** Stable, announced fallback for the browser-only classroom runtime. */
export function TeachLoadingState(_props: { lang?: string } = {}) {
  return (
    <div
      data-testid="teach-app-loading"
      role="status"
      aria-live="polite"
      className="flex h-full items-center justify-center gap-2 bg-background p-6 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      <span><Trans>正在打开 AI 课堂…</Trans></span>
    </div>
  )
}
