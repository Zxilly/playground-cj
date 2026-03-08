'use client'

import { ExamplesDropdown } from '@/components/ExamplesDropdown'
import { LanguageSelector } from '@/components/LanguageSelector'
import ShareButton from '@/components/ShareButton'
import { Button } from '@/components/ui/button'
import { Trans } from '@lingui/react/macro'
import Image from 'next/image'
import type { MonacoEditorHandle } from '@/components/EditorWrapper'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { useMedia } from 'react-use'
import { useLanguage } from '@/hooks/useLanguage'
import { BookOpen } from 'lucide-react'

interface PlaygroundHeaderProps {
  handleRun: () => void
  handleFormat: () => void
  editor: monaco.editor.IStandaloneCodeEditor | undefined
  wrapperRef: React.RefObject<MonacoEditorHandle | undefined>
}

function ExamplesAction({ editor, wrapperRef }: Pick<PlaygroundHeaderProps, 'editor' | 'wrapperRef'>) {
  return (
    <ExamplesDropdown action={(code) => {
      wrapperRef.current?.updateCodeResources?.({
        modified: {
          text: code,
          enforceLanguageId: 'Cangjie',
          uri: editor!.getModel()!.uri.toString(),
        },
      })
    }}
    />
  )
}

export function PlaygroundHeader({ handleRun, handleFormat, editor, wrapperRef }: PlaygroundHeaderProps) {
  const isDesktop = useMedia('(min-width: 1024px)')
  const { locale } = useLanguage()

  if (isDesktop) {
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
          <Button variant="outline" asChild>
            <a href={`/${locale}/tour`}>
              <BookOpen className="h-4 w-4 mr-1" />
              <Trans>教程</Trans>
            </a>
          </Button>
          <div className="w-[200px]">
            <ExamplesAction editor={editor} wrapperRef={wrapperRef} />
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

  return (
    <div>
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/${locale}/tour`}>
              <BookOpen className="h-4 w-4 mr-1" />
              <Trans>教程</Trans>
            </a>
          </Button>
          <LanguageSelector />
        </div>
      </div>

      <div className="flex flex-col space-y-2 mb-2">
        <div className="w-full">
          <ExamplesAction editor={editor} wrapperRef={wrapperRef} />
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
