'use client'

import dynamic from 'next/dynamic'
import type { FlatSection } from '@/tour/types'

function AIClassroomLoadingShell() {
  return (
    <div className="h-screen bg-[#FAF7F2] text-[#1F1B16]">
      <header className="flex h-12 items-center border-b border-[#E8E2D5] bg-white px-5">
        <div className="flex size-6 items-center justify-center rounded-md bg-[#0F8C6E] font-mono text-xs font-bold text-white">仓</div>
        <div className="ml-3 text-sm font-semibold">AI Mode Classroom</div>
      </header>
      <main className="mx-auto w-full max-w-[920px] px-6 py-8">
        <div className="text-xs font-semibold uppercase text-[#0A6E57]">Continuous Classroom Stream</div>
        <h1 className="mt-1 text-2xl font-bold tracking-normal">AI Mode Classroom</h1>
        <div className="mt-6 rounded-md border border-[#E8E2D5] bg-white px-4 py-4 text-sm text-[#8A8174]">
          正在加载 AI classroom
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
  return <Component {...props} />
}
