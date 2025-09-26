import React from 'react'
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
import { t } from '@lingui/core/macro'
import { i18n } from '@/lib/i18n'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  url: string
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, onClose, url }) => {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success(i18n._(t`已复制分享链接`))
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><Trans>分享代码</Trans></DialogTitle>
        </DialogHeader>
        <div className="flex flex-col space-y-4">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ShareDialog
