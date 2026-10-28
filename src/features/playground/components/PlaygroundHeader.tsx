'use client'

import type { ReactNode } from 'react'
import { ExamplesDropdown } from '@/features/playground/components/ExamplesDropdown'
import { LanguageSelector } from '@/features/playground/components/LanguageSelector'
import ShareButton from '@/features/playground/components/ShareButton'
import { Button } from '@/components/ui/button'
import { Trans } from '@lingui/react/macro'
import { usePlaygroundStore } from '@/stores/playground'
import { FileCode2, LoaderCircle, Play, WandSparkles } from 'lucide-react'

interface PlaygroundHeaderProps {
  brand: ReactNode
  tourLink: ReactNode
  handleRun: () => void
  handleFormat: () => void
}

function ExamplesAction() {
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  return (
    <ExamplesDropdown
      disabled={!editorReady}
      action={(code) => {
        const editor = usePlaygroundStore.getState().editor
        const model = editor?.getModel()
        if (!editor || !model)
          return

        // Example selection is an explicit edit. Model-resource updates preserve
        // existing drafts, while setValue would discard the user's undo history.
        editor.pushUndoStop()
        editor.executeEdits('playground.example', [{
          range: model.getFullModelRange(),
          text: code,
        }])
        editor.pushUndoStop()
        editor.setPosition({ lineNumber: 1, column: 1 })
        editor.revealLine(1)
        usePlaygroundStore.getState().setMobileView('code')
      }}
    />
  )
}

export function PlaygroundHeader({ brand, tourLink, handleRun, handleFormat }: PlaygroundHeaderProps) {
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  const running = usePlaygroundStore(state => state.running)

  // One DOM tree at every width: the server-rendered layout is already correct
  // before hydration, and resizing cannot remount open menus or focused controls.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
      <div className="min-w-0 py-3">{brand}</div>
      <div className="flex items-center gap-1 py-2 sm:gap-3">
        {tourLink}
        <LanguageSelector />
      </div>
      <div className="col-span-2 flex min-w-0 items-center gap-4 border-t border-border py-2 lg:col-span-1">
        <span className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-sm lg:inline-flex">
          <FileCode2 aria-hidden="true" className="size-4" />
          main.cj
        </span>
        <div className="min-w-0 flex-1 lg:max-w-64">
          <ExamplesAction />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-end gap-2 border-t border-border bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:self-stretch lg:py-2 lg:pr-0 [&>button]:flex-1 lg:[&>button]:flex-none">
        <Button variant="ghost" className="min-h-11 px-3" onClick={handleFormat} disabled={!editorReady || running}>
          <WandSparkles aria-hidden="true" className="size-4" />
          <Trans>格式化</Trans>
        </Button>
        <ShareButton />
        <Button className="min-h-11 gap-2 bg-tour-accent-fg px-5 text-background hover:bg-tour-accent-fg/90" onClick={handleRun} disabled={!editorReady || running} aria-busy={running}>
          {running ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Play aria-hidden="true" className="size-4" />}
          {running ? <Trans>运行中</Trans> : <Trans>运行</Trans>}
        </Button>
      </div>
    </div>
  )
}
