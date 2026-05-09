'use client'

import dynamic from 'next/dynamic'
import { Trans } from '@lingui/react/macro'
import type { FlatSection } from '@/tour/types'
import { cn } from '@/lib/utils'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'

function AIClassroomLoadingShell() {
  return (
    <div className="h-screen bg-[#FAF7F2] text-[#1F1B16]">
      <header className={aiClassroomStyles.header.root}>
        <div className={aiClassroomStyles.header.content}>
          <div className={aiClassroomStyles.header.brandMark}>仓</div>
          <div className={aiClassroomStyles.header.title}><Trans>AI 课堂</Trans></div>
        </div>
      </header>
      <main className={aiClassroomStyles.layout.content}>
        <div className={aiClassroomStyles.text.eyebrow}><Trans>课堂内容</Trans></div>
        <h1 className={aiClassroomStyles.text.pageTitle}><Trans>AI 课堂</Trans></h1>
        <div className={cn(aiClassroomStyles.surface.muted, 'mt-6')}>
          <Trans>正在加载 AI 课堂</Trans>
        </div>
      </main>
    </div>
  )
}

const TourAIApp = dynamic(
  () => import('./TourAIApp'),
  {
    ssr: false,
    loading: AIClassroomLoadingShell,
  },
)

const ChineseTourAIApp = dynamic(
  () => import('@codingame/monaco-vscode-language-pack-zh-hans').then(
    () => import('./TourAIApp'),
  ),
  {
    ssr: false,
    loading: AIClassroomLoadingShell,
  },
)

interface TourAIWrapperProps {
  lang: string
  allSections: FlatSection[]
}

export default function TourAIWrapper(props: TourAIWrapperProps) {
  const Component = props.lang === 'zh' ? ChineseTourAIApp : TourAIApp
  return <Component lang={props.lang} />
}
