/**
 * Centralised re-export of all zustand stores.
 *
 * State boundary rules followed across this module:
 *   1. Stores hold ONLY state shared across non-adjacent React subtrees.
 *      Strictly local state stays in `useState`.
 *   2. All set() calls happen in event handlers / effects / async callbacks —
 *      never in the render phase. Render-phase set() interacts badly with
 *      `useSyncExternalStore` snapshot stability and was the cause of the
 *      earlier freeze incidents.
 *   3. Selectors are atomic: `useStore(s => s.field)` per piece of state.
 *      `useShallow` is avoided — multiple atomic selectors are simpler and
 *      more reliable.
 *   4. Setters guard against no-op writes by returning the same `state`
 *      reference when nothing changed (prevents redundant listener fires).
 *   5. Persisted stores use `createJSONStorage(() => localStorage)` plus
 *      `partialize` to keep actions out of storage.
 *   6. Transient command-style data (Monaco editor instance, refs) lives in
 *      ref containers / contexts, NOT in stores — subscribing to a ref
 *      handle would re-render every consumer on every editor mount.
 */

export { ALL_LANGUAGES, isKnownLanguageId, LANGUAGE_LABELS, useIsLanguageKnown, useKnownLanguagesStore } from './knownLanguages'
export type { Language } from './knownLanguages'

export { DEFAULT_LLM_CONFIG, useLLMConfig, useLLMConfigStore } from './llmConfig'

export type { LLMConfig } from './llmConfig'

export { usePlaygroundStore } from './playground'
export { useTourEditorStore } from './tourEditor'

export type { TourOutputTab } from './tourEditor'
