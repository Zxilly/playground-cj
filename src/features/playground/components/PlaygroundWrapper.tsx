'use client'

import dynamic from 'next/dynamic'

const Playground = dynamic(
  () => import('@/features/playground/components/Playground'),
  { ssr: false },
)

const ChinesePlayground = dynamic(
  () => import('@codingame/monaco-vscode-language-pack-zh-hans').then(
    () => import('@/features/playground/components/Playground'),
  ),
  { ssr: false },
)

export default function Wrapper({ lang, defaultCode }: { lang: string, defaultCode?: string }) {
  const Component = lang === 'zh' ? ChinesePlayground : Playground
  return <Component defaultCode={defaultCode} />
}
