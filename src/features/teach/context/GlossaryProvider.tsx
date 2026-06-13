'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { GlossaryTerm } from '@/lib/teach/workspace/documents'
import type { GlossaryContextValue } from './glossary-context'
import { GlossaryContext } from './glossary-context'

export function GlossaryProvider({
  terms,
  children,
}: {
  terms: GlossaryTerm[]
  children: ReactNode
}) {
  const value = useMemo<GlossaryContextValue>(() => {
    const byTerm = new Map<string, GlossaryTerm>()
    for (const entry of terms)
      byTerm.set(entry.term.trim().toLowerCase(), entry)
    return {
      lookup: term => byTerm.get(term.trim().toLowerCase()),
    }
  }, [terms])

  return <GlossaryContext value={value}>{children}</GlossaryContext>
}
