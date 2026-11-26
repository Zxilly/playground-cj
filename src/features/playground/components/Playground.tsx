'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePanelRef } from 'react-resizable-panels'
import { useMedia } from 'react-use'
import { Code2, Terminal } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { PlaygroundHeader } from './PlaygroundHeader'
import { OutputPanel } from './OutputPanel'
import styles from './Playground.module.css'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useLanguage } from '@/hooks/useLanguage'
import { usePlaygroundStore } from '@/stores/playground'
import { loadEditorRuntime } from '@/lib/monaco/load-editor-runtime'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { ShareCodeResult } from '@/lib/dpaste-server'
import type { SiteDomain } from '@/lib/siteHref'

// Keep both imports statically analyzable and browser-only.
const Editor = dynamic(() => loadEditorRuntime('en', () => import('./PlaygroundEditor')), { ssr: false })
const ChineseEditor = dynamic(() => loadEditorRuntime('zh', () => import('./PlaygroundEditor')), { ssr: false })

export interface PlaygroundProps {
  sharedCode?: Promise<ShareCodeResult | string | undefined>
  servingDomain?: SiteDomain
  brand: ReactNode
  editorFallback: ReactNode
  footer: ReactNode
}

function Playground({ sharedCode, servingDomain = 'playground', brand, editorFallback, footer }: PlaygroundProps) {
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  const editorError = usePlaygroundStore(state => state.editorError)
  const toolOutput = usePlaygroundStore(state => state.toolOutput)
  const programOutput = usePlaygroundStore(state => state.programOutput)
  const truncation = usePlaygroundStore(state => state.truncation)
  const result = usePlaygroundStore(state => state.runResult)
  const running = usePlaygroundStore(state => state.running)
  const cancelRun = usePlaygroundStore(state => state.cancelRun)
  const stdin = usePlaygroundStore(state => state.stdin)
  const setStdin = usePlaygroundStore(state => state.setStdin)
  const mobileView = usePlaygroundStore(state => state.mobileView)
  const setMobileView = usePlaygroundStore(state => state.setMobileView)
  const setEditor = usePlaygroundStore(state => state.setEditor)
  const setEditorError = usePlaygroundStore(state => state.setEditorError)
  const { locale } = useLanguage()
  const isDesktop = useMedia('(min-width: 1024px)', false)
  const outputPanelRef = usePanelRef()
  const [outputCollapsed, setOutputCollapsed] = useState(false)

  const handleExpandOutput = useCallback(() => {
    outputPanelRef.current?.expand()
    setOutputCollapsed(false)
  }, [outputPanelRef])

  const handleRun = useCallback(() => {
    if (outputPanelRef.current?.isCollapsed()) {
      outputPanelRef.current.expand()
      setOutputCollapsed(false)
    }
    void usePlaygroundStore.getState().editor?.getAction('cangjie.compile.run')?.run().catch(() => {})
  }, [outputPanelRef])

  const handleCancelRun = useCallback(() => {
    usePlaygroundStore.getState().cancelRun?.()
  }, [])

  const handleFormat = useCallback(() => {
    void usePlaygroundStore.getState().editor?.getAction('editor.action.formatDocument')?.run().catch(() => {})
  }, [])

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    setEditorError(null)
    setEditor(editorApp.getEditor()!)
  }, [setEditor, setEditorError])

  useEffect(() => {
    if (running && outputPanelRef.current?.isCollapsed())
      outputPanelRef.current.expand()
  }, [outputPanelRef, running])

  useEffect(() => () => {
    usePlaygroundStore.getState().setEditor(undefined)
    usePlaygroundStore.getState().setEditorError(null)
  }, [])

  const EditorComponent = locale === 'zh' ? ChineseEditor : Editor

  return (
    <div className="flex h-dvh flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] text-foreground lg:pb-0">
      <div id="header" className="shrink-0 px-3 sm:px-6">
        <PlaygroundHeader
          brand={brand}
          servingDomain={servingDomain}
          handleRun={handleRun}
          handleCancelRun={cancelRun ? handleCancelRun : undefined}
          handleFormat={handleFormat}
          outputCollapsed={isDesktop && outputCollapsed}
          onExpandOutput={handleExpandOutput}
        />
      </div>
      <Tabs value={mobileView} onValueChange={value => setMobileView(value as 'code' | 'output')} className="min-h-0 flex-1 gap-0">
        <TabsList className="h-11 w-full shrink-0 rounded-none border-y border-border bg-background p-0 lg:hidden">
          <TabsTrigger value="code" className="h-full rounded-none border-0 border-b-2 border-transparent shadow-none data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:shadow-none">
            <Code2 aria-hidden="true" className="size-4" />
            <Trans>代码</Trans>
          </TabsTrigger>
          <TabsTrigger value="output" className="h-full rounded-none border-0 border-b-2 border-transparent shadow-none data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:shadow-none">
            <Terminal aria-hidden="true" className="size-4" />
            <Trans>输出</Trans>
          </TabsTrigger>
        </TabsList>
        <div id="main" className="flex min-h-0 flex-1 px-3 pb-2 sm:px-6">
          <ResizablePanelGroup
            orientation="horizontal"
            className={`min-h-0 ${styles.workspace} ${mobileView === 'code' ? styles.codeView : styles.outputView}`}
            onLayoutChanged={(layout) => {
              const outputSize = layout['playground-output-panel']
              if (typeof outputSize === 'number')
                setOutputCollapsed(outputSize <= 0)
            }}
          >
            <ResizablePanel id="playground-code-panel" defaultSize="72%" minSize="40%">
              <TabsContent value="code" forceMount inert={!isDesktop && mobileView !== 'code'} aria-hidden={!isDesktop && mobileView !== 'code'} className="h-full min-h-0">
                <div id="editor" className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border-x border-b border-border lg:border">
                  {!editorReady && !editorError && editorFallback}
                  <Suspense fallback={null}>
                    <EditorComponent sharedCode={sharedCode} onLoad={onLoad} locale={locale} />
                  </Suspense>
                </div>
              </TabsContent>
            </ResizablePanel>
            <ResizableHandle withHandle className="mx-2 hidden lg:flex" />
            <ResizablePanel
              id="playground-output-panel"
              panelRef={outputPanelRef}
              defaultSize="28%"
              minSize="20%"
              collapsible
              collapsedSize="0%"
            >
              <TabsContent value="output" forceMount inert={!isDesktop && mobileView !== 'output'} aria-hidden={!isDesktop && mobileView !== 'output'} className="h-full min-h-0">
                <div id="panel" className="flex h-full min-h-0 flex-col overflow-hidden border-x border-b border-border lg:border">
                  <OutputPanel
                    toolOutput={toolOutput}
                    programOutput={programOutput}
                    truncation={truncation}
                    result={result}
                    running={running}
                    onCancelRun={cancelRun ? handleCancelRun : undefined}
                    stdin={stdin}
                    onStdinChange={setStdin}
                  />
                </div>
              </TabsContent>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </Tabs>
      {footer}
    </div>
  )
}

export default Playground
