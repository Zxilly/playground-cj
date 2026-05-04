'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Hash, Link } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import ShareDialog from '@/components/ShareDialog'
import { generateDataShareUrl, generateHashShareUrl } from '@/service/share'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { usePlaygroundStore } from '@/stores/playground'

const ShareButton = memo(() => {
  const { i18n } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const shareDialogUrl = usePlaygroundStore(state => state.shareDialogUrl)
  const openShareDialog = usePlaygroundStore(state => state.openShareDialog)
  const closeShareDialog = usePlaygroundStore(state => state.closeShareDialog)

  const handleShare = useCallback(async (type: 'url' | 'hash') => {
    const editor = usePlaygroundStore.getState().editor
    if (!editor) {
      console.warn('No editor found')
      return
    }

    const code = editor.getValue()
    if (code.trim() === '') {
      toast.warning(i18n._(msg`请先输入代码`))
      return
    }

    if (type === 'url') {
      openShareDialog(generateDataShareUrl(code))
      setIsOpen(false)
    }
    else {
      toast.promise(async () => {
        const url = await generateHashShareUrl(code)
        openShareDialog(url)
        setIsOpen(false)
      }, {
        loading: i18n._(msg`分享中...`),
        success: i18n._(msg`分享成功`),
        error: i18n._(msg`分享失败`),
      })
    }

    window.umami?.track(`share.${type}`)
  }, [i18n, openShareDialog])

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Trans>分享</Trans>
            {' '}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <div className="flex flex-col space-y-2">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => handleShare('url')}
            >
              <Link className="mr-2 h-4 w-4" />
              <Trans>URL 方式</Trans>
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => handleShare('hash')}
            >
              <Hash className="mr-2 h-4 w-4" />
              <Trans>Hash 方式</Trans>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <ShareDialog
        isOpen={shareDialogUrl !== null}
        onClose={closeShareDialog}
        url={shareDialogUrl ?? ''}
      />
    </>
  )
})

ShareButton.displayName = 'ShareButton'

export default ShareButton
