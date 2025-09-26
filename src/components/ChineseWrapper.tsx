'use client'

import '@codingame/monaco-vscode-language-pack-zh-hans'

import Playground from '@/components/Playground'

interface WrapperProps {
  defaultCode?: string
}

export default function Wrapper({ defaultCode }: WrapperProps) {
  return <Playground defaultCode={defaultCode} />
}
