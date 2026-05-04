'use client'

import dynamic from 'next/dynamic'
import type { FlatSection } from '@/tour/types'

const TourAIApp = dynamic(
  () => import('./TourAIApp'),
  { ssr: false },
)

const ChineseTourAIApp = dynamic(
  () => import('@codingame/monaco-vscode-language-pack-zh-hans').then(
    () => import('./TourAIApp'),
  ),
  { ssr: false },
)

interface TourAIWrapperProps {
  lang: string
  allSections: FlatSection[]
}

export default function TourAIWrapper(props: TourAIWrapperProps) {
  const Component = props.lang === 'zh' ? ChineseTourAIApp : TourAIApp
  return <Component {...props} />
}
