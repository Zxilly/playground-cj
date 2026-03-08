'use client'

import { use } from 'react'
import { KnownLanguagesContext } from './knownLanguages'

export function useKnownLanguages() {
  const ctx = use(KnownLanguagesContext)
  if (!ctx)
    throw new Error('useKnownLanguages must be used within KnownLanguagesProvider')
  return ctx
}
