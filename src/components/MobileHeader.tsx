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

interface MobileHeaderProps {
  handleRun: () => void
  handleFormat: () => void
  editor: monaco.editor.IStandaloneCodeEditor | undefined
  wrapperRef: React.RefObject<EditorApp | undefined>
}

export function MobileHeader({ handleRun, handleFormat, editor, wrapperRef }: MobileHeaderProps) {
  return (
    <div>
      {/* Logo + 语言选择器 */}
      <div className="flex flex-row justify-between items-center mb-2">
        <div className="flex items-center">
          <Image
            src="/icon.png"
            alt="Logo"
            width={24}
            height={24}
            className="m-2"
          />
          <h1 className="text-base font-bold">
            <Trans>仓颉 Playground</Trans>
          </h1>
        </div>
        <LanguageSelector />
      </div>

      {/* 控件区域 */}
      <div className="flex flex-col space-y-2 mb-2">
        <div className="w-full">
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
        <div className="flex flex-row space-x-2 [&>*]:flex-1 [&_button]:w-full">
          <Button onClick={handleRun}>
            <Trans>运行</Trans>
          </Button>
          <Button onClick={handleFormat}>
            <Trans>格式化</Trans>
          </Button>
          <ShareButton editor={editor} />
        </div>
      </div>
    </div>
  )
}
