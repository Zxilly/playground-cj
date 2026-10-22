'use client'

import type { ReactNode } from 'react'
import { ExamplesDropdown } from '@/features/playground/components/ExamplesDropdown'
import { LanguageSelector } from '@/features/playground/components/LanguageSelector'
import ShareButton from '@/features/playground/components/ShareButton'
import { Button } from '@/components/ui/button'
import { Trans } from '@lingui/react/macro'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { usePlaygroundStore } from '@/stores/playground'
import { CANGJIE_LANGUAGE_ID } from '@/lib/monaco/language'

interface PlaygroundHeaderProps {
  brand: ReactNode
  tourLink: ReactNode
  handleRun: () => void
  handleFormat: () => void
  wrapperRef: React.RefObject<MonacoEditorHandle | undefined>
}

function ExamplesAction({ wrapperRef }: Pick<PlaygroundHeaderProps, 'wrapperRef'>) {
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  return (
    <ExamplesDropdown
      disabled={!editorReady}
      action={(code) => {
        const editor = usePlaygroundStore.getState().editor
        const uri = editor?.getModel()?.uri.toString()
        if (!uri)
          return
        wrapperRef.current?.updateCodeResources?.({
          modified: { text: code, enforceLanguageId: CANGJIE_LANGUAGE_ID, uri },
        })
      }}
    />
  )
}

export function PlaygroundHeader({ brand, tourLink, handleRun, handleFormat, wrapperRef }: PlaygroundHeaderProps) {
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)

  // One DOM tree at every width: the server-rendered layout is already correct
  // before hydration, and resizing cannot remount open menus or focused controls.
  return (
    <div className="mb-2 grid grid-cols-6 items-center gap-2 lg:mb-0 lg:flex">
      <div className="col-span-6 min-w-0 lg:mr-auto lg:shrink-0">{brand}</div>
      <div className="col-span-3 lg:order-1">{tourLink}</div>
      <div className="col-span-3 [&_button]:w-full lg:order-3"><LanguageSelector /></div>
      <div className="col-span-6 min-w-0 lg:order-2 lg:w-[160px] xl:w-[200px]">
        <ExamplesAction wrapperRef={wrapperRef} />
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
