import { Loader2 } from 'lucide-react'

/** Stable, announced fallback for the browser-only classroom runtime. */
export function TeachLoadingState() {
  return (
    <div
      data-testid="teach-app-loading"
      role="status"
      aria-live="polite"
      className="flex h-full items-center justify-center gap-2 bg-background p-6 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      <span>正在打开 AI 课堂…</span>
    </div>
  )
}
