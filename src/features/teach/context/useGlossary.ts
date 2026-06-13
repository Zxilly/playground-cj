'use client'

import { use } from 'react'
import type { GlossaryContextValue } from './glossary-context'
import { GlossaryContext } from './glossary-context'

/** Access the workspace glossary lookup from any lesson block. */
export function useGlossary(): GlossaryContextValue {
  return use(GlossaryContext)
}
