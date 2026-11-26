'use client'

import type { RefObject } from 'react'
import { LoaderCircle, PanelBottom, Play, RotateCcw, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import styles from './TourEditor.module.css'

export interface TourEditorToolbarProps {
  locale: string
  ready: boolean
  running: boolean
  outputExpanded: boolean
  outputToggleRef: RefObject<HTMLElement | null>
  onToggleOutput: () => void
  onRun: () => void
  onFormat: () => void
  onReset: () => void
}

function getLabels(locale: string) {
  return locale === 'en'
    ? {
        title: 'Code',
        run: 'Run',
        running: 'Running',
        format: 'Format',
        reset: 'Reset',
        showOutput: 'Show output',
        hideOutput: 'Hide output',
      }
    : {
        title: '示例代码',
        run: '运行',
        running: '运行中',
        format: '格式化',
        reset: '重置',
        showOutput: '展开输出',
        hideOutput: '收起输出',
      }
}

export function TourEditorToolbar({
  locale,
  ready,
  running,
  outputExpanded,
  outputToggleRef,
  onToggleOutput,
  onRun,
  onFormat,
  onReset,
}: TourEditorToolbarProps) {
  const labels = getLabels(locale)
  const actionsDisabled = !ready || running
  const outputLabel = outputExpanded ? labels.hideOutput : labels.showOutput

  return (
    <div className={styles.toolbar}>
      <div className={styles.identity}>
        <h2>{labels.title}</h2>
      </div>

      <div className={styles.actions} role="toolbar" aria-label={labels.title}>
        <Button
          type="button"
          size="sm"
          disabled={actionsDisabled}
          aria-busy={running}
          data-tour-highlight="run"
          data-tour-primary-action=""
          onClick={onRun}
          className={cn(styles.primaryAction, 'min-h-9 gap-1.5 px-3 font-semibold')}
        >
          {running
            ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            : <Play className="size-4" aria-hidden="true" />}
          <span>{running ? labels.running : labels.run}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={actionsDisabled}
          onClick={onReset}
          title={labels.reset}
          aria-label={labels.reset}
          className="min-h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{labels.reset}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={actionsDisabled}
          onClick={onFormat}
          title={labels.format}
          aria-label={labels.format}
          className="size-9 text-muted-foreground hover:text-foreground"
        >
          <WandSparkles className="size-4" aria-hidden="true" />
        </Button>

        <Button
          ref={(node) => {
            outputToggleRef.current = node
          }}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={outputExpanded}
          aria-controls="tour-output-content"
          aria-label={outputLabel}
          title={outputLabel}
          onClick={onToggleOutput}
          className={cn(
            'size-9 text-muted-foreground hover:text-foreground',
            outputExpanded && 'bg-accent text-accent-foreground',
          )}
        >
          <PanelBottom className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <kbd className={styles.shortcut} aria-hidden="true">Ctrl + Enter</kbd>
    </div>
  )
}
