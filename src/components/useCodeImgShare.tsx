import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import domtoimage from 'dom-to-image'
import { toast } from 'sonner'
import { generateHashShareUrl } from '@/service/share'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getHighlighter } from '@/lib/shiki'
import { font } from '@/app/font'

export function useCodeShareDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [code, setCode] = useState('')
  const [highlightedCode, setHighlightedCode] = useState('')
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)

  useEffect(() => {
    getHighlighter().then((highlighter) => {
      if (!highlighter || !code)
        return
      setHighlightedCode(highlighter.codeToHtml(code, { lang: 'cangjie', theme: 'vitesse-light' }))
    })
  }, [code])

  useEffect(() => {
    if (highlightedCode) {
      const target = document.getElementById('codepic')
      if (!target)
        return

      domtoimage.toBlob(target, { bgcolor: '#FFFFFF' }).then((blob) => {
        setImageBlob(blob)
      })
    }
  }, [highlightedCode])

  const openDialog = useCallback(async (editorCode: string) => {
    const url = await generateHashShareUrl(editorCode)
    setShareUrl(url)
    setCode(editorCode)
    setIsOpen(true)
    await window.umami?.track('share.picture')
  }, [])

  const closeDialog = useCallback(() => {
    setIsOpen(false)
  }, [])

  const downloadImage = useCallback(() => {
    if (imageBlob) {
      const url = URL.createObjectURL(imageBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'code.png'
      link.click()
      URL.revokeObjectURL(url)
    }
  }, [imageBlob])

  const copyToClipboard = useCallback(async () => {
    if (imageBlob) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [imageBlob.type]: imageBlob,
          }),
        ])
        toast.success('图片已复制到剪贴板')
      }
      catch (err) {
        toast.error('复制失败')
      }
    }
  }, [imageBlob])

  const DialogComponent = useMemo(() => {
    return (
      <Dialog open={isOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>分享代码图片</DialogTitle>
          </DialogHeader>
          <div id="codepic" className="flex flex-col items-start bg-white p-4 rounded break-words">
            <div
              style={{
                fontFamily: `${font.style.fontFamily}, sans-serif`,
              }}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
            <div className="flex justify-between items-center w-full mt-4">
              <div className="flex-grow mr-2 overflow-hidden text-ellipsis">
                <div className="font-bold text-base mb-1">仓颉 Playground</div>
                {shareUrl}
              </div>
              <QRCodeSVG value={shareUrl} size={64} />
            </div>
          </div>
          <div className="flex justify-center mt-4 space-x-2">
            <Button onClick={downloadImage}>下载图片</Button>
            <Button onClick={copyToClipboard}>复制图片</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }, [isOpen, closeDialog, highlightedCode, shareUrl, downloadImage, copyToClipboard])

  const addSharePictureAction = useCallback((editor: any) => {
    editor.addAction({
      id: 'cangjie.share.picture',
      label: '分享 (图片)',
      contextMenuGroupId: 'share',
      contextMenuOrder: 1.5,
      run: async () => {
        await openDialog(editor.getValue())
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
