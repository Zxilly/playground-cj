import { LoaderCircle } from 'lucide-react'
import { fontFamily } from '@/app/font'

export function TourEditorLoading({ code, locale }: { code: string, locale: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <pre className="min-h-0 flex-1 overflow-auto p-4 text-sm text-muted-foreground" style={{ fontFamily }}>
        <code>{code}</code>
      </pre>
      <div role="status" className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        {locale === 'en' ? 'Loading editor…' : '正在加载编辑器…'}
      </div>
    </div>
  )
}
