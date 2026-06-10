'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface ScrollWatermarkStore {
  /**
   * Highest visible-stream index the learner has scrolled past, keyed by lang.
   * Index space matches `visibleStream(session)` so it survives the
   * `run_result` filter and small layout reflows. Pixel positions would drift
   * on every Monaco re-mount or font swap.
   */
  watermarks: Record<string, number>
  setWatermark: (lang: string, visibleIndex: number) => void
  clearWatermark: (lang: string) => void
  clearAll: () => void
}

// Persisted across reloads so opening the page resumes the learner at the
// point they last reached, instead of forcing them back to either the top or
// the very bottom of a long session.
export const useScrollWatermarkStore = create<ScrollWatermarkStore>()(
  persist(
    set => ({
      watermarks: {},
      setWatermark: (lang, visibleIndex) =>
        set((state) => {
          const prev = state.watermarks[lang] ?? -1
          if (visibleIndex <= prev)
            return state
          return { watermarks: { ...state.watermarks, [lang]: visibleIndex } }
        }),
      clearWatermark: lang =>
        set((state) => {
          if (!(lang in state.watermarks))
            return state
          const next = { ...state.watermarks }
          delete next[lang]
          return { watermarks: next }
        }),
      clearAll: () =>
        set((state) => {
          if (Object.keys(state.watermarks).length === 0)
            return state
          return { watermarks: {} }
        }),
    }),
    {
      name: 'tour-ai:scroll-watermark',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ watermarks: state.watermarks }),
    },
  ),
)
