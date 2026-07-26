/* eslint-disable react/set-state-in-effect */
'use client'

import { useEffect, useState } from 'react'
import { useAuiState } from '@assistant-ui/react'
import { useShallow } from 'zustand/shallow'

function useObjectUrl(file: File | undefined) {
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!file) {
      setObjectUrl(undefined)
      return
    }

    const nextObjectUrl = URL.createObjectURL(file)
    setObjectUrl(nextObjectUrl)

    return () => {
      URL.revokeObjectURL(nextObjectUrl)
    }
  }, [file])

  return objectUrl
}

export function useAttachmentSource() {
  const { file, src } = useAuiState(
    useShallow((s): { file?: File, src?: string } => {
      if (s.attachment.type !== 'image')
        return {}
      if (s.attachment.file)
        return { file: s.attachment.file }
      const imageContent = s.attachment.content?.filter(c => c.type === 'image')[0]
      if (!imageContent?.image)
        return {}
      return { src: imageContent.image }
    }),
  )

  return useObjectUrl(file) ?? src
}
