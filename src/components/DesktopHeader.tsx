'use client'

import { ExamplesDropdown } from '@/components/ExamplesDropdown'
import { LanguageSelector } from '@/components/LanguageSelector'
import ShareButton from '@/components/ShareButton'
import { Button } from '@/components/ui/button'
import { Trans } from '@lingui/react/macro'
import Image from 'next/image'
import React from 'react'
import type { EditorApp } from 'monaco-languageclient/editorApp'
import type * as monaco from '@codingame/monaco-vscode-editor-api'

interface DesktopHeaderProps {
  handleRun: () => void
  handleFormat: () => void
  editor: monaco.editor.IStandaloneCodeEditor | undefined
  wrapperRef: React.RefObject<EditorApp | undefined>
}

export function DesktopHeader({ handleRun, handleFormat, editor, wrapperRef }: DesktopHeaderProps) {
  return (
    <div className="flex flex-row justify-between items-center">
      <div className="flex items-center">
        <Image
          src="/icon.png"
          alt="Logo"
          width={32}
          height={32}
          className="m-4"
        />
        <h1 className="text-2xl font-bold">
          <Trans>仓颉 Playground</Trans>
        </h1>
      </div>
      <div className="flex flex-row space-x-2">
        <div className="w-[200px]">
          <ExamplesDropdown action={(nxt) => {
            wrapperRef.current?.updateCodeResources({
              modified: {
                text: nxt,
                enforceLanguageId: 'Cangjie',
                uri: editor!.getModel()!.uri.toString(),
              },
            })
          }}
          />
        </div>
        <LanguageSelector />
        <Button onClick={handleRun}>
          <Trans>运行</Trans>
        </Button>
        <Button onClick={handleFormat}>
          <Trans>格式化</Trans>
        </Button>
        <ShareButton editor={editor} />
      </div>
    </div>
  )
}