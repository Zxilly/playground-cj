import type { ReactNode } from 'react'

interface NoteProps {
  children: ReactNode
}

export function Note({ children }: NoteProps) {
  return (
    <div className="my-5 rounded-lg border border-amber-300/60 dark:border-amber-700/40 bg-gradient-to-r from-amber-50 to-amber-50/70 dark:from-amber-950/25 dark:to-amber-950/15 px-4 py-3.5 shadow-sm">
      <div className="text-[11px] font-bold text-amber-600 dark:text-amber-500 mb-2 uppercase tracking-widest">
        Note
      </div>
      <div className="text-[14px] leading-[1.8] text-amber-900 dark:text-amber-200/90">
        <div className="note-content">
          {children}
        </div>
      </div>
    </div>
  )
}
