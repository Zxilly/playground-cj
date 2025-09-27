'use client'

import Playground from '@/components/Playground'

interface WrapperProps {
  defaultCode?: string
}

export default function EnglishWrapper({ defaultCode }: WrapperProps) {
  return <Playground defaultCode={defaultCode} />
}
