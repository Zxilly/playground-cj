'use client'

import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { Download, FileCode2, LoaderCircle, PanelRightOpen, Play, RotateCcw, Square, WandSparkles } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { toast } from 'sonner'
import { AppNavLinks, LocaleSwitchLink, ThemeToggle } from '@/components/app-shell'
import { ExamplesDropdown } from '@/features/playground/components/ExamplesDropdown'
import ShareButton from '@/features/playground/components/ShareButton'
import { Button } from '@/components/ui/button'
import { getLocalizedExamples } from '@/const'
import { useLanguage } from '@/hooks/useLanguage'
import { saveAsFile } from '@/lib/file'
import type { SiteDomain } from '@/lib/siteHref'
import { clearPlaygroundDraft, usePlaygroundStore } from '@/stores/playground'

interface PlaygroundHeaderProps {
  brand: ReactNode
  servingDomain?: SiteDomain
  handleRun: () => void
  handleCancelRun?: () => void
  handleFormat: () => void
  outputCollapsed?: boolean
  onExpandOutput?: () => void
}

function ExamplesAction() {
  const { i18n } = useLingui()
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  const selectedExampleKey = usePlaygroundStore(state => state.selectedExampleKey)
  const selectedExampleName = usePlaygroundStore(state => state.selectedExampleName)
  const codeOrigin = usePlaygroundStore(state => state.codeOrigin)

  const customLabel = codeOrigin === 'shared'
    ? i18n._(msg`分享的代码`)
    : codeOrigin === 'draft'
      ? i18n._(msg`本地草稿`)
      : i18n._(msg`自定义代码`)

  return (
    <ExamplesDropdown
      disabled={!editorReady}
      selectedKey={selectedExampleKey}
      selectedLabel={selectedExampleKey ? selectedExampleName : customLabel}
      action={(code, meta) => {
        const state = usePlaygroundStore.getState()
        const editor = state.editor
        const model = editor?.getModel()
        if (!editor || !model)
          return

        // Example selection is an explicit edit. Model-resource updates preserve
        // existing drafts, while setValue would discard the user's undo history.
        editor.pushUndoStop()
        editor.executeEdits('playground.example', [{
          range: model.getFullModelRange(),
          text: code,
        }])
        editor.pushUndoStop()
        editor.setPosition({ lineNumber: 1, column: 1 })
        editor.revealLine(1)
        clearPlaygroundDraft()
        state.setExampleSelection(meta?.key ?? null, meta?.name ?? null, meta ? 'example' : 'custom')
        state.resetOutputs()
        state.setMobileView('code')
      }}
    />
  )
}

export function PlaygroundHeader({
  brand,
  servingDomain = 'playground',
  handleRun,
  handleCancelRun,
  handleFormat,
  outputCollapsed = false,
  onExpandOutput,
}: PlaygroundHeaderProps) {
  const { i18n } = useLingui()
  const { locale } = useLanguage()
  const editorReady = usePlaygroundStore(state => state.editor !== undefined)
  const running = usePlaygroundStore(state => state.running)

  const handleReset = useCallback(() => {
    const state = usePlaygroundStore.getState()
    const editor = state.editor
    const model = editor?.getModel()
    if (!editor || !model)
      return

    const examples = getLocalizedExamples(locale)
    const defaultExample = examples['hello-world']
    if (!defaultExample)
      return

    editor.pushUndoStop()
    editor.executeEdits('playground.reset', [{
      range: model.getFullModelRange(),
      text: defaultExample.content,
    }])
    editor.pushUndoStop()
    editor.setPosition({ lineNumber: 1, column: 1 })
    editor.revealLine(1)
    clearPlaygroundDraft()
    state.setExampleSelection('hello-world', defaultExample.name, 'example')
    state.resetOutputs()
    toast.success(i18n._(msg`已重置为默认代码`))
  }, [i18n, locale])

  const handleDownload = useCallback(() => {
    const editor = usePlaygroundStore.getState().editor
    if (!editor)
      return
    saveAsFile(editor.getValue())
    toast.success(i18n._(msg`已下载 main.cj`))
  }, [i18n])

  // One DOM tree at every width: the server-rendered layout is already correct
  // before hydration, and resizing cannot remount open menus or focused controls.
  return (
    <header className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 lg:flex-nowrap lg:py-2.5">
        <div className="min-w-0 shrink-0 py-0.5">{brand}</div>
        <AppNavLinks
          active="playground"
          lang={locale}
          servingDomain={servingDomain}
          className="order-3 w-full overflow-x-auto border-t border-border pt-1 lg:order-none lg:w-auto lg:border-t-0 lg:pt-0"
        />
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <LocaleSwitchLink lang={locale} fallbackPathname={`/${locale}`} />
        </div>
      </div>

      {/* Unified full-width divider container so the desktop second-row border never breaks in the middle. */}
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm lg:inline-flex">
            <FileCode2 aria-hidden="true" className="size-4" />
            main.cj
          </span>
          <div className="min-w-0 flex-1 lg:max-w-64">
            <ExamplesAction />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground lg:min-h-9"
            onClick={handleReset}
            disabled={!editorReady || running}
            aria-label={i18n._(msg`重置代码`)}
            title={i18n._(msg`重置为默认示例`)}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline"><Trans>重置</Trans></span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground lg:min-h-9"
            onClick={handleDownload}
            disabled={!editorReady}
            aria-label={i18n._(msg`下载 .cj`)}
            title={i18n._(msg`下载为 main.cj`)}
          >
            <Download aria-hidden="true" className="size-4" />
            <span className="hidden xl:inline"><Trans>下载 .cj</Trans></span>
          </Button>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-end gap-2 border-t border-border bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:border-t-0 lg:bg-transparent lg:p-0 [&>button]:flex-1 lg:[&>button]:flex-none">
          {outputCollapsed && onExpandOutput && (
            <Button
              type="button"
              variant="outline"
              className="hidden min-h-9 gap-1.5 px-3 lg:inline-flex"
              onClick={onExpandOutput}
            >
              <PanelRightOpen aria-hidden="true" className="size-4" />
              <Trans>展开输出</Trans>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-3 lg:min-h-9"
            onClick={handleFormat}
            disabled={!editorReady || running}
          >
            <WandSparkles aria-hidden="true" className="size-4" />
            <Trans>格式化</Trans>
          </Button>
          <ShareButton />
          {running && handleCancelRun && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-1.5 px-3 text-error-foreground hover:text-error-foreground lg:min-h-9"
              onClick={handleCancelRun}
            >
              <Square aria-hidden="true" className="size-3.5 fill-current" />
              <Trans>取消运行</Trans>
            </Button>
          )}
          <Button
            type="button"
            className="min-h-11 gap-2 bg-brand px-5 text-brand-foreground hover:bg-brand-hover lg:min-h-9"
            onClick={handleRun}
            disabled={!editorReady || running}
            aria-busy={running}
          >
            {running
              ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              : <Play aria-hidden="true" className="size-4" />}
            {running ? <Trans>运行中</Trans> : <Trans>运行</Trans>}
          </Button>
        </div>
      </div>
    </header>
  )
}
