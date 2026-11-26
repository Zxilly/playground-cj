'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  url: string
}

function isShortShareUrl(url: string): boolean {
  try {
    return new URL(url).searchParams.has('hash')
  }
  catch {
    return url.includes('?hash=')
  }
}

export default function ShareDialog({ isOpen, onClose, url }: ShareDialogProps) {
  const { i18n } = useLingui()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isShortLink = isShortShareUrl(url)

  useEffect(() => () => {
    if (timerRef.current)
      clearTimeout(timerRef.current)
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (timerRef.current)
        clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setCopied(false)
        timerRef.current = null
      }, 2000)
      toast.success(i18n._(msg`已复制分享链接`))
    }
    catch {
      toast.error(i18n._(msg`复制分享链接失败`))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><Trans>分享代码</Trans></DialogTitle>
          <DialogDescription>
            {isShortLink
              ? <Trans>当前为短链接（托管存储，有效 200 天）。如需永久保存，可改用本地编码的「完整链接」。</Trans>
              : <Trans>当前为完整链接（代码直接本地编码在链接中，永久有效）；若链接过长也可使用有效 200 天的「短链接」。</Trans>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            readOnly
            aria-label={i18n._(msg`分享链接`)}
            onFocus={event => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label={copied ? i18n._(msg`已复制分享链接`) : i18n._(msg`复制分享链接`)}
            title={copied ? i18n._(msg`已复制`) : i18n._(msg`复制分享链接`)}
          >
            {copied
              ? <Check aria-hidden="true" className="h-4 w-4 text-brand" />
              : <Copy aria-hidden="true" className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
