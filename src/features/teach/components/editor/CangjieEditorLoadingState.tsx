import { Loader2 } from 'lucide-react'
import { useWorkspace } from '@/features/teach/context/useWorkspace'

export function CangjieEditorLoadingState() {
  const { lang } = useWorkspace()
  return (
    <div role="status" className="flex h-full min-h-40 items-center justify-center gap-2 bg-background p-6 text-sm text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      {lang === 'en' ? 'Loading editor…' : '正在加载编辑器…'}
    </div>
  )
}
