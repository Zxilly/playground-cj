'use client'

import { MonacoEditorReactComp } from '@/components/EditorWrapper'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { updateEditor } from '@/lib/monaco'
import { eventEmitter, EVENTS } from '@/lib/events'
import { fontFamily } from '@/app/font'
import { Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnsiUp } from 'ansi_up'
import type { EditorApp } from 'monaco-languageclient/editorApp'
import CodeRunner from '@/components/CodeRunner'
import { Toaster } from '@/components/ui/sonner'

interface TourEditorProps {
  code: string
  locale: string
}

export function TourEditor({ code, locale }: TourEditorProps) {
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [activeTab, setActiveTab] = useState<'program' | 'tool'>('program')
  const editorAppRef = useRef<EditorApp | undefined>(undefined)
  const codeRef = useRef(code)

  useEffect(() => {
    codeRef.current = code
    const editor = editorAppRef.current?.getEditor()
    if (editor) {
      editor.getModel()?.setValue(code)
      setToolOutput('')
      setProgramOutput('')
    }
  }, [code])

  // Auto-switch to program tab when output arrives
  useEffect(() => {
    if (programOutput) setActiveTab('program')
  }, [programOutput])

  const onLoad = useCallback((editorApp: EditorApp) => {
    editorAppRef.current = editorApp
    updateEditor({
      setProgramOutput,
      setToolOutput,
      ed: editorApp.getEditor()!,
    })
  }, [])

  const handleRun = useCallback(() => {
    const editor = editorAppRef.current?.getEditor()
    if (editor) {
      eventEmitter.emit(EVENTS.RUN_CODE, editor.getValue())
    }
  }, [])

  const handleFormat = useCallback(() => {
    const editor = editorAppRef.current?.getEditor()
    if (editor) {
      eventEmitter.emit(EVENTS.FORMAT_CODE, editor.getValue())
    }
  }, [])

  const handleReset = useCallback(() => {
    const editor = editorAppRef.current?.getEditor()
    if (editor) {
      editor.getModel()?.setValue(codeRef.current)
      setToolOutput('')
      setProgramOutput('')
    }
  }, [])

  const handleFormatted = useCallback((formattedCode: string) => {
    editorAppRef.current?.getEditor()?.getModel()?.setValue(formattedCode)
  }, [])

  const [initialCode] = useState(code)

  const ansiRef = useRef(new AnsiUp())

  const outputHtml = useMemo(() => {
    const ansi = ansiRef.current
    return activeTab === 'program'
      ? ansi.ansi_to_html(programOutput)
      : ansi.ansi_to_html(toolOutput)
  }, [activeTab, programOutput, toolOutput])

  return (
    <div className="flex flex-col h-full">
      <ResizablePanelGroup orientation="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={70} minSize={20}>
          <div className="h-full relative">
            <MonacoEditorReactComp
              code={initialCode}
              onLoad={onLoad}
              locale={locale}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={10}>
          <div className="flex flex-col h-full bg-muted/30">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
              <Button size="sm" onClick={handleRun}>
                <Play className="size-3" />
                {locale === 'en' ? 'Run' : '运行'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleFormat}>
                {locale === 'en' ? 'Format' : '格式化'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="size-3" />
                {locale === 'en' ? 'Reset' : '重置'}
              </Button>
              <div className="ml-auto flex items-center text-xs">
                <button
                  className={`px-3 py-1.5 font-medium transition-colors ${activeTab === 'program' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setActiveTab('program')}
                >
                  {locale === 'en' ? 'Output' : '程序输出'}
                </button>
                <button
                  className={`px-3 py-1.5 font-medium transition-colors ${activeTab === 'tool' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setActiveTab('tool')}
                >
                  {locale === 'en' ? 'Build' : '工具输出'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <pre
                className="whitespace-pre text-xs leading-relaxed"
                style={{ fontFamily }}
                dangerouslySetInnerHTML={{ __html: outputHtml }}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <Toaster richColors closeButton position="top-center" />
      <CodeRunner
        setToolOutput={setToolOutput}
        setProgramOutput={setProgramOutput}
        onFormatted={handleFormatted}
      />
    </div>
  )
}
