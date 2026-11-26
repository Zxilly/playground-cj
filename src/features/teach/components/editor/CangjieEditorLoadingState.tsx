import { Loader2 } from 'lucide-react'
import { Trans } from '@lingui/react/macro'

export function CangjieEditorLoadingState() {
  return (
    <div role="status" className="flex h-full min-h-40 items-center justify-center gap-2 bg-editor-surface p-6 text-sm text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      <Trans>正在加载编辑器…</Trans>
    </div>
  )
}
