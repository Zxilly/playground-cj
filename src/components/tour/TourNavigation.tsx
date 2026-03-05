'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TourNavigationProps {
  lang: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  currentIndex: number
  total: number
}

export function TourNavigation({ lang, hasPrev, hasNext, onPrev, onNext, currentIndex, total }: TourNavigationProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-border">
      <Button variant="outline" size="sm" disabled={!hasPrev} onClick={onPrev}>
        <ChevronLeft className="size-3.5" />
        {lang === 'en' ? 'Prev' : '上一步'}
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground">
        {currentIndex + 1}
        {' '}
        /
        {total}
      </span>
      <Button size="sm" disabled={!hasNext} onClick={onNext}>
        {lang === 'en' ? 'Next' : '下一步'}
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  )
}
