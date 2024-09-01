import React, { useCallback, useMemo, useState } from 'react'
import { generateHashShareUrl } from '@/service/share'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function useCodeShareDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [code, setCode] = useState('')

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

  }, [])

  const copyToClipboard = useCallback(async () => {

  }, [])

  const DialogComponent = useMemo(() => {
    return (
      <Dialog open={isOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>分享代码图片</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-start bg-white p-4 rounded break-words">
            {/* <svg dangerouslySetInnerHTML={{ __html: svg }} /> */}
          </div>
          <div className="flex justify-center mt-4 space-x-2">
            <Button onClick={downloadImage}>下载图片</Button>
            <Button onClick={copyToClipboard}>复制图片</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }, [isOpen, closeDialog, downloadImage, copyToClipboard])

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
