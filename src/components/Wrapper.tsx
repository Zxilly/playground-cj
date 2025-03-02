'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { loadDataShareCode } from '@/service/share'

const Playground = dynamic(() => import('@/components/Playground'), { ssr: false })

export interface WrapperProps {
  defaultCode?: string
}

export default function Wrapper({ defaultCode }: WrapperProps) {
  const renderedCode = useMemo(() => {
    if (defaultCode) {
      return defaultCode
    }
    return loadDataShareCode()
  }, [defaultCode])

  return <Playground defaultCode={renderedCode} />
}
