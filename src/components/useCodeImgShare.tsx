import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { generateHashShareUrl } from '@/service/share'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { isDarkMode } from '@/lib/utils'

async function svgToPng(svgurl: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  const img = new Image()
  img.src = svgurl
  await new Promise((resolve) => {
    img.onload = resolve
  })

  canvas.width = img.width * 2
  canvas.height = img.height * 2

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    })
  })
}

export function useCodeShareDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [code, setCode] = useState('')
  const [picBlob, setPicBlob] = useState<Blob | null>(null)
  const [picUrl, setPicUrl] = useState('')

  const openDialog = useCallback(async (editorCode: string) => {
    const url = await generateHashShareUrl(editorCode)
    setShareUrl(url)
    setCode(editorCode)

    const b = await fetch('/img', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: editorCode,
        shareUrl: url,
        dark: isDarkMode(),
      }),
    }).then(res => res.blob())
    setPicBlob(b)

    if (picUrl) {
      URL.revokeObjectURL(picUrl)
    }

    setPicUrl(URL.createObjectURL(b))

    setIsOpen(true)
    await window.umami?.track('share.picture')
  }, [picUrl])

  const closeDialog = useCallback(() => {
    setIsOpen(false)
  }, [])

  const downloadImage = useCallback(() => {
    if (picBlob) {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(picBlob)
      a.download = 'share.svg'
      a.dispatchEvent(new MouseEvent('click'))
      toast.success('已下载图片')
    }
    else {
      toast.error('图片未生成')
    }
  }, [picBlob])

  const copyToClipboard = useCallback(async () => {
    if (picBlob && picUrl) {
      const pngBlob = await svgToPng(picUrl)
      if (!pngBlob) {
        toast.error('图片生成失败')
        return
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
        }),
      ])
      toast.success('已复制图片到剪贴板')
    }
    else {
      toast.error('图片未生成')
    }
  }, [picBlob, picUrl])

  const DialogComponent = useMemo(() => {
    return (
      <Dialog open={isOpen} onOpenChange={closeDialog}>
        <DialogContent className={`max-w-2xl max-h-[80vh] overflow-auto ${isDarkMode() && 'dark'}`}>
          <DialogHeader>
            <DialogTitle>分享代码图片</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-start p-4 rounded max-h-[60vh] overflow-y-auto">
            <img src={picUrl} alt="preview" />
          </div>
          <div className="flex justify-center mt-4 space-x-2">
            <Button onClick={downloadImage}>下载图片</Button>
            <Button onClick={copyToClipboard}>复制图片</Button>
          </div>
          <DialogDescription className="hidden">Img preview</DialogDescription>
        </DialogContent>
      </Dialog>
    )
  }, [isOpen, closeDialog, picUrl, downloadImage, copyToClipboard])

  const addSharePictureAction = useCallback((editor: any) => {
    editor.addAction({
      id: 'cangjie.share.picture',
      label: '分享 (图片)',
      contextMenuGroupId: 'share',
      contextMenuOrder: 1.5,
      run: async () => {
        toast.promise(openDialog(editor.getValue()), {
          success: '已生成图片',
          error: '生成图片失败',
          loading: '正在生成图片...',
        })
      },
    })
  }, [openDialog])

  return {
    isOpen,
    shareUrl,
    code,
    openDialog,
    closeDialog,
    DialogComponent,
    addSharePictureAction,
  }
}
