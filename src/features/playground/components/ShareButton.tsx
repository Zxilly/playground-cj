'use client'

import { Button } from '@/components/ui/button'
import { DeferredPopover } from './DeferredPopover'
import { ChevronDown, Hash, Link, Share2 } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { usePlaygroundStore } from '@/stores/playground'

const ShareDialog = dynamic(() => import('./ShareDialog'))

const ShareButton = memo(() => {
  const { i18n } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
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
      const { generateDataShareUrl } = await import('@/service/share')
      openShareDialog(generateDataShareUrl(code))
      setIsOpen(false)
    }
    else {
      toast.promise(async () => {
        const { generateHashShareUrl } = await import('@/service/share')
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
      <DeferredPopover
        open={isOpen}
        onOpenChange={setIsOpen}
        className="w-56"
        trigger={(
          <Button variant="ghost" disabled={!editorReady} className="min-h-11 flex-1 gap-2 px-3 lg:flex-none">
            <Share2 aria-hidden="true" className="size-4" />
            <Trans>分享</Trans>
            {' '}
            <ChevronDown aria-hidden="true" className="hidden size-3 lg:block" />
          </Button>
        )}
      >
        <div className="flex flex-col space-y-2">
          <Button
            variant="ghost"
            className="min-h-11 justify-start lg:min-h-9"
            onClick={() => handleShare('url')}
          >
            <Link className="mr-2 h-4 w-4" />
            <Trans>完整链接</Trans>
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 justify-start lg:min-h-9"
            onClick={() => handleShare('hash')}
          >
            <Hash className="mr-2 h-4 w-4" />
            <Trans>短链接</Trans>
          </Button>
        </div>
      </DeferredPopover>
      {shareDialogUrl !== null && (
        <ShareDialog isOpen onClose={closeShareDialog} url={shareDialogUrl} />
      )}
    </>
  )
})

ShareButton.displayName = 'ShareButton'

export default ShareButton
