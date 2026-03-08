'use client'

import { useKnownLanguages } from '@/contexts/useKnownLanguages'
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
  const { knownLanguages } = useKnownLanguages()
  if (!knownLanguages.has(lang as any))
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
