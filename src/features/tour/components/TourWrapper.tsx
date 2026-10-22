'use client'

import dynamic from 'next/dynamic'
import { useLingui } from '@lingui/react'
import { LoaderCircle } from 'lucide-react'
import type { FlatSection, TourChapterSlim } from '@/tour/types'

function TourLoading() {
  const { i18n } = useLingui()
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="h-[50px] shrink-0 bg-tour-teal-deep" />
      <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        {i18n.locale === 'en' ? 'Loading the tour…' : '正在加载教程…'}
      </div>
    </div>
  )
}

const TourApp = dynamic(
  () => import('./TourApp'),
  { ssr: false, loading: TourLoading },
)

interface TourWrapperProps {
  lang: string
  tourData: TourChapterSlim[]
  allSections: FlatSection[]
  initialIndex: number
  isTourDomain: boolean
}

export default function TourWrapper(props: TourWrapperProps) {
  return <TourApp {...props} />
}
