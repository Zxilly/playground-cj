'use client'

import dynamic from 'next/dynamic'
import { Trans } from '@lingui/react/macro'
import type { FlatSection } from '@/tour/types'
import { cn } from '@/lib/utils'

function AIClassroomLoadingShell() {
  return (
    <div className="h-screen bg-tour-bg text-tour-text">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-tour-border bg-tour-surface px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-6 items-center justify-center rounded-md bg-tour-accent-fg font-mono text-xs font-bold text-white">仓</div>
          <div className="truncate text-sm font-semibold text-tour-text"><Trans>AI 课堂</Trans></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[920px] px-6 py-8 pb-20">
        <div className="text-xs font-semibold uppercase text-tour-link"><Trans>课堂内容</Trans></div>
        <h1 className="mt-1 text-2xl font-bold tracking-normal text-tour-heading"><Trans>AI 课堂</Trans></h1>
        <div className={cn('rounded-md border border-tour-border bg-tour-surface px-4 py-4 text-sm text-muted-foreground', 'mt-6')}>
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
