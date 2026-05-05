'use client'

import type { Language } from '@/stores/knownLanguages'
import { useIsLanguageKnown } from '@/stores/knownLanguages'
import type { ReactNode } from 'react'

const LANG_LABELS: Record<string, string> = {
  c: 'C',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
}

interface CompareWithProps {
  lang: string
  children: ReactNode
}

export function CompareWith({ lang, children }: CompareWithProps) {
  const isKnown = useIsLanguageKnown(lang as Language)
  if (!isKnown)
    return null

  return (
    <div className="tour-compare">
      <div className="tour-compare-label">
        vs
        {' '}
        {LANG_LABELS[lang] ?? lang}
      </div>
      <div className="tour-compare-body">
        {children}
      </div>
    </div>
  )
}
