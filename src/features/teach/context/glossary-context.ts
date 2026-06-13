import { createContext } from 'react'
import type { GlossaryTerm } from '@/lib/teach/workspace/documents'

/**
 * Lightweight glossary lookup exposed to lesson blocks (notably
 * `glossary_ref`). Phase 9's full workspace context provider will supply real
 * terms loaded from the repository; until then this context defaults to an
 * empty glossary so blocks degrade gracefully to a placeholder.
 */
export interface GlossaryContextValue {
  /** Resolve a term by its exact name; case-insensitive match. */
  lookup: (term: string) => GlossaryTerm | undefined
}

export const emptyGlossary: GlossaryContextValue = {
  lookup: () => undefined,
}

export const GlossaryContext = createContext<GlossaryContextValue>(emptyGlossary)
