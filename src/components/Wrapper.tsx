'use client'

import dynamic from 'next/dynamic'

const ChineseWrapper = dynamic(() => import('@/components/ChineseWrapper'), { ssr: false })
const EnglishWrapper = dynamic(() => import('@/components/EnglishWrapper'), { ssr: false })

export default function Wrapper({ lang, defaultCode }: { lang: string, defaultCode?: string }) {
  const WrapperComponent = lang === 'zh' ? ChineseWrapper : EnglishWrapper
  return <WrapperComponent defaultCode={defaultCode} />
}
