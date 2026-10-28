'use client'

import { Suspense, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useMedia } from 'react-use'
import { Code2, Terminal } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { PlaygroundHeader } from './PlaygroundHeader'
import { OutputPanel } from './OutputPanel'
import styles from './Playground.module.css'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useDarkMode } from '@/lib/theme/useDarkMode'
import { useLanguage } from '@/hooks/useLanguage'
import { usePlaygroundStore } from '@/stores/playground'
import { loadEditorRuntime } from '@/lib/monaco/load-editor-runtime'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'

// Keep both imports statically analyzable and browser-only.
const Editor = dynamic(() => loadEditorRuntime('en', () => import('./PlaygroundEditor')), { ssr: false })
const ChineseEditor = dynamic(() => loadEditorRuntime('zh', () => import('./PlaygroundEditor')), { ssr: false })

export interface PlaygroundProps {
  sharedCode?: Promise<string | undefined>
  brand: ReactNode
  tourLink: ReactNode
  editorFallback: ReactNode
  footer: ReactNode
}

function Playground({ sharedCode, brand, tourLink, editorFallback, footer }: PlaygroundProps) {
  const dark = useDarkMode()
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  const toolOutput = usePlaygroundStore(state => state.toolOutput)
  const programOutput = usePlaygroundStore(state => state.programOutput)
  const truncation = usePlaygroundStore(state => state.truncation)
  const result = usePlaygroundStore(state => state.runResult)
  const running = usePlaygroundStore(state => state.running)
  const mobileView = usePlaygroundStore(state => state.mobileView)
  const setMobileView = usePlaygroundStore(state => state.setMobileView)
  const setEditor = usePlaygroundStore(state => state.setEditor)
  const { locale } = useLanguage()
  const isDesktop = useMedia('(min-width: 1024px)', false)

  const handleRun = useCallback(() => {
    void usePlaygroundStore.getState().editor?.getAction('cangjie.compile.run')?.run().catch(() => {})
  }, [])
  const handleFormat = useCallback(() => {
    void usePlaygroundStore.getState().editor?.getAction('editor.action.formatDocument')?.run().catch(() => {})
  }, [])
  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    setEditor(editorApp.getEditor()!)
  }, [setEditor])

  useEffect(() => () => {
    usePlaygroundStore.getState().setEditor(undefined)
  }, [])

  const EditorComponent = locale === 'zh' ? ChineseEditor : Editor

  return (
    <div className={`flex h-dvh flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] text-foreground lg:pb-0 ${dark ? 'dark' : ''}`}>
      <div id="header" className="shrink-0 px-3 sm:px-6">
        <PlaygroundHeader brand={brand} tourLink={tourLink} handleRun={handleRun} handleFormat={handleFormat} />
      </div>
      <Tabs value={mobileView} onValueChange={value => setMobileView(value as 'code' | 'output')} className="min-h-0 flex-1 gap-0">
        <TabsList className="h-11 w-full shrink-0 rounded-none border-y border-border bg-background p-0 lg:hidden">
          <TabsTrigger value="code" className="h-full rounded-none border-0 border-b-2 border-transparent shadow-none data-[state=active]:border-tour-accent-fg data-[state=active]:text-tour-accent-fg data-[state=active]:shadow-none">
            <Code2 aria-hidden="true" className="size-4" />
            <Trans>代码</Trans>
          </TabsTrigger>
          <TabsTrigger value="output" className="h-full rounded-none border-0 border-b-2 border-transparent shadow-none data-[state=active]:border-tour-accent-fg data-[state=active]:text-tour-accent-fg data-[state=active]:shadow-none">
            <Terminal aria-hidden="true" className="size-4" />
            <Trans>输出</Trans>
          </TabsTrigger>
        </TabsList>
        <div id="main" className="flex min-h-0 flex-1 px-3 pb-2 sm:px-6">
          <ResizablePanelGroup orientation="horizontal" className={`min-h-0 ${styles.workspace} ${mobileView === 'code' ? styles.codeView : styles.outputView}`}>
            <ResizablePanel id="playground-code-panel" defaultSize="72%" minSize="40%">
              <TabsContent value="code" forceMount inert={!isDesktop && mobileView !== 'code'} aria-hidden={!isDesktop && mobileView !== 'code'} className="h-full min-h-0">
                <div id="editor" className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border border-border">
                  {!editorReady && editorFallback}
                  <Suspense fallback={null}>
                    <EditorComponent sharedCode={sharedCode} onLoad={onLoad} locale={locale} />
                  </Suspense>
                </div>
              </TabsContent>
            </ResizablePanel>
            <ResizableHandle withHandle className="mx-2 hidden lg:flex" />
            <ResizablePanel id="playground-output-panel" defaultSize="28%" minSize="20%" collapsible>
              <TabsContent value="output" forceMount inert={!isDesktop && mobileView !== 'output'} aria-hidden={!isDesktop && mobileView !== 'output'} className="h-full min-h-0">
                <div id="panel" className="flex h-full min-h-0 flex-col overflow-hidden border border-border">
                  <OutputPanel toolOutput={toolOutput} programOutput={programOutput} truncation={truncation} result={result} running={running} />
                </div>
              </TabsContent>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </Tabs>
      {footer}
      <Toaster richColors closeButton position="top-center" />
    </div>
  )
}

export default Playground
