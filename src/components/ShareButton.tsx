'use client'

import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Hash, Link } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import ShareDialog from '@/components/ShareDialog'
import { generateDataShareUrl, generateHashShareUrl } from '@/service/share'
import { eventEmitter, EVENTS } from '@/lib/events'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { i18n } from '@/lib/i18n'

interface ShareButtonProps {
  editor: monaco.editor.IStandaloneCodeEditor | undefined
}

const ShareButton: React.FC<ShareButtonProps> = React.memo(({ editor }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    const handleShowDialog = (url: string) => {
      setShareUrl(url)
      setIsDialogOpen(true)
    }

    eventEmitter.on(EVENTS.SHOW_SHARE_DIALOG, handleShowDialog)
    return () => {
      eventEmitter.off(EVENTS.SHOW_SHARE_DIALOG, handleShowDialog)
    }
  }, [])

  const handleShare = useCallback(async (type: 'url' | 'hash') => {
    if (!editor) {
      console.warn('No editor found')
      return
    }

    if (editor.getValue().trim() === '') {
      toast.warning(i18n._(t`请先输入代码`))
      return
    }

    const code = editor.getValue()

    if (type === 'url') {
      const url = generateDataShareUrl(code)
      setShareUrl(url)
      setIsDialogOpen(true)
      setIsOpen(false)
    }
    else {
      toast.promise(async () => {
        const url = await generateHashShareUrl(code)
        setShareUrl(url)
        setIsDialogOpen(true)
        setIsOpen(false)
      }, {
        loading: i18n._(t`分享中...`),
        success: i18n._(t`分享成功`),
        error: i18n._(t`分享失败`),
      })
    }

    window.umami?.track(`share.${type}`)
  }, [editor])

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
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        url={shareUrl}
      />
    </>
  )
})

ShareButton.displayName = 'ShareButton'

export default ShareButton
