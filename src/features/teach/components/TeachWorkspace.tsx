'use client'

import { useCallback, useRef, useState } from 'react'
import { Download, Settings2, TriangleAlert, Upload } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { ZodError } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { workspaceSnapshotSchema } from '@/lib/teach/workspace/documents'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { TeachTopBar } from './TeachTopBar'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'
import { TeacherChatRuntime } from './TeacherChatRuntime'
import { WorkspaceRouteBridge } from './WorkspaceRouteBridge'

export interface TeachWorkspaceProps {
  lang: string
}

function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // The browser starts consuming blob downloads asynchronously. Revoking in
  // the same task can invalidate the URL before Chromium's download manager
  // opens it (and makes browser automation wait forever for a download that
  // never starts). These snapshots are tiny; retain the URL long enough for
  // slower browser download managers, then release it automatically.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Entered classroom chrome plus portable workspace import/export controls. */
export function TeachWorkspace({ lang }: TeachWorkspaceProps) {
  const { repo } = useWorkspace()
  const setSettingsDialogOpen = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const [generation, setGeneration] = useState(0)
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    setExportError(null)
    try {
      const snapshot = await repo.exportAll()
      downloadJson(`teach-workspace-${lang}.json`, JSON.stringify(snapshot, null, 2))
    }
    catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    }
  }, [repo, lang])

  const handleImportFile = useCallback(async (file: File) => {
    setImportError(null)
    try {
      const parsed = workspaceSnapshotSchema.parse(JSON.parse(await file.text()))
      await repo.importAll(parsed)
      useWorkspaceStore.getState().reset()
      setGeneration(value => value + 1)
    }
    catch (error) {
      const invalidFile = error instanceof SyntaxError || error instanceof ZodError
      setImportError(
        invalidFile
          ? t`文件格式不正确或版本不兼容，当前课堂未被修改。`
          : error instanceof Error ? error.message : String(error),
      )
    }
  }, [repo])

  const compactActionClass = 'size-8 rounded-md px-0 sm:w-auto sm:px-2.5'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TeachTopBar
        actions={(
          <>
            <Button
              ref={settingsButtonRef}
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t`AI 服务设置`}
              onClick={() => setSettingsDialogOpen(true)}
              className={compactActionClass}
            >
              <Settings2 aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline"><Trans>AI 服务设置</Trans></span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="workspace-export"
              aria-label={t`导出`}
              onClick={() => void handleExport()}
              className={compactActionClass}
            >
              <Download aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline"><Trans>导出</Trans></span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="workspace-import"
              aria-label={t`导入`}
              onClick={() => fileInputRef.current?.click()}
              className={compactActionClass}
            >
              <Upload aria-hidden="true" className="size-3.5" />
              <span className="hidden sm:inline"><Trans>导入</Trans></span>
            </Button>
            <input
              ref={fileInputRef}
              data-testid="workspace-import-input"
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label={t`导入工作区 JSON`}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file)
                  setPendingImport(file)
                event.target.value = ''
              }}
            />
          </>
        )}
      />

      {importError && (
        <p data-testid="workspace-import-error" role="alert" className="shrink-0 border-b border-destructive/15 bg-destructive/8 px-4 py-2 text-xs text-destructive">
          <Trans>导入失败：</Trans>
          {importError}
        </p>
      )}
      {exportError && (
        <p data-testid="workspace-export-error" role="alert" className="shrink-0 border-b border-destructive/15 bg-destructive/8 px-4 py-2 text-xs text-destructive">
          <Trans>导出失败：</Trans>
          {exportError}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <WorkspaceRouteBridge />
        <TeachWorkspaceShell
          key={generation}
          chat={<TeacherChatRuntime lang={lang} />}
        />
      </div>

      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open)
            setPendingImport(null)
        }}
      >
        <DialogContent className="teach-workspace-theme sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert aria-hidden="true" className="size-4 text-amber-500" />
              <Trans>导入将覆盖当前课堂</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>导入会用所选文件替换当前课堂的全部内容（学习目标、课程、术语表、学习记录、笔记等），且无法撤销。建议先导出备份。</Trans>
            </DialogDescription>
          </DialogHeader>
          {pendingImport && (
            <p className="truncate rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {pendingImport.name}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                <Trans>取消</Trans>
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              data-testid="workspace-import-confirm"
              onClick={() => {
                const file = pendingImport
                setPendingImport(null)
                if (file)
                  void handleImportFile(file)
              }}
            >
              <Trans>覆盖导入</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LLMConfigDialog withTrigger={false} returnFocusRef={settingsButtonRef} />
    </div>
  )
}
