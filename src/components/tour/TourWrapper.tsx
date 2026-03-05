'use client'

import dynamic from 'next/dynamic'
import type { TourChapterSlim, FlatSection } from '@/tour/types'

const TourApp = dynamic(
  () => import('./TourApp'),
  { ssr: false },
)

const ChineseTourApp = dynamic(
  () => import('@codingame/monaco-vscode-language-pack-zh-hans').then(
    () => import('./TourApp'),
  ),
  { ssr: false },
)

interface TourWrapperProps {
  lang: string
  tourData: TourChapterSlim[]
  allSections: FlatSection[]
  initialIndex: number
  isTourDomain: boolean
}

export default function TourWrapper(props: TourWrapperProps) {
  const Component = props.lang === 'zh' ? ChineseTourApp : TourApp
  return <Component {...props} />
}
