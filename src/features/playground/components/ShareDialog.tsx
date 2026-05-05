import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  url: string
}

export default function ShareDialog({ isOpen, onClose, url }: ShareDialogProps) {
  const { i18n } = useLingui()

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    toast.success(i18n._(msg`已复制分享链接`))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><Trans>分享代码</Trans></DialogTitle>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={url}
            readOnly
            className="flex-1 px-3 py-2 border rounded-md bg-muted"
          />
          <Button variant="outline" size="icon" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
