'use client'

import dynamic from 'next/dynamic'

const Playground = dynamic(() => import('@/components/Playground'), { ssr: false })

export interface WrapperProps {
  defaultCode?: string
}

export default function Wrapper({ defaultCode }: WrapperProps) {
  return <Playground defaultCode={defaultCode} />
}
