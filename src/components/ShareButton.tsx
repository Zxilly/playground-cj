'use client'

import React, { useCallback, useState } from 'react'
import { ChevronDown, FileImage, Hash, Link } from 'lucide-react'
import type * as monaco from 'monaco-editor'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ShareButtonProps {
  editor?: monaco.editor.ICodeEditor
}

const ShareButton: React.FC<ShareButtonProps> = React.memo(({ editor }) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleShare = useCallback((type: 'url' | 'hash' | 'picture') => {
    if (!editor) {
      return
    }

    if (editor.getValue().trim() === '') {
      toast.warning('请先输入代码')
      return
    }

    const action = editor.getAction(`cangjie.share.${type}`)
    if (!action) {
      console.error(`Action cangjie.share.${type} not found`)
      return
    }

    action.run().then(() => {
      setIsOpen(false)
    }).catch((error) => {
      console.error('Share failed:', error)
    })
  }, [editor])

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
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => handleShare('picture')}
          >
            <FileImage className="mr-2 h-4 w-4" />
            图片方式
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
})

ShareButton.displayName = 'ShareButton'

export default ShareButton
