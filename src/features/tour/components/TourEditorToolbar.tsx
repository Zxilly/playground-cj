'use client'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { ToolBar } from '@codingame/monaco-vscode-api/vscode/vs/base/browser/ui/toolbar/toolbar'
import { ActionViewItem } from '@codingame/monaco-vscode-api/vscode/vs/base/browser/ui/actionbar/actionViewItems'
import { Action } from '@codingame/monaco-vscode-api/vscode/vs/base/common/actions'
import { Codicon } from '@codingame/monaco-vscode-api/vscode/vs/base/common/codicons'
import { ThemeIcon } from '@codingame/monaco-vscode-api/vscode/vs/base/common/themables'
import { StandaloneServices } from '@codingame/monaco-vscode-api/vscode/vs/editor/standalone/browser/standaloneServices'
import { IContextMenuService } from '@codingame/monaco-vscode-api/vscode/vs/platform/contextview/browser/contextView.service'
import styles from './TourEditor.module.css'

interface TourEditorToolbarProps {
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

interface NativeToolbar {
  toolbar: ToolBar
  run: Action
  output: Action
  format: Action
  reset: Action
  runElement: HTMLElement | null
  outputElement: HTMLElement | null
}

function getLabels(locale: string) {
  return locale === 'en'
    ? { title: 'Code', run: 'Run', running: 'Running', format: 'Format', reset: 'Reset', more: 'More code actions', showOutput: 'Show output', hideOutput: 'Hide output' }
    : { title: '示例代码', run: '运行', running: '运行中', format: '格式化', reset: '重置', more: '更多代码操作', showOutput: '展开输出', hideOutput: '收起输出' }
}

function updateToolbar(native: NativeToolbar, { locale, ready, running, outputExpanded }: TourEditorToolbarProps) {
  const labels = getLabels(locale)
  const enabled = ready && !running
  native.toolbar.setAriaLabel(labels.title)
  native.run.label = running ? labels.running : labels.run
  native.run.tooltip = native.run.label
  native.run.class = ThemeIcon.asClassName(running ? ThemeIcon.modify(Codicon.loading, 'spin') : Codicon.play)
  native.run.enabled = enabled
  native.output.label = outputExpanded ? labels.hideOutput : labels.showOutput
  native.output.tooltip = native.output.label
  native.output.checked = outputExpanded
  native.format.label = labels.format
  native.format.tooltip = labels.format
  native.format.enabled = enabled
  native.reset.label = labels.reset
  native.reset.tooltip = labels.reset
  native.reset.enabled = enabled

  const more = native.toolbar.getItemAction(2)
  if (more) {
    more.label = labels.more
    more.tooltip = labels.more
    more.enabled = enabled
  }

  native.runElement?.setAttribute('aria-busy', String(running))
  native.runElement?.setAttribute('data-tour-highlight', 'run')
  native.runElement?.setAttribute('data-tour-primary-action', '')
  native.outputElement?.setAttribute('aria-expanded', String(outputExpanded))
  native.outputElement?.setAttribute('aria-controls', 'tour-output-content')
}

export function TourEditorToolbar(props: TourEditorToolbarProps) {
  const { locale, ready, running, outputExpanded, outputToggleRef } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const nativeRef = useRef<NativeToolbar | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const labels = getLabels(locale)

  useEffect(() => {
    const container = containerRef.current
    if (!ready || !container)
      return

    const currentLabels = getLabels(propsRef.current.locale)
    const run = new Action('tour.run', currentLabels.run, ThemeIcon.asClassName(Codicon.play), true, () => propsRef.current.onRun())
    const output = new Action('tour.toggleOutput', currentLabels.showOutput, ThemeIcon.asClassName(Codicon.layoutPanel), true, () => propsRef.current.onToggleOutput())
    const format = new Action('tour.format', currentLabels.format, ThemeIcon.asClassName(Codicon.wordWrap), true, () => propsRef.current.onFormat())
    const reset = new Action('tour.reset', currentLabels.reset, ThemeIcon.asClassName(Codicon.discard), true, () => propsRef.current.onReset())
    const toolbar = new ToolBar(container, StandaloneServices.get(IContextMenuService), {
      ariaLabel: currentLabels.title,
      toggleMenuTitle: currentLabels.more,
      icon: true,
      label: false,
      actionViewItemProvider: action => action.id === run.id
        ? new ActionViewItem(undefined, action, { icon: true, label: true })
        : undefined,
      highlightToggledItems: true,
    })
    toolbar.setActions([run, output], [format, reset])
    const native: NativeToolbar = {
      toolbar,
      run,
      output,
      format,
      reset,
      runElement: toolbar.getItemElement(0)?.querySelector<HTMLElement>('[role="button"]') ?? null,
      outputElement: toolbar.getItemElement(1)?.querySelector<HTMLElement>('[role="button"]') ?? null,
    }
    nativeRef.current = native
    outputToggleRef.current = native.outputElement
    updateToolbar(native, propsRef.current)

    return () => {
      if (outputToggleRef.current === native.outputElement)
        outputToggleRef.current = null
      nativeRef.current = null
      toolbar.dispose()
      run.dispose()
      output.dispose()
      format.dispose()
      reset.dispose()
    }
  }, [ready, outputToggleRef])

  useEffect(() => {
    if (nativeRef.current)
      updateToolbar(nativeRef.current, propsRef.current)
  }, [locale, ready, running, outputExpanded])

  return (
    <div className={styles.toolbar}>
      <div className={styles.identity}>
        <h2>{labels.title}</h2>
      </div>
      <div ref={containerRef} className={styles.actions} />
      <kbd className={styles.shortcut} aria-hidden="true">Shift + Enter</kbd>
    </div>
  )
}
