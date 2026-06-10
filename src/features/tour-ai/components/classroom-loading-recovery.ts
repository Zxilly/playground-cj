'use client'

import { getStaticTourSourceHref } from '@/lib/ai/course-content/static-tour-links'

export function currentAIClassroomHref(): string {
  if (typeof window === 'undefined')
    return './ai'
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || './ai'
}

export function currentStaticTourRecoveryHref(langOverride?: string): string | null {
  if (typeof window === 'undefined')
    return null

  const topic = new URLSearchParams(window.location.search).get('topic')?.trim()
  if (!topic)
    return null

  const lang = langOverride ?? window.location.pathname.match(/^\/([^/]+)/)?.[1] ?? 'zh'
  return getStaticTourSourceHref(lang, {
    conceptId: topic,
    currentOrigin: window.location.origin,
  })
}
