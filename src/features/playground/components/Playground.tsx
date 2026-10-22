'use client'

import { PlaygroundHeader } from '@/features/playground/components/PlaygroundHeader'
import { OutputPanel } from '@/features/playground/components/OutputPanel'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useDarkMode } from '@/lib/theme/useDarkMode'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useMedia } from 'react-use'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useLanguage } from '@/hooks/useLanguage'
import { usePlaygroundStore } from '@/stores/playground'

// Keep the page shell server-rendered. Only the editor requires browser globals
// and the VS Code runtime; Chinese localization must run before that runtime.
const Editor = dynamic(() => import('./PlaygroundEditor'), { ssr: false })
const ChineseEditor = dynamic(
  () => import('@codingame/monaco-vscode-language-pack-zh-hans').then(() => import('./PlaygroundEditor')),
  { ssr: false },
)

export interface PlaygroundProps {
  sharedCode?: Promise<string | undefined>
  brand: ReactNode
  tourLink: ReactNode
  editorFallback: ReactNode
  footer: ReactNode
}

function Playground({ sharedCode, brand, tourLink, editorFallback, footer }: PlaygroundProps) {
  const dark = useDarkMode()
  const { i18n } = useLingui()
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  const toolOutput = usePlaygroundStore(state => state.toolOutput)
  const programOutput = usePlaygroundStore(state => state.programOutput)
  const truncation = usePlaygroundStore(state => state.truncation)
  const isOutputCollapsed = usePlaygroundStore(state => state.isOutputCollapsed)
  const toggleOutputState = usePlaygroundStore(state => state.toggleOutput)
  const setEditor = usePlaygroundStore(state => state.setEditor)
  const { locale } = useLanguage()

  const wrapperRef = useRef<MonacoEditorHandle | undefined>(undefined)

  const handleRun = useCallback(() => {
    usePlaygroundStore.getState().editor?.getAction('cangjie.compile.run')?.run()
  }, [])

  const handleFormat = useCallback(() => {
    usePlaygroundStore.getState().editor?.getAction('editor.action.formatDocument')?.run()
  }, [])

  const outputPanelRef = useRef<PanelImperativeHandle | null>(null)
  const toggleOutput = useCallback(() => {
    toggleOutputState()
    const panel = outputPanelRef.current
    if (!panel)
      return

    if (panel.isCollapsed())
      panel.expand()
    else
      panel.collapse()
  }, [toggleOutputState])

  const isDesktop = useMedia('(min-width: 1024px)', false)

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    wrapperRef.current = editorApp
    const ed = editorApp.getEditor()!
    setEditor(ed)
  }, [setEditor])

  useEffect(() => {
    return () => {
      // Drop the editor reference when the route unmounts so stale handles can't be used.
      usePlaygroundStore.getState().setEditor(undefined)
    }
  }, [])

  const EditorComponent = locale === 'zh' ? ChineseEditor : Editor

  const outputTip = isOutputCollapsed ? i18n._(msg`显示`) : i18n._(msg`隐藏`)

  return (
    <div className={`flex h-dvh flex-col bg-background text-foreground ${dark ? 'dark' : ''}`}>
      <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground p-4">
        <div id="header" className="flex-none px-2 lg:px-4">
          <PlaygroundHeader
            brand={brand}
            tourLink={tourLink}
            handleRun={handleRun}
            handleFormat={handleFormat}
            wrapperRef={wrapperRef}
          />
        </div>
        <div id="main" className="min-h-0 flex-1 flex flex-col lg:flex-row px-2 lg:px-4 pt-1">
          <ResizablePanelGroup
            orientation={isDesktop ? 'horizontal' : 'vertical'}
            className="!overflow-visible !flex-col lg:!flex-row"
          >
            <ResizablePanel defaultSize="65%" className="!overflow-visible">
              <div id="editor" className="flex-1 flex flex-col h-full w-full relative border border-border">
                {!editorReady && editorFallback}
                <Suspense fallback={null}>
                  <EditorComponent
                    sharedCode={sharedCode}
                    onLoad={onLoad}
                    locale={locale}
                  />
                </Suspense>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle className="hidden lg:flex lg:mx-4 lg:!w-px lg:!h-auto lg:[&>div]:!rotate-0" />
            <Button
              onClick={toggleOutput}
              variant="outline"
              className="my-2 min-h-11 w-full flex items-center justify-between lg:hidden"
            >
              <span>
                <Trans>
                  {outputTip}
                  输出内容
                </Trans>
              </span>
              {!isOutputCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <ResizablePanel defaultSize="35%" collapsible panelRef={outputPanelRef}>
              <div id="panel" className="flex flex-col h-full overflow-hidden">
                {!isOutputCollapsed && (
                  <OutputPanel
                    toolOutput={toolOutput}
                    programOutput={programOutput}
                    truncation={truncation}
                  />
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
      {footer}
      <Toaster richColors closeButton position="top-center" />
    </div>
  )
}

export default Playground
