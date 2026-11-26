'use client'

import { useEffect, useRef } from 'react'
import { Terminal, Wrench, X } from 'lucide-react'
import { AnsiOutput } from '@/components/AnsiOutput'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import styles from './TourEditor.module.css'

type OutputTab = 'program' | 'tool'

export interface TourNativeOutputProps {
  locale: string
  expanded: boolean
  revealRequest: number
  programOutput: string
  compilerOutput: string
  activeTab: OutputTab
  onActiveTabChange: (tab: OutputTab) => void
  onClose: () => void
}

function getLabels(locale: string) {
  return locale === 'en'
    ? {
        region: 'Execution output',
        programTab: 'Program Output',
        compilerTab: 'Compiler Output',
        close: 'Close output',
        emptyProgram: 'Run the code to see program output here.',
        emptyCompiler: 'No compiler diagnostics yet.',
      }
    : {
        region: '运行输出',
        programTab: '程序输出',
        compilerTab: '编译输出',
        close: '关闭输出',
        emptyProgram: '运行代码后将在此显示程序输出。',
        emptyCompiler: '暂无编译诊断输出。',
      }
}

/**
 * Lightweight React output panel backed by `AnsiOutput` so Tour preserves
 * ANSI-colored compiler diagnostics without loading VS Code's workbench
 * views/output service overrides.
 */
export function TourNativeOutput({
  locale,
  expanded,
  revealRequest,
  programOutput,
  compilerOutput,
  activeTab,
  onActiveTabChange,
  onClose,
}: TourNativeOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const labels = getLabels(locale)

  const currentText = activeTab === 'program' ? programOutput : compilerOutput
  const hasProgram = programOutput.trim().length > 0
  const hasCompiler = compilerOutput.trim().length > 0

  useEffect(() => {
    if (!expanded || !scrollRef.current)
      return
    scrollRef.current.scrollTop = 0
  }, [expanded, revealRequest, activeTab])

  return (
    <section
      aria-label={labels.region}
      data-tour-native-output
      className={cn(styles.nativeOutput, 'flex flex-col bg-background text-foreground')}
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-2">
        <div role="tablist" aria-label={labels.region} className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            id="tour-output-tab-program"
            aria-selected={activeTab === 'program'}
            aria-controls="tour-output-panel-body"
            onClick={() => onActiveTabChange('program')}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTab === 'program'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Terminal className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{labels.programTab}</span>
            {hasProgram && (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-emerald-500"
              />
            )}
          </button>
          <button
            type="button"
            role="tab"
            id="tour-output-tab-tool"
            aria-selected={activeTab === 'tool'}
            aria-controls="tour-output-panel-body"
            onClick={() => onActiveTabChange('tool')}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTab === 'tool'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Wrench className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{labels.compilerTab}</span>
            {hasCompiler && (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-amber-500"
              />
            )}
          </button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={labels.close}
          title={labels.close}
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        id="tour-output-panel-body"
        role="tabpanel"
        aria-labelledby={activeTab === 'program' ? 'tour-output-tab-program' : 'tour-output-tab-tool'}
        className="min-h-0 flex-1 overflow-auto p-3 text-xs leading-relaxed"
      >
        {currentText
          ? (
              <AnsiOutput
                text={currentText}
                className="m-0 whitespace-pre-wrap break-words font-mono"
              />
            )
          : (
              <p className="text-muted-foreground">
                {activeTab === 'program' ? labels.emptyProgram : labels.emptyCompiler}
              </p>
            )}
      </div>
    </section>
  )
}
