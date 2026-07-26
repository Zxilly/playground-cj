'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseCopyToClipboardOptions {
  copiedDuration?: number
}

export function useCopyToClipboard({
  copiedDuration = 3000,
}: UseCopyToClipboardOptions = {}) {
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current)
        clearTimeout(resetTimerRef.current)
    }
  }, [])

  const copyToClipboard = useCallback((value: string) => {
    if (!value)
      return

    void navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true)
      if (resetTimerRef.current)
        clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        setIsCopied(false)
      }, copiedDuration)
    })
  }, [copiedDuration])

  return { isCopied, copyToClipboard }
}
