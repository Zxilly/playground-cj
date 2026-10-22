'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlatSection } from '@/tour/types'

interface UseTourNavigationOptions {
  allSections: FlatSection[]
  basePath: string
  initialIndex: number
}

function pushSectionUrl(basePath: string, section: FlatSection): void {
  window.history.pushState(null, '', `${basePath}/${section.chapterSlug}/${section.chapterStep}`)
}

function eventStartedInsideInput(event: KeyboardEvent): boolean {
  return event.composedPath().some(
    node => node instanceof Element && (
      node.hasAttribute('data-tour-editor-root')
      || node.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
    ),
  )
}

export function useTourNavigation({
  allSections,
  basePath,
  initialIndex,
}: UseTourNavigationOptions) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const currentIndexRef = useRef(initialIndex)
  const currentSection = allSections[currentIndex]

  const navigateToIndex = useCallback((index: number) => {
    const target = allSections[index]
    if (!target || index === currentIndexRef.current)
      return

    currentIndexRef.current = index
    setCurrentIndex(index)
    pushSectionUrl(basePath, target)
  }, [allSections, basePath])

  const goPrev = useCallback(() => {
    navigateToIndex(currentIndexRef.current - 1)
  }, [navigateToIndex])

  const goNext = useCallback(() => {
    navigateToIndex(currentIndexRef.current + 1)
  }, [navigateToIndex])

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
    const onPopState = () => {
      const pathname = window.location.pathname.replace(/\/$/, '')
      const index = allSections.findIndex(
        section => `${basePath}/${section.chapterSlug}/${section.chapterStep}` === pathname,
      )
      if (index === -1)
        return

      currentIndexRef.current = index
      setCurrentIndex(index)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [allSections, basePath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'PageDown' && event.key !== 'PageUp')
        return
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return
      if (eventStartedInsideInput(event))
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
