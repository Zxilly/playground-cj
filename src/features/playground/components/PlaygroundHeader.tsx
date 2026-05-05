'use client'

import { ExamplesDropdown } from '@/features/playground/components/ExamplesDropdown'
import { LanguageSelector } from '@/features/playground/components/LanguageSelector'
import ShareButton from '@/features/playground/components/ShareButton'
import { Button } from '@/components/ui/button'
import { Trans } from '@lingui/react/macro'
import Image from 'next/image'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useMedia } from 'react-use'
import { useLanguage } from '@/hooks/useLanguage'
import { getTourHref } from '@/lib/siteHref'
import { BookOpen } from 'lucide-react'
import { usePlaygroundStore } from '@/stores/playground'

interface PlaygroundHeaderProps {
  handleRun: () => void
  handleFormat: () => void
  wrapperRef: React.RefObject<MonacoEditorHandle | undefined>
}

function ExamplesAction({ wrapperRef }: Pick<PlaygroundHeaderProps, 'wrapperRef'>) {
  return (
    <ExamplesDropdown action={(code) => {
      const editor = usePlaygroundStore.getState().editor
      const uri = editor?.getModel()?.uri.toString()
      if (!uri)
        return
      wrapperRef.current?.updateCodeResources?.({
        modified: {
          text: code,
          enforceLanguageId: 'Cangjie',
          uri,
        },
      })
    }}
    />
  )
}

export function PlaygroundHeader({ handleRun, handleFormat, wrapperRef }: PlaygroundHeaderProps) {
  const isDesktop = useMedia('(min-width: 1024px)')
  const { locale } = useLanguage()
  const tourHref = getTourHref(locale, { currentOrigin: window.location.origin })

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
            <a href={tourHref}>
              <BookOpen className="h-4 w-4 mr-1" />
              <Trans>教程</Trans>
            </a>
          </Button>
          <div className="w-[200px]">
            <ExamplesAction wrapperRef={wrapperRef} />
          </div>
          <LanguageSelector />
          <Button onClick={handleRun}>
            <Trans>运行</Trans>
          </Button>
          <Button onClick={handleFormat}>
            <Trans>格式化</Trans>
          </Button>
          <ShareButton />
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
            <a href={tourHref}>
              <BookOpen className="h-4 w-4 mr-1" />
              <Trans>教程</Trans>
            </a>
          </Button>
          <LanguageSelector />
        </div>
      </div>

      <div className="flex flex-col space-y-2 mb-2">
        <div className="w-full">
          <ExamplesAction wrapperRef={wrapperRef} />
        </div>
        <div className="flex flex-row space-x-2 [&>*]:flex-1 [&_button]:w-full">
          <Button onClick={handleRun}>
            <Trans>运行</Trans>
          </Button>
          <Button onClick={handleFormat}>
            <Trans>格式化</Trans>
          </Button>
          <ShareButton />
        </div>
      </div>
    </div>
  )
}
