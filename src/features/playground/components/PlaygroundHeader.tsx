'use client'

import type { ReactNode } from 'react'
import { ExamplesDropdown } from '@/features/playground/components/ExamplesDropdown'
import { LanguageSelector } from '@/features/playground/components/LanguageSelector'
import ShareButton from '@/features/playground/components/ShareButton'
import { Button } from '@/components/ui/button'
import { Trans } from '@lingui/react/macro'
import { usePlaygroundStore } from '@/stores/playground'

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
      }}
    />
  )
}

export function PlaygroundHeader({ brand, tourLink, handleRun, handleFormat }: PlaygroundHeaderProps) {
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)

  // One DOM tree at every width: the server-rendered layout is already correct
  // before hydration, and resizing cannot remount open menus or focused controls.
  return (
    <div className="mb-2 grid grid-cols-6 items-center gap-2 lg:mb-0 lg:flex">
      <div className="col-span-6 min-w-0 lg:mr-auto lg:shrink-0">{brand}</div>
      <div className="col-span-3 lg:order-1">{tourLink}</div>
      <div className="col-span-3 [&_button]:w-full lg:order-3"><LanguageSelector /></div>
      <div className="col-span-6 min-w-0 lg:order-2 lg:w-[160px] xl:w-[200px]">
        <ExamplesAction />
      </div>
      <div className="col-span-6 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&_button]:w-full lg:order-4">
        <Button className="min-h-11 px-2 lg:min-h-9 lg:px-4" onClick={handleRun} disabled={!editorReady}>
          <Trans>运行</Trans>
        </Button>
        <Button className="min-h-11 px-2 lg:min-h-9 lg:px-4" onClick={handleFormat} disabled={!editorReady}>
          <Trans>格式化</Trans>
        </Button>
        <ShareButton />
      </div>
    </div>
  )
}
