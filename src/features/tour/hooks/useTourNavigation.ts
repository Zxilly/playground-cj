'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FlatSection } from '@/tour/types'

interface UseTourNavigationOptions {
  allSections: FlatSection[]
  basePath: string
  initialIndex: number
}

function pushSectionUrl(basePath: string, section: FlatSection): void {
  window.history.pushState(null, '', `${basePath}/${section.chapterSlug}/${section.chapterStep}`)
}

function eventStartedInsideTourEditor(event: KeyboardEvent): boolean {
  return event.composedPath().some(
    node => node instanceof Element && node.hasAttribute('data-tour-editor-root'),
  )
}

export function useTourNavigation({
  allSections,
  basePath,
  initialIndex,
}: UseTourNavigationOptions) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const currentSection = allSections[currentIndex]

  const navigateToIndex = useCallback((index: number) => {
    const target = allSections[index]
    if (!target)
      return

    setCurrentIndex(index)
    pushSectionUrl(basePath, target)
  }, [allSections, basePath])

  const goPrev = useCallback(() => {
    setCurrentIndex((index) => {
      if (index <= 0)
        return index

      const nextIndex = index - 1
      const target = allSections[nextIndex]
      if (target)
        pushSectionUrl(basePath, target)
      return nextIndex
    })
  }, [allSections, basePath])

  const goNext = useCallback(() => {
    setCurrentIndex((index) => {
      if (index >= allSections.length - 1)
        return index

      const nextIndex = index + 1
      const target = allSections[nextIndex]
      if (target)
        pushSectionUrl(basePath, target)
      return nextIndex
    })
  }, [allSections, basePath])

  const goToSection = useCallback((chapterId: string, subChapterId: string, sectionId: string) => {
    const index = allSections.findIndex(
      section =>
        section.chapterId === chapterId
        && section.subChapterId === subChapterId
        && section.sectionId === sectionId,
    )
    if (index !== -1)
      navigateToIndex(index)
  }, [allSections, navigateToIndex])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'PageDown' && event.key !== 'PageUp')
        return
      if (eventStartedInsideTourEditor(event))
        return

      event.preventDefault()
      if (event.key === 'PageDown')
        goNext()
      else
        goPrev()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrev])

  return {
    currentIndex,
    currentSection,
    goNext,
    goPrev,
    goToSection,
  }
}
