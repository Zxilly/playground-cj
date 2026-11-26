'use client'

import dynamic from 'next/dynamic'
import { Trans } from '@lingui/react/macro'
import { LoaderCircle } from 'lucide-react'
import type { FlatSection, TourChapterSlim } from '@/tour/types'

function TourLoading() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="h-[50px] shrink-0 bg-tour-teal-deep" />
      <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        <Trans>正在加载教程…</Trans>
      </div>
    </div>
  )
}

const TourApp = dynamic(
  () => import('./TourApp'),
  { loading: TourLoading },
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
