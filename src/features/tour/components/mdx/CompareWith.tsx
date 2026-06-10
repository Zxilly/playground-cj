'use client'

import { isKnownLanguageId, LANGUAGE_LABELS, useIsLanguageKnown } from '@/stores/knownLanguages'
import type { ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'

interface CompareWithProps {
  lang: string
  children: ReactNode
}

export function CompareWith({ lang, children }: CompareWithProps) {
  const language = isKnownLanguageId(lang) ? lang : null
  const isKnown = useIsLanguageKnown(language)
  if (!language || !isKnown)
    return null

  return (
    <div className="tour-compare">
      <div className="tour-compare-label">
        <Trans>对比</Trans>
        {' '}
        {LANGUAGE_LABELS[language]}
      </div>
      <div className="tour-compare-body">
        {children}
      </div>
    </div>
  )
}
