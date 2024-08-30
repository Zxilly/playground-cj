'use client'

import React, { useCallback, useState } from 'react'
import { ChevronDown, Hash, Link } from 'lucide-react'
import type * as monaco from 'monaco-editor'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useToast } from '@/components/ui/use-toast'

interface ShareButtonProps {
  editor?: monaco.editor.ICodeEditor
}

const ShareButton: React.FC<ShareButtonProps> = React.memo(({ editor }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const handleShare = useCallback((type: 'url' | 'hash') => {
    if (!editor) {
      return
    }

    const action = editor.getAction(`cangjie.share.${type}`)
    if (!action) {
      console.error(`Action cangjie.share.${type} not found`)
      toast({
        description: '分享失败，请重试',
        variant: 'destructive',
      })
      return
    }

    action.run().then(() => {
      window.umami?.track('share')
      toast({
        description: '已复制分享链接',
      })
      setIsOpen(false)
    }).catch((error) => {
      console.error('Share failed:', error)
      toast({
        description: '分享失败，请重试',
        variant: 'destructive',
      })
    })
  }, [editor, toast])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button className="w-full sm:w-auto">
          分享
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
            URL 方式
          </Button>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => handleShare('hash')}
          >
            <Hash className="mr-2 h-4 w-4" />
            Hash 方式
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
})

ShareButton.displayName = 'ShareButton'

export default ShareButton
